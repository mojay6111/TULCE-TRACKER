const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const auth = require("../middleware/auth");

// ─── Helpers ────────────────────────────────────────────────────────

// Format phone to 254XXXXXXXXX
function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) return "254" + cleaned.slice(1);
  if (cleaned.startsWith("254")) return cleaned;
  if (cleaned.startsWith("+254")) return cleaned.slice(1);
  return cleaned;
}

// Generate timestamp: YYYYMMDDHHmmss
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// Get Daraja OAuth token
async function getDarajaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const env = process.env.MPESA_ENV || "sandbox";

  const baseUrl =
    env === "live"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Daraja auth failed: ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ─── POST /api/mpesa/stk-push ────────────────────────────────────────
// Initiates STK Push to customer's phone
router.post("/stk-push", auth, async (req, res) => {
  const { orderId, phone, amount } = req.body;

  if (!orderId || !phone || !amount) {
    return res
      .status(400)
      .json({ error: "orderId, phone, and amount are required." });
  }

  const env = process.env.MPESA_ENV || "sandbox";
  const baseUrl =
    env === "live"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
    "base64",
  );
  const formattedPhone = formatPhone(phone);

  try {
    // Verify order exists and get remaining balance
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { payments: true, customer: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found." });

    const alreadyPaid = order.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = order.totalAmount - alreadyPaid;

    if (remaining <= 0) {
      return res
        .status(400)
        .json({ error: "This order is already fully paid." });
    }

    const payAmount = Math.min(parseFloat(amount), remaining);

    // Get OAuth token
    const token = await getDarajaToken();

    // STK Push request
    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline", // For Till Number
      Amount: Math.ceil(payAmount), // M-Pesa requires whole numbers
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: `TULCE-${orderId}`,
      TransactionDesc: `Tulce payment for ${order.customer.name}`,
    };

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkBody),
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
      return res.status(400).json({
        error: stkData.ResponseDescription || "STK Push failed.",
        details: stkData,
      });
    }

    // Save transaction record
    const transaction = await prisma.mpesaTransaction.create({
      data: {
        orderId: parseInt(orderId),
        phone: formattedPhone,
        amount: payAmount,
        checkoutRequestId: stkData.CheckoutRequestID,
        merchantRequestId: stkData.MerchantRequestID,
        status: "PENDING",
      },
    });

    res.json({
      message: "STK Push sent. Waiting for customer to confirm.",
      checkoutRequestId: stkData.CheckoutRequestID,
      transactionId: transaction.id,
    });
  } catch (err) {
    console.error("STK Push error:", err);
    res.status(500).json({ error: err.message || "STK Push failed." });
  }
});

// ─── POST /api/mpesa/callback ────────────────────────────────────────
// Safaricom calls this after customer confirms or cancels payment
// This URL must be publicly accessible (use ngrok)
router.post("/callback", async (req, res) => {
  // Always respond 200 immediately so Safaricom knows we received it
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      body;

    console.log(`\nM-Pesa Callback — CheckoutRequestID: ${CheckoutRequestID}`);
    console.log(`Result: ${ResultCode} — ${ResultDesc}`);

    // Find the pending transaction
    const transaction = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId: CheckoutRequestID },
    });

    if (!transaction) {
      console.log("Transaction not found for:", CheckoutRequestID);
      return;
    }

    if (ResultCode !== 0) {
      // Payment failed or was cancelled by user
      await prisma.mpesaTransaction.update({
        where: { checkoutRequestId: CheckoutRequestID },
        data: {
          status: ResultCode === 1032 ? "CANCELLED" : "FAILED",
          resultCode: ResultCode,
          resultDesc: ResultDesc,
        },
      });
      console.log(
        `Payment ${ResultCode === 1032 ? "CANCELLED" : "FAILED"} for order ${transaction.orderId}`,
      );
      return;
    }

    // Payment successful — extract receipt number and amount
    const items = CallbackMetadata?.Item || [];
    const get = (name) => items.find((i) => i.Name === name)?.Value;

    const mpesaReceiptNumber = get("MpesaReceiptNumber");
    const paidAmount = get("Amount");

    // Update transaction record
    await prisma.mpesaTransaction.update({
      where: { checkoutRequestId: CheckoutRequestID },
      data: {
        status: "SUCCESS",
        mpesaReceiptNumber,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      },
    });

    // Record the payment automatically
    const order = await prisma.order.findUnique({
      where: { id: transaction.orderId },
      include: { payments: true },
    });

    if (!order) return;

    const alreadyPaid = order.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = order.totalAmount - alreadyPaid;
    const finalAmount = Math.min(paidAmount || transaction.amount, remaining);

    if (finalAmount > 0) {
      await prisma.payment.create({
        data: {
          orderId: transaction.orderId,
          amount: finalAmount,
          method: "MPESA_STK",
          mpesaRef: mpesaReceiptNumber,
        },
      });
      console.log(
        `✅ Payment of KES ${finalAmount} recorded for order ${transaction.orderId} — Ref: ${mpesaReceiptNumber}`,
      );
    }
  } catch (err) {
    console.error("Callback processing error:", err);
  }
});

// ─── GET /api/mpesa/status/:checkoutRequestId ────────────────────────
// Frontend polls this to know if payment was confirmed
router.get("/status/:checkoutRequestId", auth, async (req, res) => {
  try {
    const transaction = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId: req.params.checkoutRequestId },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    res.json({
      status: transaction.status,
      mpesaReceiptNumber: transaction.mpesaReceiptNumber,
      amount: transaction.amount,
      resultDesc: transaction.resultDesc,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch status." });
  }
});

// ─── GET /api/mpesa/query/:checkoutRequestId ─────────────────────────
// Manually query Safaricom for payment status (backup if callback missed)
router.get("/query/:checkoutRequestId", auth, async (req, res) => {
  const env = process.env.MPESA_ENV || "sandbox";
  const baseUrl =
    env === "live"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
    "base64",
  );

  try {
    const token = await getDarajaToken();

    const queryRes = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: req.params.checkoutRequestId,
      }),
    });

    const data = await queryRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

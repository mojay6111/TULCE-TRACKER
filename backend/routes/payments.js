const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const auth = require("../middleware/auth");

// POST /api/payments — record a payment for an order
router.post("/", auth, async (req, res) => {
  const { orderId, amount, method } = req.body;

  if (!orderId || !amount || !method) {
    return res
      .status(400)
      .json({ error: "orderId, amount, and method (CASH or MPESA) required." });
  }

  if (!["CASH", "MPESA"].includes(method)) {
    return res.status(400).json({ error: "Method must be CASH or MPESA." });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { payments: true },
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

    const payment = await prisma.payment.create({
      data: {
        orderId: parseInt(orderId),
        amount: payAmount,
        method,
      },
    });

    const newPaid = alreadyPaid + payAmount;
    const newBalance = order.totalAmount - newPaid;

    res.status(201).json({
      payment,
      orderStatus: newBalance <= 0 ? "PAID" : "PARTIAL",
      newBalance,
      newPaid,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not record payment." });
  }
});

// DELETE /api/payments/:id — undo a payment
router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.payment.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Payment deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete payment." });
  }
});

module.exports = router;

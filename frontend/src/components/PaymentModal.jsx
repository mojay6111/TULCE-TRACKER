import { useState, useEffect, useRef } from "react";
import api from "../api";

const POLL_INTERVAL = 3000; // check every 3 seconds
const POLL_TIMEOUT = 90; // stop after 90 seconds

export default function PaymentModal({
  order,
  customerPhone,
  onClose,
  onSuccess,
}) {
  const [tab, setTab] = useState("manual"); // "manual" | "stk"
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(order.balance);
  const [phone, setPhone] = useState(customerPhone || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // STK Push state
  const [stkStage, setStkStage] = useState("idle"); // idle | sending | waiting | success | failed | cancelled
  const [stkMessage, setStkMessage] = useState("");
  const [stkReceipt, setStkReceipt] = useState("");
  const [countdown, setCountdown] = useState(POLL_TIMEOUT);
  const checkoutRef = useRef(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  // Cleanup polls on unmount
  useEffect(
    () => () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    },
    [],
  );

  const fmt = (n) => `KES ${Number(n).toFixed(0)}`;

  // ── Manual payment (Cash or M-Pesa manual) ──────────────────────
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return setError("Enter a valid amount.");
    setError("");
    setLoading(true);
    try {
      await api.post("/payments", { orderId: order.id, amount, method });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Could not record payment.");
    } finally {
      setLoading(false);
    }
  };

  // ── STK Push ────────────────────────────────────────────────────
  const handleStkPush = async () => {
    if (!phone) return setError("Enter a phone number.");
    if (!amount || amount <= 0) return setError("Enter a valid amount.");
    setError("");
    setStkStage("sending");
    setStkMessage("");

    try {
      const res = await api.post("/mpesa/stk-push", {
        orderId: order.id,
        phone,
        amount,
      });

      checkoutRef.current = res.data.checkoutRequestId;
      setStkStage("waiting");
      setStkMessage(
        "Request sent! Tell the customer to check their phone and enter their M-Pesa PIN.",
      );
      setCountdown(POLL_TIMEOUT);

      // Countdown timer
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(
            `/mpesa/status/${checkoutRef.current}`,
          );
          const { status, mpesaReceiptNumber, resultDesc } = statusRes.data;

          if (status === "SUCCESS") {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setStkReceipt(mpesaReceiptNumber || "");
            setStkStage("success");
            setStkMessage(`Payment confirmed! Receipt: ${mpesaReceiptNumber}`);
            setTimeout(() => onSuccess(), 2000);
          } else if (status === "FAILED" || status === "CANCELLED") {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setStkStage(status === "CANCELLED" ? "cancelled" : "failed");
            setStkMessage(
              resultDesc ||
                (status === "CANCELLED"
                  ? "Customer cancelled the payment."
                  : "Payment failed."),
            );
          }
        } catch {
          /* keep polling */
        }
      }, POLL_INTERVAL);

      // Stop polling after timeout
      setTimeout(() => {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        setStkStage((prev) => (prev === "waiting" ? "failed" : prev));
        setStkMessage((prev) =>
          prev === "waiting"
            ? "No response received. The request may have expired."
            : prev,
        );
      }, POLL_TIMEOUT * 1000);
    } catch (err) {
      setStkStage("failed");
      setStkMessage(err.response?.data?.error || "Could not send STK Push.");
    }
  };

  const resetStk = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setStkStage("idle");
    setStkMessage("");
    setStkReceipt("");
    setError("");
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-sm animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-dark-700">
          <h2 className="font-display text-lg font-bold text-white">
            Record Payment
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Outstanding:{" "}
            <span className="text-red-400 font-semibold">
              {fmt(order.balance)}
            </span>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-700">
          <button
            onClick={() => {
              setTab("manual");
              resetStk();
            }}
            className={`flex-1 py-2.5 text-sm font-medium font-display transition-colors ${
              tab === "manual"
                ? "text-tulce-400 border-b-2 border-tulce-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            💵 Manual
          </button>
          <button
            onClick={() => {
              setTab("stk");
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-medium font-display transition-colors ${
              tab === "stk"
                ? "text-green-400 border-b-2 border-green-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            📱 STK Push
          </button>
        </div>

        <div className="p-6">
          {/* ── MANUAL TAB ── */}
          {tab === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["CASH", "MPESA"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`py-3 rounded-lg text-sm font-semibold font-display transition-all ${
                        method === m
                          ? m === "MPESA"
                            ? "bg-green-600 text-white border border-green-500"
                            : "bg-blue-600 text-white border border-blue-500"
                          : "bg-dark-700 text-gray-400 border border-dark-500 hover:border-gray-500"
                      }`}
                    >
                      {m === "MPESA" ? "📱 M-Pesa" : "💵 Cash"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                  Amount (KES)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value))}
                  min="1"
                  max={order.balance}
                  step="1"
                  required
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-tulce-500 text-sm"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Max: {fmt(order.balance)}
                </p>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {loading ? "Saving..." : "Mark as Paid"}
                </button>
              </div>
            </form>
          )}

          {/* ── STK PUSH TAB ── */}
          {tab === "stk" && (
            <div className="space-y-4">
              {/* Idle / form state */}
              {(stkStage === "idle" ||
                stkStage === "failed" ||
                stkStage === "cancelled") && (
                <>
                  {stkStage !== "idle" && (
                    <div
                      className={`rounded-lg px-4 py-3 text-sm ${stkStage === "cancelled" ? "bg-amber-900/30 border border-amber-800 text-amber-400" : "bg-red-900/30 border border-red-800 text-red-400"}`}
                    >
                      {stkStage === "cancelled" ? "❌ " : "⚠️ "}
                      {stkMessage}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      The customer will get a popup on this number
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      Amount (KES)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value))}
                      min="1"
                      max={order.balance}
                      step="1"
                      className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500 text-sm"
                    />
                  </div>

                  {/* What happens explainer */}
                  <div className="bg-dark-700 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                    <p className="text-gray-300 font-medium mb-1">
                      What happens:
                    </p>
                    <p>1. Customer gets M-Pesa popup on their phone</p>
                    <p>2. They enter their PIN to confirm</p>
                    <p>3. Payment is automatically recorded here</p>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStkPush}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      📱 Send Request
                    </button>
                  </div>
                </>
              )}

              {/* Sending state */}
              {stkStage === "sending" && (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3 animate-pulse">📱</div>
                  <p className="text-white font-medium">Sending STK Push...</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Contacting Safaricom
                  </p>
                </div>
              )}

              {/* Waiting state */}
              {stkStage === "waiting" && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3 animate-bounce">📲</div>
                    <p className="text-white font-medium">
                      Waiting for payment...
                    </p>
                    <p className="text-gray-400 text-sm mt-1">{stkMessage}</p>
                  </div>

                  {/* Countdown ring */}
                  <div className="flex items-center justify-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-display font-bold text-sm
                      ${countdown > 30 ? "border-green-500 text-green-400" : countdown > 10 ? "border-amber-500 text-amber-400" : "border-red-500 text-red-400"}`}
                    >
                      {countdown}s
                    </div>
                    <p className="text-gray-500 text-xs">Time remaining</p>
                  </div>

                  <div className="bg-dark-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm text-white font-medium">{phone}</p>
                    <p className="text-xs text-gray-500 mt-1">Amount</p>
                    <p className="text-sm text-white font-medium">
                      {fmt(amount)}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      clearInterval(pollRef.current);
                      clearInterval(timerRef.current);
                      onClose();
                    }}
                    className="w-full bg-dark-700 hover:bg-dark-600 text-gray-400 py-2 rounded-lg text-sm transition-colors"
                  >
                    Close (payment will still complete if confirmed)
                  </button>
                </div>
              )}

              {/* Success state */}
              {stkStage === "success" && (
                <div className="text-center py-6 space-y-3">
                  <div className="text-5xl">✅</div>
                  <p className="text-white font-display font-bold text-lg">
                    Payment Confirmed!
                  </p>
                  <p className="text-gray-400 text-sm">
                    {fmt(amount)} received via M-Pesa
                  </p>
                  {stkReceipt && (
                    <div className="bg-green-900/20 border border-green-800 rounded-lg px-4 py-2">
                      <p className="text-xs text-gray-500">Receipt Number</p>
                      <p className="text-green-400 font-mono font-bold">
                        {stkReceipt}
                      </p>
                    </div>
                  )}
                  <p className="text-gray-600 text-xs">
                    Closing automatically...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

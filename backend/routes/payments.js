const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const auth = require("../middleware/auth");
const prisma = new PrismaClient();

router.post("/", auth, async (req, res) => {
  const { orderId, amount, method } = req.body;
  if (!orderId || !amount || !method) return res.status(400).json({ error: "orderId, amount, method required." });
  if (!["CASH", "MPESA"].includes(method)) return res.status(400).json({ error: "Method must be CASH or MPESA." });
  try {
    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) }, include: { payments: true } });
    if (!order) return res.status(404).json({ error: "Order not found." });
    const alreadyPaid = order.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = order.totalAmount - alreadyPaid;
    if (remaining <= 0) return res.status(400).json({ error: "Order already fully paid." });
    const payAmount = Math.min(parseFloat(amount), remaining);
    const payment = await prisma.payment.create({ data: { orderId: parseInt(orderId), amount: payAmount, method } });
    const newPaid = alreadyPaid + payAmount;
    res.status(201).json({ payment, orderStatus: newPaid >= order.totalAmount ? "PAID" : "PARTIAL", newBalance: order.totalAmount - newPaid, newPaid });
  } catch { res.status(500).json({ error: "Could not record payment." }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.payment.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Payment deleted." });
  } catch { res.status(500).json({ error: "Could not delete payment." }); }
});

module.exports = router;

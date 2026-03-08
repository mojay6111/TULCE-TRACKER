const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const auth = require("../middleware/auth");
const prisma = new PrismaClient();
const PRICE = 5;

router.get("/", auth, async (req, res) => {
  try {
    const where = req.query.date ? { dayLabel: req.query.date } : {};
    const orders = await prisma.order.findMany({ where, include: { customer: true, payments: true }, orderBy: { date: "desc" } });
    const enriched = orders.map(o => { const paid = o.payments.reduce((s, p) => s + p.amount, 0); return { ...o, amountPaid: paid, balance: o.totalAmount - paid, status: paid >= o.totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" }; });
    res.json(enriched);
  } catch { res.status(500).json({ error: "Could not fetch orders." }); }
});

router.post("/", auth, async (req, res) => {
  const { customerId, quantity } = req.body;
  if (!customerId || !quantity || quantity < 1) return res.status(400).json({ error: "customerId and quantity required." });
  try {
    const now = new Date();
    const dayLabel = now.toISOString().split("T")[0];
    const totalAmount = quantity * PRICE;
    const order = await prisma.order.create({ data: { customerId: parseInt(customerId), quantity: parseInt(quantity), unitPrice: PRICE, totalAmount, dayLabel, date: now }, include: { customer: true, payments: true } });
    res.status(201).json({ ...order, amountPaid: 0, balance: totalAmount, status: "UNPAID" });
  } catch { res.status(500).json({ error: "Could not create order." }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.payment.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });
    res.json({ message: "Order deleted." });
  } catch { res.status(500).json({ error: "Could not delete order." }); }
});

module.exports = router;

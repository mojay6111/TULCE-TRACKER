const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const auth = require("../middleware/auth");
const prisma = new PrismaClient();

router.get("/", auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({ include: { orders: { include: { payments: true } } }, orderBy: { name: "asc" } });
    const withDebt = customers.map(c => {
      const totalOwed = c.orders.reduce((s, o) => s + o.totalAmount, 0);
      const totalPaid = c.orders.reduce((s, o) => s + o.payments.reduce((ps, p) => ps + p.amount, 0), 0);
      return { id: c.id, name: c.name, phone: c.phone, createdAt: c.createdAt, totalOwed, totalPaid, debt: totalOwed - totalPaid };
    });
    res.json(withDebt);
  } catch { res.status(500).json({ error: "Could not fetch customers." }); }
});

router.post("/", auth, async (req, res) => {
  const { name, phone } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required." });
  try {
    const customer = await prisma.customer.create({ data: { name: name.trim(), phone: phone?.trim() || null } });
    res.status(201).json(customer);
  } catch { res.status(500).json({ error: "Could not create customer." }); }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: parseInt(req.params.id) }, include: { orders: { include: { payments: true }, orderBy: { date: "desc" } } } });
    if (!customer) return res.status(404).json({ error: "Customer not found." });
    const ordersByDay = {};
    customer.orders.forEach(order => {
      const day = order.dayLabel;
      if (!ordersByDay[day]) ordersByDay[day] = [];
      const paid = order.payments.reduce((s, p) => s + p.amount, 0);
      ordersByDay[day].push({ ...order, amountPaid: paid, balance: order.totalAmount - paid, status: paid >= order.totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" });
    });
    const totalOwed = customer.orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalPaid = customer.orders.reduce((s, o) => s + o.payments.reduce((ps, p) => ps + p.amount, 0), 0);
    res.json({ id: customer.id, name: customer.name, phone: customer.phone, createdAt: customer.createdAt, totalOwed, totalPaid, debt: totalOwed - totalPaid, ordersByDay });
  } catch { res.status(500).json({ error: "Could not fetch customer." }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const orders = await prisma.order.findMany({ where: { customerId: id } });
    for (const order of orders) await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.deleteMany({ where: { customerId: id } });
    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Customer deleted." });
  } catch { res.status(500).json({ error: "Could not delete customer." }); }
});

module.exports = router;

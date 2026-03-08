const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const auth = require("../middleware/auth");

// GET /api/customers — list all customers
router.get("/", auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          include: { payments: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Attach debt to each customer
    const withDebt = customers.map((c) => {
      const totalOwed = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalPaid = c.orders.reduce(
        (sum, o) => sum + o.payments.reduce((ps, p) => ps + p.amount, 0),
        0,
      );
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        createdAt: c.createdAt,
        totalOwed,
        totalPaid,
        debt: totalOwed - totalPaid,
      };
    });

    res.json(withDebt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch customers." });
  }
});

// POST /api/customers — add a new customer
router.post("/", auth, async (req, res) => {
  const { name, phone } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required." });

  try {
    const customer = await prisma.customer.create({
      data: { name: name.trim(), phone: phone?.trim() || null },
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create customer." });
  }
});

// GET /api/customers/:id — single customer with full order history
router.get("/:id", auth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        orders: {
          include: { payments: true },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!customer)
      return res.status(404).json({ error: "Customer not found." });

    // Group orders by day
    const ordersByDay = {};
    customer.orders.forEach((order) => {
      const day = order.dayLabel;
      if (!ordersByDay[day]) ordersByDay[day] = [];
      const paid = order.payments.reduce((s, p) => s + p.amount, 0);
      ordersByDay[day].push({
        ...order,
        amountPaid: paid,
        balance: order.totalAmount - paid,
        status:
          paid >= order.totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
      });
    });

    const totalOwed = customer.orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalPaid = customer.orders.reduce(
      (s, o) => s + o.payments.reduce((ps, p) => ps + p.amount, 0),
      0,
    );

    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      createdAt: customer.createdAt,
      totalOwed,
      totalPaid,
      debt: totalOwed - totalPaid,
      ordersByDay,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch customer." });
  }
});

// DELETE /api/customers/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Delete payments -> orders -> customer
    const orders = await prisma.order.findMany({ where: { customerId: id } });
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
    }
    await prisma.order.deleteMany({ where: { customerId: id } });
    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Customer deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete customer." });
  }
});

module.exports = router;

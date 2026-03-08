const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const auth = require("../middleware/auth");

const PRICE_PER_TULCE = 5; // KES 5

// GET /api/orders — get all orders (optionally filter by date)
router.get("/", auth, async (req, res) => {
  const { date } = req.query; // e.g. ?date=2024-01-15

  try {
    const where = date ? { dayLabel: date } : {};
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        payments: true,
      },
      orderBy: { date: "desc" },
    });

    const enriched = orders.map((o) => {
      const paid = o.payments.reduce((s, p) => s + p.amount, 0);
      return {
        ...o,
        amountPaid: paid,
        balance: o.totalAmount - paid,
        status:
          paid >= o.totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch orders." });
  }
});

// POST /api/orders — create a new order
router.post("/", auth, async (req, res) => {
  const { customerId, quantity } = req.body;

  if (!customerId || !quantity || quantity < 1) {
    return res
      .status(400)
      .json({ error: "customerId and quantity (min 1) are required." });
  }

  try {
    const now = new Date();
    const dayLabel = now.toISOString().split("T")[0]; // "YYYY-MM-DD"
    const totalAmount = quantity * PRICE_PER_TULCE;

    const order = await prisma.order.create({
      data: {
        customerId: parseInt(customerId),
        quantity: parseInt(quantity),
        unitPrice: PRICE_PER_TULCE,
        totalAmount,
        dayLabel,
        date: now,
      },
      include: { customer: true, payments: true },
    });

    res.status(201).json({
      ...order,
      amountPaid: 0,
      balance: totalAmount,
      status: "UNPAID",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create order." });
  }
});

// DELETE /api/orders/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.payment.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });
    res.json({ message: "Order deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete order." });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const auth = require("../middleware/auth");

// GET /api/dashboard — today's summary + overall debt
router.get("/", auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Today's orders
    const todayOrders = await prisma.order.findMany({
      where: { dayLabel: today },
      include: { customer: true, payments: true },
    });

    const todayTulces = todayOrders.reduce((s, o) => s + o.quantity, 0);
    const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
    const todayCollected = todayOrders.reduce(
      (s, o) => s + o.payments.reduce((ps, p) => ps + p.amount, 0),
      0,
    );
    const todayUnpaid = todayRevenue - todayCollected;

    // All-time debt ledger
    const allOrders = await prisma.order.findMany({
      include: { customer: true, payments: true },
    });

    const customerDebt = {};
    allOrders.forEach((o) => {
      const paid = o.payments.reduce((s, p) => s + p.amount, 0);
      const debt = o.totalAmount - paid;
      if (debt > 0) {
        if (!customerDebt[o.customerId]) {
          customerDebt[o.customerId] = { name: o.customer.name, debt: 0 };
        }
        customerDebt[o.customerId].debt += debt;
      }
    });

    const debtors = Object.entries(customerDebt)
      .map(([id, d]) => ({
        customerId: parseInt(id),
        name: d.name,
        debt: d.debt,
      }))
      .sort((a, b) => b.debt - a.debt);

    const totalDebt = debtors.reduce((s, d) => s + d.debt, 0);

    // Recent days summary (last 7 days)
    const recentOrders = await prisma.order.findMany({
      include: { payments: true },
      orderBy: { date: "desc" },
    });

    const daysSummary = {};
    recentOrders.forEach((o) => {
      if (!daysSummary[o.dayLabel]) {
        daysSummary[o.dayLabel] = {
          date: o.dayLabel,
          tulces: 0,
          revenue: 0,
          collected: 0,
        };
      }
      daysSummary[o.dayLabel].tulces += o.quantity;
      daysSummary[o.dayLabel].revenue += o.totalAmount;
      daysSummary[o.dayLabel].collected += o.payments.reduce(
        (s, p) => s + p.amount,
        0,
      );
    });

    const days = Object.values(daysSummary)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);

    res.json({
      today: {
        date: today,
        tulces: todayTulces,
        revenue: todayRevenue,
        collected: todayCollected,
        unpaid: todayUnpaid,
        orders: todayOrders.map((o) => {
          const paid = o.payments.reduce((s, p) => s + p.amount, 0);
          return {
            ...o,
            amountPaid: paid,
            balance: o.totalAmount - paid,
            status:
              paid >= o.totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          };
        }),
      },
      debtors,
      totalDebt,
      days,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dashboard." });
  }
});

module.exports = router;

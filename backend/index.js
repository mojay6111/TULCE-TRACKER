require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const dashboardRoutes = require("./routes/dashboard");
const mpesaRoutes = require("./routes/mpesa");

const app = express();

app.use(cors({ origin: ["http://localhost:5174", /\.ngrok-free\.app$/] }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mpesa", mpesaRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "TULCE TRACKER is running 🍩" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n🍩 TULCE TRACKER backend running on http://localhost:${PORT}`);
  console.log(
    `📱 M-Pesa callback: ${process.env.MPESA_CALLBACK_URL || "NOT SET — update .env"}`,
  );
});

# ============================================================
#  TULCE TRACKER - One-Click Setup Script for Windows
#  Run this in PowerShell from wherever you want the project
#  e.g. C:\Users\YourName\Projects\
# ============================================================

Write-Host ""
Write-Host "  Setting up TULCE TRACKER..." -ForegroundColor Yellow
Write-Host ""

# --- Create folder structure ---
$folders = @(
    "tulce-tracker\backend\routes",
    "tulce-tracker\backend\middleware",
    "tulce-tracker\backend\prisma",
    "tulce-tracker\frontend\src\components",
    "tulce-tracker\frontend\src\pages",
    "tulce-tracker\frontend\src\context"
)
foreach ($f in $folders) {
    New-Item -ItemType Directory -Force -Path $f | Out-Null
}
Write-Host "  [1/4] Folders created" -ForegroundColor Green

# ============================================================
#  BACKEND FILES
# ============================================================

Set-Content "tulce-tracker\backend\package.json" @'
{
  "name": "tulce-tracker-backend",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js",
    "db:push": "npx prisma db push",
    "db:studio": "npx prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.3",
    "prisma": "^5.10.0"
  }
}
'@

Set-Content "tulce-tracker\backend\.env" @'
# PostgreSQL connection - update YOUR_PASSWORD
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/tulce_tracker"

# Change this to any secret string
JWT_SECRET="tulce-tracker-secret-2024"

# Your admin login credentials
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="tulce2024"

PORT=5000
'@

Set-Content "tulce-tracker\backend\prisma\schema.prisma" @'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Admin {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
}

model Customer {
  id        Int      @id @default(autoincrement())
  name      String
  phone     String?
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id          Int       @id @default(autoincrement())
  customerId  Int
  customer    Customer  @relation(fields: [customerId], references: [id])
  quantity    Int
  unitPrice   Float     @default(5.0)
  totalAmount Float
  date        DateTime  @default(now())
  dayLabel    String
  payments    Payment[]
  createdAt   DateTime  @default(now())
}

model Payment {
  id        Int           @id @default(autoincrement())
  orderId   Int
  order     Order         @relation(fields: [orderId], references: [id])
  amount    Float
  method    PaymentMethod
  paidAt    DateTime      @default(now())
}

enum PaymentMethod {
  CASH
  MPESA
}
'@

Set-Content "tulce-tracker\backend\index.js" @'
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "TULCE TRACKER is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n  TULCE TRACKER backend running on http://localhost:${PORT}`);
});
'@

Set-Content "tulce-tracker\backend\middleware\auth.js" @'
const jwt = require("jsonwebtoken");
module.exports = function (req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided." });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token." });
  }
};
'@

Set-Content "tulce-tracker\backend\routes\auth.js" @'
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required." });
  try {
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return res.status(401).json({ error: "Invalid credentials." });
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });
    const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: "12h" });
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/seed", async (req, res) => {
  try {
    const existing = await prisma.admin.findUnique({ where: { username: process.env.ADMIN_USERNAME } });
    if (existing) return res.json({ message: "Admin already exists." });
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await prisma.admin.create({ data: { username: process.env.ADMIN_USERNAME, password: hashed } });
    res.json({ message: "Admin created! You can now log in." });
  } catch {
    res.status(500).json({ error: "Could not seed admin." });
  }
});

module.exports = router;
'@

Set-Content "tulce-tracker\backend\routes\customers.js" @'
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
'@

Set-Content "tulce-tracker\backend\routes\orders.js" @'
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
'@

Set-Content "tulce-tracker\backend\routes\payments.js" @'
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
'@

Set-Content "tulce-tracker\backend\routes\dashboard.js" @'
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const auth = require("../middleware/auth");
const prisma = new PrismaClient();

router.get("/", auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayOrders = await prisma.order.findMany({ where: { dayLabel: today }, include: { customer: true, payments: true } });
    const todayTulces = todayOrders.reduce((s, o) => s + o.quantity, 0);
    const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
    const todayCollected = todayOrders.reduce((s, o) => s + o.payments.reduce((ps, p) => ps + p.amount, 0), 0);
    const allOrders = await prisma.order.findMany({ include: { customer: true, payments: true } });
    const customerDebt = {};
    allOrders.forEach(o => {
      const paid = o.payments.reduce((s, p) => s + p.amount, 0);
      const debt = o.totalAmount - paid;
      if (debt > 0) {
        if (!customerDebt[o.customerId]) customerDebt[o.customerId] = { name: o.customer.name, debt: 0 };
        customerDebt[o.customerId].debt += debt;
      }
    });
    const debtors = Object.entries(customerDebt).map(([id, d]) => ({ customerId: parseInt(id), name: d.name, debt: d.debt })).sort((a, b) => b.debt - a.debt);
    const daysSummary = {};
    allOrders.forEach(o => {
      if (!daysSummary[o.dayLabel]) daysSummary[o.dayLabel] = { date: o.dayLabel, tulces: 0, revenue: 0, collected: 0 };
      daysSummary[o.dayLabel].tulces += o.quantity;
      daysSummary[o.dayLabel].revenue += o.totalAmount;
      daysSummary[o.dayLabel].collected += o.payments.reduce((s, p) => s + p.amount, 0);
    });
    const days = Object.values(daysSummary).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
    res.json({
      today: { date: today, tulces: todayTulces, revenue: todayRevenue, collected: todayCollected, unpaid: todayRevenue - todayCollected, orders: todayOrders.map(o => { const paid = o.payments.reduce((s, p) => s + p.amount, 0); return { ...o, amountPaid: paid, balance: o.totalAmount - paid, status: paid >= o.totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" }; }) },
      debtors, totalDebt: debtors.reduce((s, d) => s + d.debt, 0), days
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load dashboard." }); }
});

module.exports = router;
'@

# ============================================================
#  FRONTEND FILES
# ============================================================

Set-Content "tulce-tracker\frontend\package.json" @'
{
  "name": "tulce-tracker-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "axios": "^1.6.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.1.0"
  }
}
'@

Set-Content "tulce-tracker\frontend\vite.config.js" @'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } } }
});
'@

Set-Content "tulce-tracker\frontend\tailwind.config.js" @'
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { display: ['"Syne"', "sans-serif"], body: ['"DM Sans"', "sans-serif"] },
      colors: {
        tulce: { 50:"#fff8ed",100:"#ffefd3",200:"#ffdaa6",300:"#ffbe6d",400:"#ff9932",500:"#ff7a0a",600:"#f05d00",700:"#c74302",800:"#9e360b",900:"#7f2e0c" },
        dark: { 900:"#0f0e0d",800:"#1a1816",700:"#252220",600:"#302d2a",500:"#3d3936" }
      }
    }
  },
  plugins: []
};
'@

Set-Content "tulce-tracker\frontend\postcss.config.js" @'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
'@

Set-Content "tulce-tracker\frontend\index.html" @'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TULCE TRACKER</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
'@

Set-Content "tulce-tracker\frontend\src\index.css" @'
@tailwind base;
@tailwind components;
@tailwind utilities;
* { box-sizing: border-box; }
body { font-family: "DM Sans", sans-serif; background-color: #0f0e0d; color: #f5f0eb; margin: 0; }
h1,h2,h3,h4 { font-family: "Syne", sans-serif; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1a1816; }
::-webkit-scrollbar-thumb { background: #3d3936; border-radius: 3px; }
.badge-paid { @apply bg-emerald-900/50 text-emerald-400 border border-emerald-800; }
.badge-unpaid { @apply bg-red-900/50 text-red-400 border border-red-800; }
.badge-partial { @apply bg-amber-900/50 text-amber-400 border border-amber-800; }
@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
.animate-slide-up { animation: slideUp 0.35s ease forwards; }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
.animate-fade-in { animation: fadeIn 0.4s ease forwards; }
'@

Set-Content "tulce-tracker\frontend\src\main.jsx" @'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
'@

Set-Content "tulce-tracker\frontend\src\api.js" @'
import axios from "axios";
const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use(config => { const token = localStorage.getItem("tulce_token"); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(res => res, err => { if ([401,403].includes(err.response?.status)) { localStorage.removeItem("tulce_token"); window.location.href = "/login"; } return Promise.reject(err); });
export default api;
'@

Set-Content "tulce-tracker\frontend\src\App.jsx" @'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import Layout from "./components/Layout";
function ProtectedRoute({ children }) { const { isLoggedIn } = useAuth(); return isLoggedIn ? children : <Navigate to="/login" replace />; }
function AppRoutes() { const { isLoggedIn } = useAuth(); return (<Routes><Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />} /><Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}><Route index element={<DashboardPage />} /><Route path="customers" element={<CustomersPage />} /><Route path="customers/:id" element={<CustomerDetailPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>); }
export default function App() { return (<AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>); }
'@

Set-Content "tulce-tracker\frontend\src\context\AuthContext.jsx" @'
import { createContext, useContext, useState } from "react";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("tulce_token"));
  const [username, setUsername] = useState(() => localStorage.getItem("tulce_user"));
  const login = (tok, user) => { localStorage.setItem("tulce_token", tok); localStorage.setItem("tulce_user", user); setToken(tok); setUsername(user); };
  const logout = () => { localStorage.removeItem("tulce_token"); localStorage.removeItem("tulce_user"); setToken(null); setUsername(null); };
  return <AuthContext.Provider value={{ token, username, login, logout, isLoggedIn: !!token }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
'@

Set-Content "tulce-tracker\frontend\src\components\Layout.jsx" @'
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function Layout() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      <aside className="w-56 flex-shrink-0 flex flex-col bg-dark-800 border-r border-dark-600">
        <div className="px-5 pt-6 pb-5 border-b border-dark-600">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍩</span>
            <div><p className="font-display text-sm font-bold text-tulce-400 tracking-widest uppercase leading-none">Tulce</p><p className="font-display text-xs text-gray-600 tracking-widest uppercase">Tracker</p></div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/" end className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-tulce-500/20 text-tulce-400 border border-tulce-500/30" : "text-gray-400 hover:text-gray-200 hover:bg-dark-700"}`}><span>📊</span> Dashboard</NavLink>
          <NavLink to="/customers" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-tulce-500/20 text-tulce-400 border border-tulce-500/30" : "text-gray-400 hover:text-gray-200 hover:bg-dark-700"}`}><span>👥</span> Customers</NavLink>
        </nav>
        <div className="px-3 pb-4 border-t border-dark-600 pt-3">
          <div className="px-3 py-2 mb-2"><p className="text-xs text-gray-500">Logged in as</p><p className="text-sm font-medium text-gray-300">{username}</p></div>
          <button onClick={() => { logout(); navigate("/login"); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"><span>🚪</span> Logout</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto"><Outlet /></main>
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\pages\LoginPage.jsx" @'
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
export default function LoginPage() {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const { login } = useAuth(); const navigate = useNavigate();
  const handleLogin = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await api.post("/auth/login", { username, password }); login(res.data.token, res.data.username); navigate("/"); } catch (err) { setError(err.response?.data?.error || "Login failed."); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4" style={{ backgroundImage: "radial-gradient(ellipse at 30% 50%, rgba(255,122,10,0.06) 0%, transparent 60%)" }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8"><div className="text-5xl mb-4">🍩</div><h1 className="font-display text-3xl font-bold text-white tracking-tight">TULCE TRACKER</h1><p className="text-gray-500 text-sm mt-1">Mandazi debt management, sorted.</p></div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
            <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
            {error && <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-2.5 rounded-lg">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm">{loading ? "Logging in..." : "Login →"}</button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">First time? Run the seed command in README.md</p>
      </div>
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\pages\DashboardPage.jsx" @'
import { useState, useEffect } from "react";
import api from "../api";
import NewOrderModal from "../components/NewOrderModal";
function StatCard({ icon, label, value, sub, accent }) {
  return (<div className={`bg-dark-800 border ${accent||"border-dark-600"} rounded-xl p-4`}><div className="flex items-start justify-between"><div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p><p className="font-display text-2xl font-bold text-white">{value}</p>{sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}</div><span className="text-2xl">{icon}</span></div></div>);
}
function StatusBadge({ status }) {
  const map = { PAID:"badge-paid", UNPAID:"badge-unpaid", PARTIAL:"badge-partial" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]||"badge-unpaid"}`}>{status}</span>;
}
export default function DashboardPage() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [showOrderModal, setShowOrderModal] = useState(false);
  const fetchDashboard = async () => { try { const res = await api.get("/dashboard"); setData(res.data); } catch (err) { console.error(err); } finally { setLoading(false); } };
  useEffect(() => { fetchDashboard(); }, []);
  const fmt = (n) => `KES ${Number(n).toFixed(0)}`;
  const fmtDate = (d) => new Date(d+"T00:00:00").toLocaleDateString("en-KE", { weekday:"short", day:"numeric", month:"short" });
  if (loading) return <div className="flex items-center justify-center h-full text-gray-500"><div className="text-center"><div className="text-4xl mb-3">🍩</div><p>Loading...</p></div></div>;
  const { today, debtors, totalDebt, days } = data;
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6"><div><h1 className="font-display text-2xl font-bold text-white">Dashboard</h1><p className="text-gray-500 text-sm">{fmtDate(today.date)} — Today</p></div><button onClick={() => setShowOrderModal(true)} className="bg-tulce-500 hover:bg-tulce-400 text-white font-display font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"><span>+</span> New Order</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon="🍩" label="Tulces Sold" value={today.tulces} sub="today" />
        <StatCard icon="💰" label="Revenue" value={fmt(today.revenue)} sub="today" />
        <StatCard icon="✅" label="Collected" value={fmt(today.collected)} sub="cash + mpesa" accent="border-emerald-800/50" />
        <StatCard icon="⏳" label="Unpaid" value={fmt(today.unpaid)} sub="today" accent={today.unpaid > 0 ? "border-red-800/50" : "border-dark-600"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Today&apos;s Orders</h2>
          {today.orders.length === 0 ? <div className="text-center py-8 text-gray-600"><p className="text-3xl mb-2">🍩</p><p className="text-sm">No orders today yet.</p></div> :
            <div className="space-y-2">{today.orders.map(o => (<div key={o.id} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0"><div><p className="text-sm font-medium text-white">{o.customer.name}</p><p className="text-xs text-gray-500">{o.quantity} tulce{o.quantity!==1?"s":""} × KES 5</p></div><div className="text-right"><p className="text-sm font-medium text-white">{fmt(o.totalAmount)}</p><StatusBadge status={o.status} /></div></div>))}</div>}
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3"><h2 className="font-display text-sm font-semibold text-gray-300 uppercase tracking-wider">Debt Ledger</h2>{totalDebt > 0 && <span className="text-xs text-red-400 font-medium">Total: {fmt(totalDebt)}</span>}</div>
          {debtors.length === 0 ? <div className="text-center py-8 text-gray-600"><p className="text-3xl mb-2">🎉</p><p className="text-sm">Everyone is settled up!</p></div> :
            <div className="space-y-2">{debtors.map(d => (<div key={d.customerId} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0"><p className="text-sm font-medium text-white">{d.name}</p><span className="text-sm font-semibold text-red-400">{fmt(d.debt)}</span></div>))}</div>}
        </div>
      </div>
      {days.length > 0 && (
        <div className="mt-5 bg-dark-800 border border-dark-600 rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Day-by-Day History</h2>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wider"><th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Tulces</th><th className="pb-2 pr-4">Revenue</th><th className="pb-2 pr-4">Collected</th><th className="pb-2">Unpaid</th></tr></thead><tbody>{days.map(day => (<tr key={day.date} className="border-t border-dark-700"><td className="py-2 pr-4 text-gray-300">{fmtDate(day.date)}</td><td className="py-2 pr-4 text-white font-medium">{day.tulces}</td><td className="py-2 pr-4 text-white">{fmt(day.revenue)}</td><td className="py-2 pr-4 text-emerald-400">{fmt(day.collected)}</td><td className={`py-2 font-medium ${day.revenue-day.collected>0?"text-red-400":"text-gray-500"}`}>{fmt(day.revenue-day.collected)}</td></tr>))}</tbody></table></div>
        </div>
      )}
      {showOrderModal && <NewOrderModal onClose={() => setShowOrderModal(false)} onSuccess={() => { setShowOrderModal(false); fetchDashboard(); }} />}
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\pages\CustomersPage.jsx" @'
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import AddCustomerModal from "../components/AddCustomerModal";
export default function CustomersPage() {
  const [customers, setCustomers] = useState([]); const [loading, setLoading] = useState(true); const [showAdd, setShowAdd] = useState(false); const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const fetchCustomers = async () => { try { const res = await api.get("/customers"); setCustomers(res.data); } catch (err) { console.error(err); } finally { setLoading(false); } };
  useEffect(() => { fetchCustomers(); }, []);
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const fmt = (n) => `KES ${Number(n).toFixed(0)}`;
  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6"><div><h1 className="font-display text-2xl font-bold text-white">Customers</h1><p className="text-gray-500 text-sm">{customers.length} customer{customers.length!==1?"s":""}</p></div><button onClick={() => setShowAdd(true)} className="bg-tulce-500 hover:bg-tulce-400 text-white font-display font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"><span>+</span> Add Customer</button></div>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full mb-4 bg-dark-800 border border-dark-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" />
      {loading ? <div className="text-center py-16 text-gray-500">Loading...</div> : filtered.length === 0 ? <div className="text-center py-16"><p className="text-4xl mb-3">👥</p><p className="text-gray-500">{search?"No matches.":"No customers yet."}</p></div> :
        <div className="space-y-2">{filtered.map(c => (<div key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="bg-dark-800 border border-dark-600 hover:border-tulce-500/40 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer transition-all group"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-tulce-500/20 flex items-center justify-center text-tulce-400 font-display font-bold text-sm">{c.name.charAt(0).toUpperCase()}</div><div><p className="text-sm font-semibold text-white group-hover:text-tulce-300 transition-colors">{c.name}</p>{c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}</div></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-xs text-gray-500">Owed</p><p className="text-sm font-medium text-white">{fmt(c.totalOwed)}</p></div><div className="text-right"><p className="text-xs text-gray-500">Debt</p><p className={`text-sm font-bold ${c.debt>0?"text-red-400":"text-emerald-400"}`}>{c.debt>0?fmt(c.debt):"✓ Clear"}</p></div><span className="text-gray-600 group-hover:text-gray-400">→</span></div></div>))}</div>}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); fetchCustomers(); }} />}
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\pages\CustomerDetailPage.jsx" @'
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PaymentModal from "../components/PaymentModal";
function StatusBadge({ status }) {
  const map = { PAID:"badge-paid", UNPAID:"badge-unpaid", PARTIAL:"badge-partial" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>{status}</span>;
}
export default function CustomerDetailPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const [customer, setCustomer] = useState(null); const [loading, setLoading] = useState(true); const [selectedOrder, setSelectedOrder] = useState(null);
  const fetchCustomer = async () => { try { const res = await api.get(`/customers/${id}`); setCustomer(res.data); } catch (err) { console.error(err); } finally { setLoading(false); } };
  useEffect(() => { fetchCustomer(); }, [id]);
  const fmt = (n) => `KES ${Number(n).toFixed(0)}`;
  const fmtDate = (d) => new Date(d+"T00:00:00").toLocaleDateString("en-KE", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const fmtTime = (dt) => new Date(dt).toLocaleTimeString("en-KE", { hour:"2-digit", minute:"2-digit" });
  const handleDeleteOrder = async (oid) => { if (!confirm("Delete this order?")) return; try { await api.delete(`/orders/${oid}`); fetchCustomer(); } catch { alert("Could not delete."); } };
  const handleDeleteCustomer = async () => { if (!confirm(`Delete ${customer.name} and all their data?`)) return; try { await api.delete(`/customers/${id}`); navigate("/customers"); } catch { alert("Could not delete."); } };
  if (loading) return <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>;
  if (!customer) return <div className="flex items-center justify-center h-full text-gray-500">Not found.</div>;
  const sortedDays = Object.keys(customer.ordersByDay).sort((a,b) => b.localeCompare(a));
  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <button onClick={() => navigate("/customers")} className="text-gray-500 hover:text-gray-300 text-sm mb-4 flex items-center gap-1 transition-colors">← Back to Customers</button>
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-tulce-500/20 flex items-center justify-center text-tulce-400 font-display font-bold text-xl">{customer.name.charAt(0).toUpperCase()}</div><div><h1 className="font-display text-xl font-bold text-white">{customer.name}</h1>{customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}</div></div><button onClick={handleDeleteCustomer} className="text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors">Delete</button></div>
        <div className="grid grid-cols-3 gap-3 mt-4"><div className="bg-dark-700 rounded-lg p-3 text-center"><p className="text-xs text-gray-500 mb-1">Total Owed</p><p className="font-display text-lg font-bold text-white">{fmt(customer.totalOwed)}</p></div><div className="bg-dark-700 rounded-lg p-3 text-center"><p className="text-xs text-gray-500 mb-1">Total Paid</p><p className="font-display text-lg font-bold text-emerald-400">{fmt(customer.totalPaid)}</p></div><div className={`rounded-lg p-3 text-center ${customer.debt>0?"bg-red-900/20 border border-red-800/40":"bg-emerald-900/20 border border-emerald-800/40"}`}><p className="text-xs text-gray-500 mb-1">Outstanding</p><p className={`font-display text-lg font-bold ${customer.debt>0?"text-red-400":"text-emerald-400"}`}>{customer.debt>0?fmt(customer.debt):"✓ Clear"}</p></div></div>
      </div>
      <h2 className="font-display text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Order History</h2>
      {sortedDays.length === 0 ? <div className="text-center py-12 text-gray-600"><p className="text-3xl mb-2">🍩</p><p>No orders yet.</p></div> :
        <div className="space-y-4">{sortedDays.map(day => {
          const orders = customer.ordersByDay[day];
          const dayTotal = orders.reduce((s,o) => s+o.totalAmount, 0);
          const dayPaid = orders.reduce((s,o) => s+o.amountPaid, 0);
          const dayDebt = dayTotal - dayPaid;
          return (
            <div key={day} className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-700/50"><div><p className="text-sm font-display font-semibold text-white">{fmtDate(day)}</p><p className="text-xs text-gray-500">{orders.length} order{orders.length!==1?"s":""}</p></div><div className="text-right"><p className="text-xs text-gray-500">Day total: {fmt(dayTotal)}</p>{dayDebt>0?<p className="text-xs text-red-400">Unpaid: {fmt(dayDebt)}</p>:<p className="text-xs text-emerald-400">✓ Fully paid</p>}</div></div>
              <div className="divide-y divide-dark-700">{orders.map(order => (
                <div key={order.id} className="px-4 py-3">
                  <div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className="text-sm text-white font-medium">{order.quantity} tulce{order.quantity!==1?"s":""} × KES 5 = {fmt(order.totalAmount)}</p><StatusBadge status={order.status} /></div><p className="text-xs text-gray-500 mt-0.5">{fmtTime(order.date)}</p></div><div className="flex items-center gap-2">{order.balance>0&&<button onClick={() => setSelectedOrder(order)} className="text-xs bg-tulce-500/20 text-tulce-400 border border-tulce-500/30 hover:bg-tulce-500/30 px-2.5 py-1 rounded-lg transition-colors">Mark Paid</button>}<button onClick={() => handleDeleteOrder(order.id)} className="text-xs text-red-500/60 hover:text-red-400 transition-colors px-1">✕</button></div></div>
                  {order.payments.length>0&&<div className="mt-2 space-y-1">{order.payments.map(p=><div key={p.id} className="flex items-center gap-2 text-xs text-gray-500"><span className={p.method==="MPESA"?"text-green-500":"text-blue-400"}>{p.method==="MPESA"?"📱 M-Pesa":"💵 Cash"}</span><span>+{fmt(p.amount)}</span><span>@ {fmtTime(p.paidAt)}</span></div>)}</div>}
                  {order.balance>0&&<p className="text-xs text-red-400 mt-1">Balance: {fmt(order.balance)}</p>}
                </div>
              ))}</div>
            </div>
          );
        })}</div>}
      {selectedOrder && <PaymentModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onSuccess={() => { setSelectedOrder(null); fetchCustomer(); }} />}
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\components\AddCustomerModal.jsx" @'
import { useState } from "react";
import api from "../api";
export default function AddCustomerModal({ onClose, onSuccess }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { await api.post("/customers", { name, phone }); onSuccess(); } catch (err) { setError(err.response?.data?.error || "Could not add customer."); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-white mb-4">Add New Customer</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kamau" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Phone (optional)</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors">{loading?"Adding...":"Add Customer"}</button></div>
        </form>
      </div>
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\components\NewOrderModal.jsx" @'
import { useState, useEffect } from "react";
import api from "../api";
const PRICE = 5;
export default function NewOrderModal({ onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]); const [customerId, setCustomerId] = useState(""); const [quantity, setQuantity] = useState(1); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { api.get("/customers").then(res => setCustomers(res.data)).catch(console.error); }, []);
  const handleSubmit = async (e) => { e.preventDefault(); if (!customerId) return setError("Please select a customer."); setError(""); setLoading(true); try { await api.post("/orders", { customerId, quantity }); onSuccess(); } catch (err) { setError(err.response?.data?.error || "Could not create order."); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-white mb-1">New Order</h2>
        <p className="text-gray-500 text-xs mb-4">KES 5 per tulce</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Customer *</label><select value={customerId} onChange={e => setCustomerId(e.target.value)} required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-tulce-500 text-sm"><option value="">Select a customer...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Number of Tulces</label><div className="flex items-center gap-3"><button type="button" onClick={() => setQuantity(q => Math.max(1,q-1))} className="w-10 h-10 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-bold text-lg transition-colors">−</button><input type="number" value={quantity} onChange={e => setQuantity(Math.max(1,parseInt(e.target.value)||1))} min="1" className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white text-center focus:outline-none focus:border-tulce-500 text-sm" /><button type="button" onClick={() => setQuantity(q => q+1)} className="w-10 h-10 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-bold text-lg transition-colors">+</button></div></div>
          <div className="bg-tulce-500/10 border border-tulce-500/20 rounded-lg p-3 flex justify-between items-center"><span className="text-sm text-gray-400">Total amount</span><span className="font-display text-lg font-bold text-tulce-400">KES {quantity*PRICE}</span></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors">{loading?"Creating...":"Record Order"}</button></div>
        </form>
      </div>
    </div>
  );
}
'@

Set-Content "tulce-tracker\frontend\src\components\PaymentModal.jsx" @'
import { useState } from "react";
import api from "../api";
export default function PaymentModal({ order, onClose, onSuccess }) {
  const [method, setMethod] = useState("CASH"); const [amount, setAmount] = useState(order.balance); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); if (!amount||amount<=0) return setError("Enter a valid amount."); setError(""); setLoading(true); try { await api.post("/payments", { orderId:order.id, amount, method }); onSuccess(); } catch (err) { setError(err.response?.data?.error||"Could not record payment."); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-white mb-1">Record Payment</h2>
        <p className="text-gray-500 text-xs mb-4">Outstanding: <span className="text-red-400 font-semibold">KES {order.balance}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Payment Method</label><div className="grid grid-cols-2 gap-2">{["CASH","MPESA"].map(m => (<button key={m} type="button" onClick={() => setMethod(m)} className={`py-3 rounded-lg text-sm font-semibold font-display transition-all ${method===m ? m==="MPESA"?"bg-green-600 text-white border border-green-500":"bg-blue-600 text-white border border-blue-500" : "bg-dark-700 text-gray-400 border border-dark-500 hover:border-gray-500"}`}>{m==="MPESA"?"📱 M-Pesa":"💵 Cash"}</button>))}</div></div>
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Amount (KES)</label><input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} min="1" max={order.balance} step="1" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-tulce-500 text-sm" /><p className="text-xs text-gray-600 mt-1">Max: KES {order.balance}</p></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors">{loading?"Saving...":"Mark as Paid"}</button></div>
        </form>
      </div>
    </div>
  );
}
'@

Write-Host "  [2/4] All files written" -ForegroundColor Green

# ============================================================
#  INSTALL DEPENDENCIES
# ============================================================

Write-Host ""
Write-Host "  Installing backend dependencies..." -ForegroundColor Cyan
Set-Location "tulce-tracker\backend"
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: npm install failed in backend" -ForegroundColor Red; exit 1 }

Write-Host "  Installing frontend dependencies..." -ForegroundColor Cyan
Set-Location "..\frontend"
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: npm install failed in frontend" -ForegroundColor Red; exit 1 }

Set-Location "..\..\"
Write-Host "  [3/4] Dependencies installed" -ForegroundColor Green

# ============================================================
#  DONE
# ============================================================

Write-Host "  [4/4] Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Yellow
Write-Host "   TULCE TRACKER is ready!" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  BEFORE YOU START:" -ForegroundColor White
Write-Host "  1. Open PostgreSQL and run:  CREATE DATABASE tulce_tracker;" -ForegroundColor Gray
Write-Host "  2. Edit backend\.env  and set your PostgreSQL password" -ForegroundColor Gray
Write-Host "  3. Then run these commands:" -ForegroundColor Gray
Write-Host ""
Write-Host "     cd tulce-tracker\backend" -ForegroundColor Cyan
Write-Host "     npx prisma db push" -ForegroundColor Cyan
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  In a NEW terminal:" -ForegroundColor White
Write-Host "     cd tulce-tracker\frontend" -ForegroundColor Cyan
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Then visit:  http://localhost:5173" -ForegroundColor Green
Write-Host "  Seed admin:  POST http://localhost:5000/api/auth/seed" -ForegroundColor Green
Write-Host ""

# 🍩 TULCE TRACKER

> A personal mandazi debt management system. Track who took tulces, how much they owe, and whether they paid — by cash or M-Pesa. Built for the streets of Nairobi.

![Stack](https://img.shields.io/badge/Frontend-React_+_Vite-61DAFB?style=flat-square&logo=react)
![Stack](https://img.shields.io/badge/Backend-Node.js_+_Express-339933?style=flat-square&logo=node.js)
![Stack](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat-square&logo=postgresql)
![Stack](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat-square&logo=prisma)

---

## 📸 What It Does

You sell mandazis (tulces) to your colleagues at **KES 5 each**. At the end of the day you need to know:

- Who bought how many tulces today
- Who paid (cash or M-Pesa) and who didn't
- How much each person owes in total across all days
- A customer's full payment pattern over time — day by day

TULCE TRACKER handles all of that in a clean, fast, mobile-friendly dashboard.

---

## ✨ Features

- 🔐 **Secure login** — JWT-based authentication, bcrypt-hashed password
- 👥 **Customer management** — add, view, and delete customers
- 🍩 **Order recording** — pick a customer, set quantity, total auto-calculates
- 💰 **Payment tracking** — mark orders as paid via Cash or M-Pesa (supports partial payments)
- 📊 **Live dashboard** — today's tulces sold, revenue, collected, and unpaid at a glance
- 🔴 **Debt ledger** — see every customer who owes money and exactly how much
- 📅 **Day-by-day history** — orders are grouped by date so days never mix
- 📱 **Mobile responsive** — works on your phone on the same WiFi network
- 🗃️ **PostgreSQL** — real relational database, query your data directly in pgAdmin

---

## 🛠 Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18 + Vite + Tailwind CSS    |
| Backend    | Node.js + Express                 |
| Database   | PostgreSQL (local)                |
| ORM        | Prisma                            |
| Auth       | JSON Web Tokens + bcryptjs        |
| Fonts      | Syne (display) + DM Sans (body)   |

---

## 📁 Project Structure

```
tulce-tracker/
├── backend/
│   ├── middleware/
│   │   └── auth.js              # JWT verification middleware
│   ├── prisma/
│   │   └── schema.prisma        # Database schema (4 models)
│   ├── routes/
│   │   ├── auth.js              # Login + admin seed
│   │   ├── customers.js         # CRUD customers + debt calc
│   │   ├── dashboard.js         # Today summary + debt ledger
│   │   ├── orders.js            # Record tulce orders
│   │   └── payments.js          # Cash / M-Pesa payments
│   ├── .env                     # DB credentials (not in git)
│   ├── index.js                 # Express app entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddCustomerModal.jsx
│   │   │   ├── Layout.jsx       # Sidebar + mobile nav
│   │   │   ├── NewOrderModal.jsx
│   │   │   └── PaymentModal.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Global auth state
│   │   ├── pages/
│   │   │   ├── CustomerDetailPage.jsx  # Day-by-day order history
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── api.js               # Axios instance with JWT headers
│   │   ├── App.jsx              # Routes + protected routes
│   │   ├── index.css            # Tailwind + custom styles
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

---

## 🗃️ Database Schema

```
Admin       id · username · password (hashed) · createdAt
Customer    id · name · phone? · createdAt
Order       id · customerId · quantity · unitPrice(5) · totalAmount · date · dayLabel
Payment     id · orderId · amount · method (CASH | MPESA) · paidAt
```

Relationships:
- A **Customer** has many **Orders**
- An **Order** has many **Payments** (supports partial payments)
- Debt = `SUM(orders.totalAmount) - SUM(payments.amount)`

---

## ⚙️ Local Setup

### Prerequisites

Make sure you have these installed:

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) (local install)
- [pgAdmin](https://www.pgadmin.org/) (optional, for viewing data)

---

### 1. Create the PostgreSQL Database

Open pgAdmin or psql and run:

```sql
CREATE DATABASE tulce_tracker;
```

---

### 2. Configure Environment Variables

Open `backend/.env` and update with your credentials:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/tulce_tracker"
JWT_SECRET="choose-any-long-secret-string"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-chosen-password"
PORT=5000
```

> ⚠️ Never commit `.env` to GitHub. It is already covered by `.gitignore`.

---

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

### 4. Push the Database Schema

```bash
cd backend
npx prisma db push
```

Expected output:
```
Your database is now in sync with your Prisma schema.
```

---

### 5. Create Your Admin Account

Start the backend first:

```bash
npm run dev
```

Then seed the admin account (run **once only**):

```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:5000/api/auth/seed" -Method POST
```

Expected response:
```json
{ "message": "Admin created! You can now log in." }
```

---

### 6. Start the Frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

---

### 7. Open the App

Visit **http://localhost:5173** and log in with the credentials from your `.env`.

---

## 📱 Access From Your Phone

To use the app on your phone over the same WiFi network:

**1. Find your PC's local IP:**
```powershell
ipconfig
# Look for IPv4 Address e.g. 192.168.1.5
```

**2. Add `host: true` to `frontend/vite.config.js`:**
```js
server: {
  port: 5173,
  host: true,
  ...
}
```

**3. Allow ports through Windows Firewall (run as Administrator):**
```powershell
netsh advfirewall firewall add rule name="Tulce Frontend" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="Tulce Backend" dir=in action=allow protocol=TCP localport=5000
```

**4. On your phone browser**, open:
```
http://192.168.1.5:5173
```

> Your PC must be on and running for phone access to work.

---

## 🔧 Useful Commands

```bash
# Start backend (from /backend)
npm run dev

# Start frontend (from /frontend)
npm run dev

# View and edit your database visually in the browser
cd backend && npx prisma studio

# Re-sync schema after any changes to schema.prisma
npx prisma db push

# Reset entire database — WARNING: deletes all data
npx prisma db push --force-reset
```

---

## 🗄️ Useful pgAdmin Queries

**Debt per customer:**
```sql
SELECT
  c.name,
  SUM(o."totalAmount") AS total_owed,
  COALESCE(SUM(p.amount), 0) AS total_paid,
  SUM(o."totalAmount") - COALESCE(SUM(p.amount), 0) AS debt
FROM "Customer" c
JOIN "Order" o ON o."customerId" = c.id
LEFT JOIN "Payment" p ON p."orderId" = o.id
GROUP BY c.name
ORDER BY debt DESC;
```

**Sales by day:**
```sql
SELECT
  o."dayLabel" AS date,
  SUM(o.quantity) AS tulces_sold,
  SUM(o."totalAmount") AS revenue,
  COALESCE(SUM(p.amount), 0) AS collected,
  SUM(o."totalAmount") - COALESCE(SUM(p.amount), 0) AS unpaid
FROM "Order" o
LEFT JOIN "Payment" p ON p."orderId" = o.id
GROUP BY o."dayLabel"
ORDER BY o."dayLabel" DESC;
```

**Full order breakdown with payment status:**
```sql
SELECT
  c.name,
  o."dayLabel",
  o.quantity,
  o."totalAmount",
  COALESCE(SUM(p.amount), 0) AS paid,
  o."totalAmount" - COALESCE(SUM(p.amount), 0) AS balance,
  CASE
    WHEN SUM(p.amount) >= o."totalAmount" THEN 'PAID'
    WHEN SUM(p.amount) > 0 THEN 'PARTIAL'
    ELSE 'UNPAID'
  END AS status
FROM "Order" o
JOIN "Customer" c ON o."customerId" = c.id
LEFT JOIN "Payment" p ON p."orderId" = o.id
GROUP BY c.name, o."dayLabel", o.quantity, o."totalAmount"
ORDER BY o."dayLabel" DESC, c.name;
```

---

## 🚀 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and receive JWT token |
| POST | `/api/auth/seed` | Create admin account (once only) |
| GET | `/api/dashboard` | Today's summary + full debt ledger |
| GET | `/api/customers` | List all customers with debt totals |
| POST | `/api/customers` | Add a new customer |
| GET | `/api/customers/:id` | Customer detail + order history by day |
| DELETE | `/api/customers/:id` | Delete customer and all their data |
| GET | `/api/orders` | List orders (filter by `?date=YYYY-MM-DD`) |
| POST | `/api/orders` | Record a new tulce order |
| DELETE | `/api/orders/:id` | Delete an order |
| POST | `/api/payments` | Record a payment (Cash or M-Pesa) |
| DELETE | `/api/payments/:id` | Undo a payment |

---

## 👤 CapMojay

Built for personal use — managing mandazi sales at the workplace.
Nairobi, Kenya 🇰🇪

---

*Powered by PostgreSQL. Fueled by Cap.* 🍩
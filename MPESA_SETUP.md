# 📱 M-Pesa STK Push Setup Guide

## Overview

This guide gets you from zero to receiving real M-Pesa payments via STK Push (the popup that appears on a customer's phone).

---

## Step 1 — Register on Safaricom Daraja

1. Go to **https://developer.safaricom.co.ke**
2. Create an account and log in
3. Click **"Add a New App"**
4. Give it a name (e.g. "Tulce Tracker") and tick **Lipa Na M-Pesa**
5. You'll get a **Consumer Key** and **Consumer Secret** — copy these

---

## Step 2 — Get Your Credentials

For a **Till Number (Buy Goods)**, you need:

| Credential | Where to get it |
|---|---|
| `MPESA_CONSUMER_KEY` | Daraja app dashboard |
| `MPESA_CONSUMER_SECRET` | Daraja app dashboard |
| `MPESA_SHORTCODE` | Your actual Till Number |
| `MPESA_PASSKEY` | Contact Safaricom Business support or get from Daraja sandbox settings |

For **sandbox testing**, Safaricom provides test credentials on the Daraja portal under "Test Credentials".

---

## Step 3 — Install & Start ngrok

ngrok gives your localhost a public HTTPS URL so Safaricom can send payment callbacks to it.

**Install ngrok:**
```
https://ngrok.com/download
```
Download, extract, and add to your PATH. Or use Chocolatey:
```powershell
choco install ngrok
```

**Sign up** at https://ngrok.com (free) and get your auth token:
```powershell
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

**Start ngrok** (every time you develop):
```powershell
ngrok http 5000
```

You'll see output like:
```
Forwarding  https://abc123def456.ngrok-free.app -> http://localhost:5000
```

Copy that HTTPS URL.

---

## Step 4 — Update Your .env

Open `backend/.env` and fill in your credentials:

```env
MPESA_CONSUMER_KEY="paste_your_consumer_key"
MPESA_CONSUMER_SECRET="paste_your_consumer_secret"
MPESA_SHORTCODE="your_till_number"
MPESA_PASSKEY="your_passkey"
MPESA_ENV="sandbox"   # change to "live" when going live

# Update this EVERY TIME you restart ngrok (the URL changes)
MPESA_CALLBACK_URL="https://abc123def456.ngrok-free.app/api/mpesa/callback"
```

> ⚠️ The ngrok URL changes every time you restart it on the free plan.
> You must update `MPESA_CALLBACK_URL` in `.env` and restart the backend each time.

---

## Step 5 — Push the Updated Schema

The M-Pesa integration adds a new `MpesaTransaction` table and updates the `Payment` model.

```powershell
cd backend
npx prisma db push
```

---

## Step 6 — Restart the Backend

```powershell
npm run dev
```

You should see:
```
🍩 TULCE TRACKER backend running on http://localhost:5000
📱 M-Pesa callback: https://abc123def456.ngrok-free.app/api/mpesa/callback
```

---

## Step 7 — Test It

1. Open the app → go to a customer's order → click **"Mark Paid"**
2. Select the **📱 STK Push** tab
3. Enter a phone number (use your own number for testing)
4. Click **"Send Request"**
5. You should get an M-Pesa popup on the phone
6. Enter PIN → payment auto-records in the app

---

## Going Live (Switching from Sandbox to Live)

1. Change `MPESA_ENV="live"` in `.env`
2. Replace sandbox credentials with your live credentials from Daraja
3. Make sure your `MPESA_SHORTCODE` is your real Till Number
4. Deploy your backend to a public server (or keep using ngrok)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Daraja auth failed" | Check Consumer Key and Secret in `.env` |
| STK Push sends but no popup | Check the phone number format (must be 07XX or 254XX) |
| Callback never arrives | Check ngrok is running and URL in `.env` matches |
| "Transaction not found" in callback | The CheckoutRequestID didn't save — check DB connection |
| Payment confirmed but not recorded | Check backend logs for callback processing errors |

---

## How to View M-Pesa Transactions in pgAdmin

```sql
-- All STK Push requests
SELECT * FROM "MpesaTransaction" ORDER BY "createdAt" DESC;

-- Only successful ones
SELECT * FROM "MpesaTransaction" WHERE status = 'SUCCESS' ORDER BY "createdAt" DESC;

-- Payments with M-Pesa receipt numbers
SELECT p.*, p."mpesaRef", c.name
FROM "Payment" p
JOIN "Order" o ON p."orderId" = o.id
JOIN "Customer" c ON o."customerId" = c.id
WHERE p.method = 'MPESA_STK'
ORDER BY p."paidAt" DESC;
```

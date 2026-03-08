const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");
// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { username } });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );

    res.json({ token, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login." });
  }
});

// POST /api/auth/seed  — run once to create your admin account
router.post("/seed", async (req, res) => {
  try {
    const existing = await prisma.admin.findUnique({
      where: { username: process.env.ADMIN_USERNAME },
    });

    if (existing) {
      return res.json({ message: "Admin already exists." });
    }

    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await prisma.admin.create({
      data: {
        username: process.env.ADMIN_USERNAME,
        password: hashed,
      },
    });

    res.json({ message: "Admin created successfully! You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not seed admin." });
  }
});

module.exports = router;

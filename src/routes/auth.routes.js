// src/routes/auth.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { signJwt } = require("../utils/jwt");
const User = require("../models/User");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, role = "client" } = req.body || {};

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!isValidEmail(email))
      return res.status(400).json({ message: "Invalid email" });
    if (String(password).length < 6)
      return res.status(400).json({ message: "Password too short" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role,
    });

    const token = signJwt({
      uid: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const normalizedEmail = String(email).toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isLocked =
      user.lockUntil && user.lockUntil instanceof Date && user.lockUntil > Date.now();

    if (isLocked) {
      return res
        .status(429)
        .json({ message: "Too many attempts. Try again later." });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);

    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
      }

      await user.save();

      const msg =
        user.lockUntil && user.lockUntil > Date.now()
          ? "Too many attempts. Try again later."
          : "Invalid credentials";

      return res.status(400).json({ message: msg });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = signJwt({
      uid: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
});

module.exports = router;

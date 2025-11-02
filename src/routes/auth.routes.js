// src/routes/auth.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { signJwt } = require("../utils/jwt");
const User = require("../models/User");

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

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok)
      return res.status(400).json({ message: "Invalid credentials" });

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

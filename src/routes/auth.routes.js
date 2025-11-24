// src/routes/auth.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { signJwt } = require("../utils/jwt");
const User = require("../models/User");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(to, code) {
  const appName = process.env.APP_NAME || "FlexiDesk";
  const from = process.env.SMTP_FROM || `"${appName}" <no-reply@example.com>`;
  const subject = `${appName} verification code`;
  const text = `Your ${appName} verification code is: ${code}\n\nThis code will expire in 10 minutes.`;
  const html = `
    <p>Your ${appName} verification code is:</p>
    <p style="font-size:20px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>This code will expire in 10 minutes.</p>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, role = "client" } = req.body || {};

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password too short" });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const otpCode = generateOtp();
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);

    const user = await User.create({
      fullName,
      email: String(email).toLowerCase(),
      passwordHash,
      role,
      emailVerified: false,
      emailVerificationCode: otpCode,
      emailVerificationExpires: otpExpires,
    });

    try {
      await sendVerificationEmail(user.email, otpCode);
    } catch (mailErr) {
      console.error("Verification email error:", mailErr);
      return res
        .status(500)
        .json({ message: "Unable to send verification email. Please try again later." });
    }

    res.status(201).json({
      message: "Registration successful. Check your email for the verification code.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
});

// SHARED VERIFY HANDLER (used by /verify-email and /verify-otp)
async function verifyEmailHandler(req, res) {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const normalizedEmail = String(email).toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or code" });
    }

    if (user.emailVerified) {
      // Still return a token so the client can log in if needed
      const token = signJwt({
        uid: user.id,
        email: user.email,
        role: user.role,
      });

      return res.json({
        message: "Email already verified.",
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      });
    }

    if (
      !user.emailVerificationCode ||
      !user.emailVerificationExpires ||
      user.emailVerificationCode !== String(code).trim() ||
      user.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.emailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    await user.save();

    const token = signJwt({
      uid: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      message: "Email verified successfully.",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (e) {
    console.error("Verify email error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
}

// For compatibility and clarity: both paths use the same logic
router.post("/verify-email", verifyEmailHandler);
router.post("/verify-otp", verifyEmailHandler);

// RESEND OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = String(email).toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "Account not found for this email" });
    }

    if (user.emailVerified) {
      return res
        .status(400)
        .json({ message: "Email is already verified. You can sign in instead." });
    }

    const otpCode = generateOtp();
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);

    user.emailVerificationCode = otpCode;
    user.emailVerificationExpires = otpExpires;
    await user.save();

    try {
      await sendVerificationEmail(user.email, otpCode);
    } catch (mailErr) {
      console.error("Resend verification email error:", mailErr);
      return res
        .status(500)
        .json({ message: "Unable to send verification email. Please try again later." });
    }

    res.json({
      message: "A new verification code has been sent to your email.",
    });
  } catch (e) {
    console.error("Resend OTP error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const normalizedEmail = String(email).toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email before signing in." });
    }

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
        emailVerified: user.emailVerified,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
});

module.exports = router;

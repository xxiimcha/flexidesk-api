// server/admins/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const {
  JWT_SECRET = "dev_secret_change_me",
  JWT_EXPIRES = "7d",         // used when remember === true
  NODE_ENV = "development",
} = process.env;

function sign({ id, email, role, remember }) {
  // Shorter expiry if "remember" is off
  const expiresIn = remember ? JWT_EXPIRES : "1d";
  return jwt.sign({ uid: id, email, role }, JWT_SECRET, { expiresIn });
}

exports.login = async (req, res) => {
  try {
    const { email, password, remember } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).lean();
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Account is not an admin." });
    }

    const idStr = String(user._id);
    const token = sign({ id: idStr, email: user.email, role: user.role, remember: !!remember });

    // httpOnly cookie
    res.cookie("adm_sess", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: NODE_ENV === "production",
      ...(remember ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}), // 7 days if remember
      path: "/",
    });

    return res.json({
      token,
      user: {
        id: idStr,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        avatar: user.avatar || null,
      },
    });
  } catch (e) {
    console.error("admins/login error:", e);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.me = async (req, res) => {
  try {
    const u = await User.findById(req.user.uid, "email role fullName avatar").lean();
    if (!u) return res.status(404).json({ error: "Not found" });

    return res.json({
      user: {
        id: String(req.user.uid),
        email: u.email,
        role: u.role,
        fullName: u.fullName,
        avatar: u.avatar || null,
      },
    });
  } catch (e) {
    console.error("admins/me error:", e);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.logout = (_req, res) => {
  res.clearCookie("adm_sess", { path: "/" });
  return res.json({ ok: true });
};

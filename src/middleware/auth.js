// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const { isValidObjectId, Types } = require("mongoose");

const { JWT_SECRET = "dev_secret_change_me" } = process.env;

function readToken(req) {
  // 1) Authorization header
  const hdr = req.headers.authorization || "";
  if (hdr.startsWith("Bearer ")) return hdr.slice(7);

  // 2) Cookies (requires cookie-parser in server.js)
  if (req.cookies?.adm_sess) return req.cookies.adm_sess; // admin cookie
  if (req.cookies?.sess) return req.cookies.sess;         // generic cookie (optional)

  return null;
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized: missing token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const rawId = decoded.uid || decoded.id || decoded.userId;
    if (!rawId) return res.status(401).json({ error: "Unauthorized: bad token payload" });

    // normalize user id representation
    const uid = isValidObjectId(rawId) ? new Types.ObjectId(rawId) : rawId;

    req.user = {
      uid,                                 // normalized id
      email: decoded.email || null,
      role: decoded.role || null,
    };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// ✅ support both styles:
//  - const { requireAuth, requireAdmin } = require("./middleware/auth");
//  - const requireAuth = require("./middleware/auth");
module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;

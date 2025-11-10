// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const { isValidObjectId, Types } = require("mongoose");

const {
  JWT_SECRET = "dev_secret_change_me",
  ADMIN_JWT_SECRET = process.env.JWT_SECRET, // fallback so devs don't get locked out
} = process.env;

function readToken(req) {
  const hdr = req.headers.authorization || req.headers.Authorization || "";
  if (/^Bearer\s+/i.test(hdr)) return hdr.replace(/^Bearer\s+/i, "").trim();

  if (req.cookies?.adm_sess) return req.cookies.adm_sess; // admin cookie
  if (req.cookies?.sess) return req.cookies.sess;         // generic cookie

  return null;
}

function verifyWithAnySecret(token) {
  const secrets = [JWT_SECRET, ADMIN_JWT_SECRET].filter(Boolean);
  let lastErr;
  for (const secret of secrets) {
    try {
      return { decoded: jwt.verify(token, secret), usedSecret: secret === ADMIN_JWT_SECRET ? "ADMIN_JWT_SECRET" : "JWT_SECRET" };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Token verification failed");
}

function normalizeUser(decoded) {
  const rawId = decoded.uid || decoded.id || decoded.userId;
  const uid = isValidObjectId(rawId) ? new Types.ObjectId(rawId) : rawId;
  return {
    uid,
    email: decoded.email || null,
    role: decoded.role || null,
  };
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized: missing token" });

    const { decoded, usedSecret } = verifyWithAnySecret(token);
    const rawId = decoded?.uid || decoded?.id || decoded?.userId;
    if (!rawId) return res.status(401).json({ error: "Unauthorized: bad token payload" });

    req.user = normalizeUser(decoded);
    console.log("[requireAuth] ok", { uid: String(req.user.uid), role: req.user.role, usedSecret });

    next();
  } catch (err) {
    console.error("Auth error:", err?.message || err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;

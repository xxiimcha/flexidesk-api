const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

module.exports = function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing auth token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const rawId = decoded.id || decoded.userId;
    if (!rawId) return res.status(401).json({ message: "Invalid token payload" });

    let userId = rawId;
    if (mongoose.isValidObjectId(rawId)) userId = new mongoose.Types.ObjectId(rawId);

    req.user = { id: userId, email: decoded.email || null, role: decoded.role || null };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

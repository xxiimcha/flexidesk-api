const jwt = require("jsonwebtoken");

module.exports = function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    // Header format: "Bearer <token>"
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: no token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(403).json({ message: "Invalid token" });
    }

    // Attach decoded info to request
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

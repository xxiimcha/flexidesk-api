const { verifyJwt } = require("../utils/jwt");

module.exports = function requireUser(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    req.user = verifyJwt(token);
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

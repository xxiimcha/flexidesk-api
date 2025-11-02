module.exports = function requireRole(...allowed) {
  return function (req, res, next) {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

const router = require("express").Router();
const requireUser = require("../middleware/requireUser");
const User = require("../models/User");

// GET /api/users/me
router.get("/me", requireUser, async (req, res) => {
  const u = await User.findById(req.user.uid).select("fullName email role avatar createdAt");
  res.json({ user: u });
});

module.exports = router;

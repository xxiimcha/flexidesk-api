const router = require("express").Router();
const requireUser = require("../../middleware/requireUser");
const User = require("../../models/User");
const { signJwt } = require("../../utils/jwt");

// POST /api/owner/ensure-owner
// If current user isn't an owner yet, promote to owner and return a fresh JWT.
router.post("/ensure-owner", requireUser, async (req, res) => {
  try {
    const u = await User.findById(req.user.uid);
    if (!u) return res.status(404).json({ message: "User not found" });

    if (u.role !== "owner") {
      u.role = "owner";
      await u.save();
    }

    const token = signJwt({ uid: u.id, email: u.email, role: u.role });
    res.json({
      token,
      user: { id: u.id, email: u.email, role: u.role, fullName: u.fullName },
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to ensure owner role" });
  }
});

module.exports = router;

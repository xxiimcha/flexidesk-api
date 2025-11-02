const router = require("express").Router();
const requireUser = require("../../middleware/requireUser");
// remove requireRole here OR keep it and include client as allowed
// const requireRole = require("../../middleware/requireRole");
const Listing = require("../../models/Listing");
const User = require("../../models/User");
const { signJwt } = require("../../utils/jwt");

// POST /api/owner/listings
// Allow both client and owner. If client, auto-upgrade to owner and return a new JWT.
router.post("/", requireUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let upgradedToken = null;
    if (user.role === "client") {
      user.role = "owner";
      await user.save();
      upgradedToken = signJwt({ uid: user.id, email: user.email, role: user.role });
    }

    const listing = await Listing.create({
      owner: user._id,
      ...req.body,
      status: "draft",
    });

    // send new token only if we upgraded
    res.json({
      id: String(listing._id),
      ...(upgradedToken ? { token: upgradedToken } : {}),
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Create failed" });
  }
});

module.exports = router;

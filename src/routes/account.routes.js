const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/account.controller");
const {
  uploadAvatar,
  uploadIdentity,
} = require("../middleware/uploadCloudinary");

router.get("/", requireAuth, ctrl.getAccount);

router.put(
  "/profile",
  requireAuth,
  uploadAvatar.single("avatar"),
  ctrl.updateProfile
);

router.put("/preferences", requireAuth, ctrl.updatePreferences);

router.post(
  "/identity-docs",
  requireAuth,
  uploadIdentity.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  ctrl.uploadIdentityDocs
);

module.exports = router;

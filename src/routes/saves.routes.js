const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const saves = require("../controllers/saves.controller");

router.get("/users/me/saves/:listingId", requireAuth, saves.check);
router.put("/users/me/saves/:listingId", requireAuth, saves.save);
router.delete("/users/me/saves/:listingId", requireAuth, saves.unsave);

module.exports = router;

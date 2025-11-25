const router = require("express").Router();
const requireUser = require("../middleware/requireUser");
const ctrl = require("../controllers/saves.controller");

router.use(requireUser);

router.get("/", ctrl.list);
router.get("/saves/:listingId/check", ctrl.check);
router.post("/saves/:listingId", ctrl.save);
router.delete("/saves/:listingId", ctrl.unsave);

module.exports = router;

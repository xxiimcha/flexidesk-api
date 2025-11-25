// routes/saves.routes.js
const router = require("express").Router();
const requireUser = require("../middleware/requireUser");
const ctrl = require("../controllers/saves.controller");

router.use(requireUser);

// GET /api/saves
router.get("/", ctrl.list);

// GET /api/saves/:listingId  -> { saved: boolean }
router.get("/:listingId", ctrl.check);

// PUT /api/saves/:listingId  -> save
router.put("/:listingId", ctrl.save);

// DELETE /api/saves/:listingId  -> unsave
router.delete("/:listingId", ctrl.unsave);

module.exports = router;

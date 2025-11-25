const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const ctrl = require("../controllers/bookings.controller");

router.get("/", requireAuth, requireAdmin, ctrl.list);
router.patch("/:id", requireAuth, requireAdmin, ctrl.update);

module.exports = router;

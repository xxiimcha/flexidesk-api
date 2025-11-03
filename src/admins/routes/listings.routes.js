const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const ctrl = require("../controllers/listings.controller");

router.get("/", requireAuth, requireAdmin, ctrl.list);
router.get("/:id", requireAuth, requireAdmin, ctrl.getOne);
router.post("/", requireAuth, requireAdmin, ctrl.create);
router.put("/:id", requireAuth, requireAdmin, ctrl.update);
router.patch("/:id/status", requireAuth, requireAdmin, ctrl.updateStatus);
router.delete("/:id", requireAuth, requireAdmin, ctrl.remove);

module.exports = router;

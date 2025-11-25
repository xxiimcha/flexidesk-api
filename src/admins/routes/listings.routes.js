const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const ctrl = require("../controllers/listings.controller");
const usersCtrl = require("../controllers/users.controller");

router.get("/", requireAuth, requireAdmin, ctrl.list);
router.get("/:id", requireAuth, requireAdmin, ctrl.getOne);
router.post("/", requireAuth, requireAdmin, ctrl.create);
router.put("/:id", requireAuth, requireAdmin, ctrl.update);
router.patch("/:id/status", requireAuth, requireAdmin, ctrl.updateStatus);
router.patch("/:id/featured", requireAuth, requireAdmin, ctrl.updateFeatured);
router.delete("/:id", requireAuth, requireAdmin, ctrl.remove);

router.post("/:id/approve", usersCtrl.approveListing);
router.post("/:id/reject", usersCtrl.rejectListing);

module.exports = router;

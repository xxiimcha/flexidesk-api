// routes/inquiries.routes.js
const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const ctrl = require("../controllers/inquiries.controller");

router.post("/", requireAuth, ctrl.createInquiry);
router.get("/", requireAuth, ctrl.listMyInquiries);
router.get("/:id", requireAuth, ctrl.getInquiry);
router.post("/:id/reply", requireAuth, ctrl.replyInquiry);
router.patch("/:id/read", requireAuth, ctrl.markInquiryRead);
router.patch("/:id/status", requireAuth, ctrl.setInquiryStatus);

module.exports = router;

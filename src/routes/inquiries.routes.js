// routes/inquiries.routes.js
const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const ctl = require("../controllers/inquiries.controller");

router.get("/", requireAuth, ctl.listMyInquiries);

router.get("/:id", requireAuth, ctl.getInquiry);

router.get("/:id/messages", requireAuth, ctl.getInquiryMessages);

router.post("/:id/reply", requireAuth, ctl.replyInquiry);

router.patch("/:id/read", requireAuth, ctl.markInquiryRead);

router.patch("/:id/status", requireAuth, ctl.setInquiryStatus);

router.post("/", requireAuth, ctl.createInquiry);

module.exports = router;

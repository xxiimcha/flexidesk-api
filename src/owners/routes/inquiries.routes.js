// src/owners/routes/inquiries.routes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../middleware/auth");
const {
  getOwnerInquiriesMine,
  getOwnerInquiryById,
  replyOwnerInquiry,
} = require("../controllers/owner.inquiries.controller");

router.get("/mine", requireAuth, getOwnerInquiriesMine);
router.get("/:id", requireAuth, getOwnerInquiryById);
router.post("/:id/reply", requireAuth, replyOwnerInquiry);

module.exports = router;

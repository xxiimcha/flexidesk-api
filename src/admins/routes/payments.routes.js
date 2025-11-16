// src/admins/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const {
  listAdminPayments,
  capturePayment,
  refundPayment,
} = require("../controllers/payments.controller");

// All routes here are admin-protected
router.get("/payments", requireAuth, requireAdmin, listAdminPayments);
router.post(
  "/payments/:paymentId/capture",
  requireAuth,
  requireAdmin,
  capturePayment
);
router.post(
  "/payments/:paymentId/refund",
  requireAuth,
  requireAdmin,
  refundPayment
);

module.exports = router;

// src/routes/adminReports.routes.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const adminReports = require("../controllers/reports.controller");

router.get(
  "/workspace-performance",
  requireAuth,
  requireAdmin,
  adminReports.getWorkspacePerformance,
);

module.exports = router;

const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const users = require("../controllers/users.controller");

// all routes here are admin-protected
router.use(requireAuth, requireAdmin);

// GET /api/admin/users
router.get("/", users.listUsers);

// POST /api/admin/users/:id/verify
router.post("/:id/verify", users.verifyUserId);

// GET /api/admin/users/:id/pending-listings
router.get("/:id/pending-listings", users.getPendingListingsByOwner);

// GET /api/admin/users/:id/logs
router.get("/:id/logs", users.getVerificationLogs);

module.exports = router;

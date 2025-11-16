const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const casesController = require("../controllers/cases.controller");

router.use(requireAuth, requireAdmin);

router.get("/", casesController.listCases);
router.patch("/:id/assign", casesController.assignCase);
router.patch("/:id/status", casesController.updateCaseStatus);
router.patch("/:id/notes", casesController.updateCaseNotes);
router.patch("/:id/refund", casesController.recordCaseRefund);
router.patch("/:id/evidence", casesController.addCaseEvidence);

module.exports = router;

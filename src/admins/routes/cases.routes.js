const express = require("express");
const router = express.Router();

const {
  listCases,
  assignCase,
  updateCaseStatus,
  updateCaseNotes,
  recordCaseRefund,
  addCaseEvidence,
} = require("../controllers/cases.controller");

router.get("/cases", listCases);
router.patch("/cases/:id/assign", assignCase);
router.patch("/cases/:id/status", updateCaseStatus);
router.patch("/cases/:id/notes", updateCaseNotes);
router.patch("/cases/:id/refund", recordCaseRefund);
router.patch("/cases/:id/evidence", addCaseEvidence);

module.exports = router;

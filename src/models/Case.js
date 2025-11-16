const mongoose = require("mongoose");

const TimelineEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, required: true },
    to: { type: String },
    amount: { type: Number },
    reason: { type: String },
  },
  { _id: false }
);

const EvidenceEntrySchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: String, default: "admin" },
  },
  { _id: false }
);

const RefundSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String },
  },
  { _id: false }
);

const CaseSchema = new mongoose.Schema(
  {
    referenceCode: { type: String },
    bookingRef: { type: String },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    userEmail: { type: String },
    userName: { type: String },
    hostEmail: { type: String },
    type: {
      type: String,
      enum: ["dispute", "refund_request", "violation_report"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "under_review", "awaiting_evidence", "resolved", "rejected", "refunded"],
      default: "open",
    },
    assignee: { type: String },
    reportedByRole: {
      type: String,
      enum: ["user", "host", "system"],
    },
    summary: { type: String },
    adminNotes: { type: String },
    refund: RefundSchema,
    timeline: [TimelineEntrySchema],
    evidence: [EvidenceEntrySchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Case", CaseSchema);

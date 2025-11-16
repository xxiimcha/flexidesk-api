// src/models/VerificationLog.js
const mongoose = require("mongoose");

const VerificationLogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["user_id", "listing"], required: true },
    action: { type: String, enum: ["approve", "reject"], required: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },

    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VerificationLog", VerificationLogSchema);

// src/models/Booking.js
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },

    // Core schedule
    startDate: { type: String, required: true }, // ISO date string (YYYY-MM-DD)
    endDate:   { type: String, required: true }, // ISO date string (YYYY-MM-DD)
    nights:    { type: Number, default: 1 },
    guests:    { type: Number, default: 1 },

    // NEW: time-of-day & duration details
    checkInTime:  { type: String },       // "HH:MM", optional
    checkOutTime: { type: String },       // "HH:MM", optional
    totalHours:   { type: Number },       // computed duration in hours, optional

    // Money
    currency: { type: String, default: "PHP" },
    amount:   { type: Number, required: true }, // total in PHP

    // Status lifecycle
    status: {
      type: String,
      enum: ["pending_payment", "paid", "cancelled", "awaiting_payment"],
      default: "pending_payment", // created -> pending_payment -> paid / cancelled
    },

    provider: { type: String, default: "paymongo" },

    // NEW: snapshot of pricing logic from frontend/server
    // e.g. { mode, unitPrice, qty, base, fees:{service,cleaning}, total, currencySymbol, label }
    pricingSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // QR token (hash only, not the image)
    qrToken: {
      type: String,
      index: true,
      sparse: true,
    },
    qrGeneratedAt: Date,

    // Payment gateway metadata
    payment: {
      checkoutId:  String,
      checkoutUrl: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", BookingSchema);

// src/utils/qrToken.js
const crypto = require("crypto");

/**
 * Build a stable payload from the booking we want to embed in the QR.
 * Keep it short but unique enough: bookingId + listingId.
 */
function buildQrPayload(booking) {
  const bookingId = booking._id.toString();
  const listingId = booking.listing.toString();
  return `FD:${bookingId}:${listingId}`;
}

/**
 * Create a signed hash so tokens can't be forged easily.
 * Uses a secret salt from env (fallback to empty string).
 */
function signPayload(payload) {
  const secret = process.env.QR_SECRET || "";
  return crypto.createHash("sha256").update(payload + secret).digest("hex");
}

/**
 * Final token that the app will encode into the QR.
 * Example: FD:<bookingId>:<listingId>:<sha256>
 */
function generateQrToken(booking) {
  const payload = buildQrPayload(booking);
  const sig = signPayload(payload);
  return `${payload}:${sig}`;
}

module.exports = {
  generateQrToken,
};

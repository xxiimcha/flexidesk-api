// src/owners/controllers/owner.bookings.controller.js
const Booking = require("../../models/Booking");
const Listing = require("../../models/Listing");

const uid = (req) => req.user?.uid || null;

function parseLimit(raw, def = 12, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

exports.getOwnerBookingsMine = async function getOwnerBookingsMine(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const status = (req.query.status || "").trim().toLowerCase() || null;
    const limit = parseLimit(req.query.limit, 12, 100);
    const cursor = Number(req.query.cursor || 0);
    const skip = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;

    const listingDocs = await Listing.find({ owner: ownerId })
      .select("_id")
      .lean();

    const listingIds = listingDocs.map((l) => l._id);

    if (listingIds.length === 0) {
      return res.json({ items: [], nextCursor: null });
    }

    const filter = { listing: { $in: listingIds } };
    if (status && status !== "all") filter.status = status;

    const docs = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate({
        path: "listing",
        select: "shortDesc title category scope city region country currency",
      })
      .populate({
        path: "user",
        select: "fullName name email",
      })
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? skip + limit : null;

    const normalized = items.map((b) => {
      const obj = b.toObject ? b.toObject() : b;
      obj.id = obj._id;
      return obj;
    });

    return res.json({
      items: normalized,
      nextCursor: hasMore ? String(nextCursor) : null,
    });
  } catch (err) {
    console.error("getOwnerBookingsMine error:", err);
    return res.status(500).json({
      message: "Failed to load bookings",
    });
  }
};

// GET /owner/bookings/:id
// Used by QR scan to show booking details
exports.getOwnerBookingOne = async function getOwnerBookingOne(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate({
        path: "listing",
        select:
          "title shortDesc category scope city region country currency owner",
      })
      .populate({
        path: "user",
        select: "fullName name email",
      })
      .exec();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!booking.listing || String(booking.listing.owner) !== String(ownerId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const obj = booking.toObject ? booking.toObject() : booking;
    obj.id = obj._id;

    return res.json(obj);
  } catch (err) {
    console.error("getOwnerBookingOne error:", err);
    return res.status(500).json({ message: "Failed to load booking" });
  }
};

// POST /owner/bookings/:id/complete
// Called when host confirms check-in after QR scan
exports.completeOwnerBooking = async function completeOwnerBooking(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate({
        path: "listing",
        select: "owner",
      })
      .exec();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!booking.listing || String(booking.listing.owner) !== String(ownerId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (booking.status === "completed") {
      return res.status(400).json({ message: "Booking already completed" });
    }

    booking.status = "completed";
    booking.checkedInAt = new Date();

    await booking.save();

    const obj = booking.toObject ? booking.toObject() : booking;
    obj.id = obj._id;

    return res.json({
      message: "Booking marked as completed",
      booking: obj,
    });
  } catch (err) {
    console.error("completeOwnerBooking error:", err);
    return res.status(500).json({ message: "Failed to update booking status" });
  }
};

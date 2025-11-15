// src/owners/controllers/owner.bookings.controller.js
const Booking = require("../../models/Booking");
const Listing = require("../../models/Listing");

const uid = (req) => req.user?._id || req.user?.id || req.user?.uid || null;

function parseLimit(raw, def = 12, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

/**
 * GET /api/owner/bookings/mine
 * Query params:
 *  - status?: "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "refunded"
 *  - limit?: number (default 12, max 100)
 *  - cursor?: number (offset for pagination)
 *  - _ts?: ignored (cache-buster from frontend)
 */
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

    // 1) Find all listings owned by this owner
    const listingDocs = await Listing.find({ owner: ownerId }).select("_id").lean();
    const listingIds = listingDocs.map((l) => l._id);

    if (listingIds.length === 0) {
      return res.json({ items: [], nextCursor: null });
    }

    // 2) Build booking filter
    const filter = {
      listing: { $in: listingIds },
    };

    if (status && status !== "all") {
      filter.status = status; // adjust if your Booking model uses a different status field/value
    }

    // 3) Query bookings, newest first
    const docs = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1) // +1 to check if there is a next page
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

    // Normalize to have `id`
    const normalized = items.map((b) => {
      const obj = b.toObject ? b.toObject() : b;
      obj.id = obj.id || obj._id;
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
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// controllers/listings.public.controller.js
const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const Booking = require("../models/Booking"); // <-- add this

// Only expose safe owner fields
const ownerSelect = "fullName role"; // no email for public payloads

function toObjectId(v) {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

function exposeListing(doc) {
  const d = { ...doc };

  // Normalize id field
  d.id = String(d._id);
  delete d._id;

  // Normalize owner
  const ow = d.owner;
  if (ow && typeof ow === "object") {
    const full = String(ow.fullName || "").trim();
    const firstName = full ? full.split(/\s+/)[0] : "Host";
    d.owner = {
      id: String(ow._id),
      fullName: full || undefined,
      firstName, // <-- handy for the UI
      role: ow.role,
    };
  } else if (ow) {
    // still a bare id (shouldn't happen if populate works)
    d.owner = { id: String(ow) };
  }

  return d;
}

/* ------------------------------------------------------------------ */
/*  NEW: SEARCH HANDLER FOR /api/listings/search                      */
/*  query: where, checkIn, checkOut, guests, limit                    */
/* ------------------------------------------------------------------ */
// GET /api/listings/search?where=Makati&checkIn=2025-11-20&checkOut=2025-11-22&guests=3
exports.searchPublic = async (req, res) => {
  try {
    const {
      where = "",
      checkIn,
      checkOut,
      guests,
      limit = 24,
    } = req.query;

    const pageSize = Math.min(Number(limit) || 24, 50);

    // base query: only active listings
    const q = { status: "active" };

    // ---- text / location filter ----
    if (where.trim()) {
      const regex = new RegExp(where.trim(), "i");
      q.$or = [
        { title: regex },
        { venue: regex },
        { city: regex },
        { country: regex },
        { address: regex },
      ];
    }

    // ---- capacity filter ----
    if (guests) {
      const g = Number(guests);
      if (!Number.isNaN(g) && g > 0) {
        // adjust this field to match your schema (seats / capacity / maxGuests)
        q.seats = { $gte: g };
      }
    }

    // Initial set of listings matching filters
    let docs = await Listing.find(q)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(pageSize)
      .populate({ path: "owner", select: ownerSelect })
      .lean();

    // ---- optional availability filter (date range) ----
    if (checkIn && checkOut && docs.length) {
      const from = new Date(checkIn + "T00:00:00.000Z");
      const to = new Date(checkOut + "T00:00:00.000Z");

      const listingIds = docs.map((l) => l._id);

      // Adjust Booking fields / statuses to your schema
      const overlappingBookings = await Booking.find({
        listing: { $in: listingIds },
        status: { $in: ["pending", "paid", "confirmed"] },
        // simple date overlap logic
        checkIn: { $lt: to },
        checkOut: { $gt: from },
      }).select("listing");

      const blocked = new Set(
        overlappingBookings.map((b) => String(b.listing))
      );

      docs = docs.filter((l) => !blocked.has(String(l._id)));
    }

    const items = docs.map(exposeListing);

    res.json({
      items,
      count: items.length,
    });
  } catch (e) {
    console.error("searchPublic error", e);
    res
      .status(500)
      .json({ message: e.message || "Failed to search listings" });
  }
};

/* ------------------------------------------------------------------ */
/*  EXISTING PUBLIC LIST + DETAILS                                    */
/* ------------------------------------------------------------------ */

// GET /api/listings?status=active&limit=24&cursor=<_id>
exports.listPublic = async (req, res) => {
  try {
    const { status = "active", limit = 24, cursor } = req.query;

    const pageSize = Math.min(Number(limit) || 24, 50);
    const q = {};
    if (status) q.status = status;

    const find = Listing.find(q)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(pageSize + 1)
      .populate({ path: "owner", select: ownerSelect });

    // Use a real ObjectId for cursor pagination
    const cursorId = toObjectId(cursor);
    if (cursorId) find.where({ _id: { $lt: cursorId } });

    const docs = await find.lean();
    const hasMore = docs.length > pageSize;
    if (hasMore) docs.pop();

    const items = docs.map(exposeListing);
    const nextCursor = hasMore ? String(docs[docs.length - 1]._id) : null;

    res.json({ items, nextCursor });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load listings" });
  }
};

// GET /api/listings/:id
exports.getPublicById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await Listing.findOne({ _id: id, status: "active" })
      .populate({ path: "owner", select: ownerSelect })
      .lean();

    if (!doc) return res.status(404).json({ message: "Not found" });

    res.json({ listing: exposeListing(doc) });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load listing" });
  }
};

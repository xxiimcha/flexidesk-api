const mongoose = require("mongoose");
const Booking = require("../../models/Booking");
const Listing = require("../../models/Listing");

function resolveKind(status) {
  const s = (status || "").toLowerCase();
  if (s === "refunded" || s === "refund") return "refund";
  return "earning";
}

exports.listMine = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { kind, limit = 20, cursor } = req.query;
    const lim = Math.min(Number(limit) || 20, 50);

    const base = {};

    if (cursor) {
      base.createdAt = { $lt: new Date(Number(cursor)) };
    }

    if (kind === "refund") {
      base.status = { $in: ["refunded", "refund"] };
    } else if (kind === "earning") {
      base.status = { $nin: ["refunded", "refund"] };
    }

    const rows = await Booking.find(base)
      .sort({ createdAt: -1 })
      .limit(lim + 1)
      .populate({
        path: "listingId",
        select: "title owner",
        match: { owner: new mongoose.Types.ObjectId(ownerId) },
      })
      .lean();

    const owned = rows.filter((b) => b.listingId && b.listingId.owner?.toString() === ownerId.toString());

    let nextCursor = null;
    let items = owned;

    if (items.length > lim) {
      const last = items[lim - 1];
      nextCursor = new Date(last.createdAt).getTime();
      items = items.slice(0, lim);
    }

    const normalized = items.map((b) => {
      const amt =
        typeof b.amount === "number"
          ? b.amount
          : typeof b.pricingSnapshot?.total === "number"
          ? b.pricingSnapshot.total
          : 0;

      return {
        id: b._id,
        kind: resolveKind(b.status),
        type: "booking",
        amount: amt,
        currency: b.currency || "PHP",
        status: b.status,
        reference: b.payment?.checkoutId || b._id.toString(),
        bookingCode: b._id.toString(),
        listingTitle: b.listingId?.title || null,
        note: null,
        description: b.pricingSnapshot?.label || null,
        effectiveAt: b.startDate ? new Date(b.startDate) : b.createdAt,
        createdAt: b.createdAt,
      };
    });

    return res.json({
      items: normalized,
      nextCursor,
    });
  } catch (err) {
    console.error("owner.transactions.listMine error:", err);
    return res.status(500).json({ message: "Failed to load transactions" });
  }
};

exports.getById = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const booking = await Booking.findOne({
      _id: req.params.id,
    })
      .populate({
        path: "listingId",
        select: "title owner",
      })
      .lean();

    if (!booking || booking.listingId?.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const amt =
      typeof booking.amount === "number"
        ? booking.amount
        : typeof booking.pricingSnapshot?.total === "number"
        ? booking.pricingSnapshot.total
        : 0;

    const data = {
      id: booking._id,
      kind: resolveKind(booking.status),
      type: "booking",
      amount: amt,
      currency: booking.currency || "PHP",
      status: booking.status,
      reference: booking.payment?.checkoutId || booking._id.toString(),
      bookingCode: booking._id.toString(),
      listingTitle: booking.listingId?.title || null,
      note: null,
      description: booking.pricingSnapshot?.label || null,
      effectiveAt: booking.startDate ? new Date(booking.startDate) : booking.createdAt,
      createdAt: booking.createdAt,
      raw: booking,
    };

    return res.json(data);
  } catch (err) {
    console.error("owner.transactions.getById error:", err);
    return res.status(500).json({ message: "Failed to load transaction" });
  }
};

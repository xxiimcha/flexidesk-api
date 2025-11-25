const mongoose = require("mongoose");
const Booking = require("../../models/Booking");

const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "refunded",
];

function derivePaymentStatus(doc) {
  if (doc.paymentStatus) return String(doc.paymentStatus);
  if (doc.payment && typeof doc.payment.status === "string") {
    return String(doc.payment.status);
  }
  if (doc.status === "pending" || doc.status === "cancelled") return "unpaid";
  return "paid";
}

function parseSort(sortParam) {
  const fallback = { createdAt: -1, _id: -1 };
  if (!sortParam) return fallback;
  const [field, dir] = String(sortParam).split("_");
  const map = {
    createdAt: "createdAt",
    startTime: "startDate",
    totalAmount: "amount",
  };
  const dbField = map[field];
  if (!dbField) return fallback;
  const direction = dir === "asc" ? 1 : -1;
  return { [dbField]: direction, _id: direction };
}

function buildFilter(q) {
  const filter = {};
  if (q.status && q.status !== "all") filter.status = q.status;
  if (q.paymentStatus && q.paymentStatus !== "all") {
    filter.paymentStatus = q.paymentStatus;
  }
  if (q.dateFrom) {
    const d = new Date(q.dateFrom);
    if (!filter.startDate) filter.startDate = {};
    filter.startDate.$gte = d.toISOString().slice(0, 10);
  }
  if (q.dateTo) {
    const d = new Date(q.dateTo);
    if (!filter.startDate) filter.startDate = {};
    filter.startDate.$lte = d.toISOString().slice(0, 10);
  }
  return filter;
}

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const sort = parseSort(req.query.sort);
    const filter = buildFilter(req.query);

    const search = req.query.search && String(req.query.search).trim();
    const query = Booking.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("listingId", "venue shortDesc")
      .populate("userId", "fullName email");

    let [rows, total] = await Promise.all([
      query.lean(),
      Booking.countDocuments(filter),
    ]);

    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((b) => {
        const fields = [
          String(b._id || ""),
          b.referenceCode || "",
          b.listingId?.venue || "",
          b.userId?.fullName || "",
          b.userId?.email || "",
        ];
        return fields.some((v) => String(v).toLowerCase().includes(s));
      });
      total = rows.length;
    }

    const items = rows.map((b) => ({
      id: String(b._id),
      referenceCode: String(b._id),
      listingName: b.listingId?.venue || b.listingId?.shortDesc || null,
      userName: b.userId?.fullName || null,
      userEmail: b.userId?.email || null,
      status: b.status || "pending",
      paymentStatus: derivePaymentStatus(b),
      amount:
        b.amount ??
        (b.pricingSnapshot && typeof b.pricingSnapshot.total === "number"
          ? b.pricingSnapshot.total
          : 0),
      currency:
        b.currency ||
        (b.pricingSnapshot && b.pricingSnapshot.currency) ||
        "PHP",
      startDate: b.startDate || null,
      endDate: b.endDate || null,
      checkInTime: b.checkInTime || null,
      checkOutTime: b.checkOutTime || null,
      totalHours:
        typeof b.totalHours === "number" ? b.totalHours : null,
      createdAt: b.createdAt || null,
      updatedAt: b.updatedAt || null,
    }));

    res.json({
      items,
      page,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const update = {};
    if (req.body.status !== undefined) {
      const s = String(req.body.status);
      if (!BOOKING_STATUSES.includes(s)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      update.status = s;
    }
    if (req.body.adminNotes !== undefined) {
      update.adminNotes = String(req.body.adminNotes);
    }
    update.updatedAt = new Date();

    const doc = await Booking.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!doc) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({
      id: String(doc._id),
      status: doc.status,
      adminNotes: doc.adminNotes || "",
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// src/admins/dashboard.controller.js
const dayjs = require("dayjs");

// Adjust these paths to your models
const User = require("../../models/User");
const Listing = require("../../models/Listing");
const Booking = require("../../models/Booking");

// GET /api/admin/dashboard
// Returns: { userCount, listingCount, bookings30d, revenue30d, recent }
exports.getDashboard = async (req, res, next) => {
  try {
    // If you have admin auth, you can assert req.user.role === 'admin' here.

    const since = dayjs().subtract(30, "day").toDate();

    // Run independent queries in parallel so one failure doesn't block the rest
    const [
      userCountP,
      listingCountP,
      bookings30dP,
      revenueAggP,
      recentP,
    ] = await Promise.allSettled([
      User.countDocuments({}), // Adjust filter if needed (e.g., { status: 'active' })
      Listing.countDocuments({}), // Adjust filter if needed
      Booking.countDocuments({ createdAt: { $gte: since } }),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: null, revenue: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]),
      Booking.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .select({
          _id: 1,
          userName: 1, // <-- change if you store differently (e.g., user.fullName)
          spaceName: 1, // <-- change if different
          createdAt: 1,
          amount: 1,
        })
        .lean(),
    ]);

    const safe = (p, fallback) => (p.status === "fulfilled" ? p.value : fallback);

    const userCount = safe(userCountP, 0);
    const listingCount = safe(listingCountP, 0);
    const bookings30d = safe(bookings30dP, 0);

    const revenueAgg = safe(revenueAggP, []);
    const revenue30d = Array.isArray(revenueAgg) && revenueAgg[0]?.revenue ? revenueAgg[0].revenue : 0;

    const recentRaw = safe(recentP, []);
    const recent = recentRaw.map((r) => ({
      id: String(r._id),
      user: r.userName || "—",
      space: r.spaceName || "—",
      date: r.createdAt || null,
      amount: typeof r.amount === "number" ? r.amount : Number(r.amount) || 0,
    }));

    // If any promises failed, return a soft warning
    const warnings = [];
    [userCountP, listingCountP, bookings30dP, revenueAggP, recentP].forEach((p, i) => {
      if (p.status !== "fulfilled") {
        const label = ["users", "listings", "bookings30d", "revenue30d", "recent"][i];
        warnings.push(`Failed to load ${label}: ${p.reason?.message || "Unknown error"}`);
      }
    });

    res.json({
      userCount,
      listingCount,
      bookings30d,
      revenue30d,
      recent,
      warnings,
    });
  } catch (err) {
    next(err);
  }
};

// src/controllers/ownerAnalytics.controller.js
const mongoose = require("mongoose");
const Booking = require("../../models/Booking");
const Listing = require("../../models/Listing");

/* Helper – mirror your other controllers */
const uid = (req) => req.user?._id || req.user?.id || req.user?.uid || null;

async function getOwnerAnalyticsSummary(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const now = new Date();
    const end30 = new Date(now);
    end30.setHours(23, 59, 59, 999);

    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 29); // last 30 days including today
    start30.setHours(0, 0, 0, 0);

    // Bookings that should be counted for revenue/occupancy
    const validStatuses = ["paid", "confirmed", "completed", "checked_in"];

    // Common pipeline: join Listing and keep only this owner's bookings
    const basePipeline = [
      {
        $lookup: {
          from: "listings",          // Mongoose pluralized collection name
          localField: "listingId",
          foreignField: "_id",
          as: "listing",
        },
      },
      { $unwind: "$listing" },
      {
        $match: {
          "listing.owner": ownerObjectId,
          status: { $in: validStatuses },
        },
      },
    ];

    // Revenue expression: prefer pricingSnapshot.total, fallback to amount
    const revenueExpr = { $ifNull: ["$pricingSnapshot.total", "$amount"] };

    /* ========== 1) Total earnings (all time) ========== */
    const totalAgg = await Booking.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          total: { $sum: revenueExpr },
        },
      },
    ]);

    const totalEarnings = totalAgg.length ? totalAgg[0].total : 0;

    /* ========== 2) Last 30 days – earnings, bookings, hours ========== */
    const last30Agg = await Booking.aggregate([
      ...basePipeline,
      {
        $match: {
          createdAt: { $gte: start30, $lte: end30 },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          dailyEarnings: { $sum: revenueExpr },
          bookings: { $sum: 1 },
          totalHours: { $sum: "$totalHours" },
        },
      },
    ]);

    let totalLast30 = 0;
    let totalBookingsLast30 = 0;
    let totalHoursLast30 = 0;

    for (const row of last30Agg) {
      totalLast30 += row.dailyEarnings || 0;
      totalBookingsLast30 += row.bookings || 0;
      totalHoursLast30 += row.totalHours || 0;
    }

    const daysWindow = 30;
    const avgDailyEarnings =
      daysWindow > 0 ? totalLast30 / daysWindow : 0;

    /* ========== 3) Occupancy rate (simple hours-based estimate) ========== */
    // Approximate: total booked hours / (listingsCount * 24 * 30) * 100
    const activeListingsCount = await Listing.countDocuments({
      owner: ownerObjectId,
      status: "active",
    });

    let occupancyRate = 0;
    if (activeListingsCount > 0 && daysWindow > 0) {
      const capacityHours = activeListingsCount * 24 * daysWindow;
      occupancyRate =
        capacityHours > 0
          ? (totalHoursLast30 / capacityHours) * 100
          : 0;
    }

    /* ========== 4) Peak hours (top 3 hours by bookings in last 30 days) ========== */
    const peakHoursAgg = await Booking.aggregate([
      ...basePipeline,
      {
        $match: {
          createdAt: { $gte: start30, $lte: end30 },
        },
      },
      {
        $group: {
          _id: { $hour: "$createdAt" }, // or use $hour on checkInTime if you store Date
          bookings: { $sum: 1 },
        },
      },
      { $sort: { bookings: -1 } },
      { $limit: 3 },
    ]);

    const peakHours = peakHoursAgg.map((row) => {
      const hour = row._id ?? 0;
      return `${hour.toString().padStart(2, "0")}:00`;
    });

    /* ========== 5) Listing performance (for table) ========== */
    const listingAgg = await Booking.aggregate([
      ...basePipeline,
      {
        $match: {
          createdAt: { $gte: start30, $lte: end30 },
        },
      },
      {
        $group: {
          _id: "$listingId",
          title: { $first: "$listing.venue" },
          city: { $first: "$listing.city" },
          seats: { $first: "$listing.seats" },
          bookings: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          totalHours: { $sum: "$totalHours" },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const listingStats = listingAgg.map((row) => {
      const capacityHours = daysWindow * 24; // per listing
      const occ =
        capacityHours > 0
          ? (row.totalHours / capacityHours) * 100
          : 0;

      return {
        listingId: row._id,
        title: row.title || "Untitled listing",
        city: row.city || "",
        bookings: row.bookings || 0,
        revenue: row.revenue || 0,
        occupancyRate: occ,
      };
    });

    return res.json({
      totalEarnings,
      occupancyRate,
      avgDailyEarnings,
      peakHours,
      listingStats,
    });
  } catch (err) {
    console.error("Error in getOwnerAnalyticsSummary:", err);
    return res.status(500).json({
      message: "Failed to load analytics summary",
    });
  }
}

module.exports = {
  getOwnerAnalyticsSummary,
};

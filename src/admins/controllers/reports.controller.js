// src/controllers/adminReports.controller.js
const mongoose = require("mongoose");
const Listing = require("../../models/Listing");
const Booking = require("../../models/Booking");
const Review = require("../../models/Review");

function getRangeFromPreset(preset) {
  const now = new Date();
  let days = 30;

  if (preset === "last7") days = 7;
  else if (preset === "last90") days = 90;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end, days };
}

function diffDaysSafe(a, b) {
  if (!a || !b) return 1;
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 1;
  const ms = d2.getTime() - d1.getTime();
  const raw = Math.ceil(ms / 86400000);
  return Math.max(1, raw || 1);
}

exports.getWorkspacePerformance = async function getWorkspacePerformance(req, res) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "admin") {
      return res.status(403).json({
        permissionError: true,
        message: "Admins only",
        summary: { occupancyRate: 0, revenue30d: 0, bookings30d: 0, avgRating: 0 },
        rows: [],
      });
    }

    const datePreset = req.query.datePreset || "last30";
    const { start, end, days } = getRangeFromPreset(datePreset);

    const listings = await Listing.find({})
      .select("_id title name brand branch type capacity status updatedAt")
      .lean();

    const listingIds = listings.map((l) => l._id);

    const bookings = await Booking.find({
      listing: { $in: listingIds },
      createdAt: { $gte: start, $lte: end },
    })
      .select("listing status totalPrice checkInDate checkOutDate createdAt")
      .lean();

    const reviewsAgg = await Review.aggregate([
      { $match: { listing: { $in: listingIds } } },
      {
        $group: {
          _id: "$listing",
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    const ratingMap = new Map();
    for (const r of reviewsAgg) {
      ratingMap.set(String(r._id), r.avgRating || 0);
    }

    const paidStatuses = new Set(["paid", "completed", "confirmed", "settled"]);
    const cancelledStatuses = new Set(["cancelled", "refunded", "void"]);

    const rowData = [];
    let totalRevenue = 0;
    let totalBookings = 0;
    let sumOccupancy = 0;
    let sumRating = 0;
    let ratingCount = 0;

    for (const listing of listings) {
      const lid = String(listing._id);
      const workspaceBookings = bookings.filter((b) => String(b.listing) === lid);
      const paidBookingsList = workspaceBookings.filter((b) => paidStatuses.has(String(b.status || "").toLowerCase()));
      const cancelledBookingsList = workspaceBookings.filter((b) =>
        cancelledStatuses.has(String(b.status || "").toLowerCase()),
      );

      let revenue = 0;
      let nightsTotal = 0;

      for (const b of paidBookingsList) {
        revenue += Number(b.totalPrice || 0);
        nightsTotal += diffDaysSafe(b.checkInDate, b.checkOutDate);
      }

      const occupancy = days > 0 ? Math.min(1, nightsTotal / days) : 0;
      const cancelRate =
        workspaceBookings.length > 0 ? cancelledBookingsList.length / workspaceBookings.length : 0;

      const capacity = Number(listing.capacity || 0) || 0;
      const revPerSeat = capacity > 0 ? revenue / capacity : revenue;

      const avgRatingListing = ratingMap.get(lid) || 0;

      totalRevenue += revenue;
      totalBookings += paidBookingsList.length;
      sumOccupancy += occupancy;

      if (avgRatingListing > 0) {
        sumRating += avgRatingListing;
        ratingCount += 1;
      }

      rowData.push({
        id: lid,
        name: listing.title || listing.name || "Untitled workspace",
        brand: listing.brand || "Unknown",
        branch: listing.branch || "Unknown",
        type: listing.type || "Workspace",
        capacity,
        occupancy,
        bookings: paidBookingsList.length,
        revenue,
        revPerSeat,
        cancelRate,
        rating: avgRatingListing || 0,
        updatedAt: listing.updatedAt || listing.createdAt || new Date(),
        status: listing.status || "active",
      });
    }

    const avgOccupancy = rowData.length > 0 ? sumOccupancy / rowData.length : 0;
    const avgRating = ratingCount > 0 ? sumRating / ratingCount : 0;

    return res.json({
      permissionError: false,
      summary: {
        occupancyRate: avgOccupancy,
        revenue30d: totalRevenue,
        bookings30d: totalBookings,
        avgRating: avgRating || 0,
      },
      rows: rowData,
    });
  } catch (err) {
    console.error("getWorkspacePerformance error", err);
    return res.status(500).json({
      permissionError: false,
      message: "Failed to load workspace performance",
      summary: { occupancyRate: 0, revenue30d: 0, bookings30d: 0, avgRating: 0 },
      rows: [],
    });
  }
};

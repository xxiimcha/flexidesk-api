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

function getBookingNights(b) {
  if (typeof b.nights === "number" && !Number.isNaN(b.nights)) {
    return Math.max(1, b.nights);
  }
  const start = b.startDate || b.checkInDate;
  const end = b.endDate || b.checkOutDate;
  return diffDaysSafe(start, end);
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
      .select(
        "_id title name venue address shortDesc brand branch type category scope capacity seats status updatedAt createdAt",
      )
      .lean();

    const listingIds = listings.map((l) => l._id);

    const bookings = await Booking.find({
      $or: [
        { listing: { $in: listingIds } },
        { listingId: { $in: listingIds } },
      ],
      createdAt: { $gte: start, $lte: end },
    })
      .select(
        "listing listingId status amount totalPrice startDate endDate checkInDate checkOutDate nights totalHours createdAt",
      )
      .lean();

    const reviewsAgg = await Review.aggregate([
      {
        $match: {
          $or: [
            { listing: { $in: listingIds } },
            { listingId: { $in: listingIds } },
          ],
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$listing", "$listingId"] },
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    const ratingMap = new Map();
    for (const r of reviewsAgg) {
      if (!r._id) continue;
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

      const workspaceBookings = bookings.filter((b) => {
        const bid = b.listing || b.listingId;
        return String(bid) === lid;
      });

      const paidBookingsList = workspaceBookings.filter((b) =>
        paidStatuses.has(String(b.status || "").toLowerCase()),
      );
      const cancelledBookingsList = workspaceBookings.filter((b) =>
        cancelledStatuses.has(String(b.status || "").toLowerCase()),
      );

      let revenue = 0;
      let nightsTotal = 0;

      for (const b of paidBookingsList) {
        const bookingAmount = Number(b.amount ?? b.totalPrice ?? 0);
        revenue += bookingAmount;
        nightsTotal += getBookingNights(b);
      }

      let capacity = Number(listing.capacity ?? listing.seats ?? 0);
      if (!Number.isFinite(capacity) || capacity < 0) capacity = 0;

      const occupancy = days > 0 ? Math.min(1, nightsTotal / days) : 0;

      const cancelRate =
        workspaceBookings.length > 0 ? cancelledBookingsList.length / workspaceBookings.length : 0;

      const revPerSeat = capacity > 0 ? revenue / capacity : revenue;

      const avgRatingListing = ratingMap.get(lid) || 0;

      totalRevenue += revenue;
      totalBookings += paidBookingsList.length;
      sumOccupancy += occupancy;

      if (avgRatingListing > 0) {
        sumRating += avgRatingListing;
        ratingCount += 1;
      }

      const rawName = (listing.title || listing.name || "").trim();
      let displayName = rawName;

      if (
        !displayName ||
        /^untitled workspace$/i.test(displayName) ||
        /^untitled$/i.test(displayName)
      ) {
        displayName =
          listing.venue ||
          listing.address ||
          "Untitled workspace";
      }

      rowData.push({
        id: lid,
        name: displayName,
        brand: listing.brand || "Unknown",
        branch: listing.branch || "Unknown",
        type: listing.type || listing.category || listing.scope || "Workspace",
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

const Booking = require("../../models/Booking");
const Listing = require("../../models/Listing");

async function getIncomeAnalytics(req, res) {
  try {
    const { datePreset = "last30", brand, branch } = req.query;

    let days = 30;
    if (datePreset === "last7") days = 7;
    if (datePreset === "last90") days = 90;

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const filter = {
      createdAt: { $gte: start, $lte: now },
      status: "paid",
    };

    const bookings = await Booking.find(filter)
      .populate({
        path: "listingId",
        model: "Listing",
        select: "venue city brand category scope status",
      })
      .lean();

    const getListingCity = (b) => b?.listingId?.city || "Unknown";
    const getListingBrand = (b) => b?.listingId?.brand || "Unknown";
    const getListingCategory = (b) => b?.listingId?.category || "Workspace";
    const getGross = (b) =>
      Number(b.amount) || Number(b.pricingSnapshot?.total) || 0;
    const getFee = (b) =>
      Number(b.pricingSnapshot?.fees?.service || 0) +
      Number(b.pricingSnapshot?.fees?.cleaning || 0);
    const getRefund = (b) => 0;
    const getDateField = (b) =>
      b.createdAt ? new Date(b.createdAt) : new Date();
    const getProductType = (b) => b?.listingId?.category || "Workspace";
    const getPaymentMethod = (b) => b.provider || "paymongo";

    const bookingList = bookings.filter((b) => {
      if (branch && getListingCity(b) !== branch) return false;
      if (brand && getListingBrand(b) !== brand) return false;
      return true;
    });

    const seriesMap = new Map();
    const branchMap = new Map();
    const productMap = new Map();

    let totalGross = 0;
    let totalFees = 0;
    let totalRefunds = 0;
    let totalNet = 0;
    let totalBookings = 0;

    bookingList.forEach((b) => {
      const gross = getGross(b);
      const fee = getFee(b);
      const refund = getRefund(b);
      const net = gross - fee - refund;

      const date = getDateField(b);
      const dateKey = date.toISOString().slice(0, 10);

      const city = getListingCity(b);
      const category = getListingCategory(b);

      totalGross += gross;
      totalFees += fee;
      totalRefunds += refund;
      totalNet += net;
      totalBookings++;

      if (!seriesMap.has(dateKey)) {
        seriesMap.set(dateKey, {
          date: dateKey,
          gross: 0,
          refunds: 0,
          fees: 0,
          net: 0,
          bookings: 0,
        });
      }
      const s = seriesMap.get(dateKey);
      s.gross += gross;
      s.refunds += refund;
      s.fees += fee;
      s.net += net;
      s.bookings += 1;

      branchMap.set(city, (branchMap.get(city) || 0) + gross);
      productMap.set(category, (productMap.get(category) || 0) + gross);
    });

    const series = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      series.push(
        seriesMap.get(key) || {
          date: key,
          gross: 0,
          refunds: 0,
          fees: 0,
          net: 0,
          bookings: 0,
        }
      );
    }

    const byBranch = Array.from(branchMap.entries())
      .map(([city, revenue]) => ({ branch: city, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const byProduct = Array.from(productMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const avgBookingValue = totalBookings > 0 ? totalGross / totalBookings : 0;
    const takeRate = totalGross > 0 ? totalFees / totalGross : 0;
    const mrr = days > 0 ? totalNet / (days / 30) : 0;

    const rows = bookingList
      .sort((a, b) => getDateField(b) - getDateField(a))
      .map((b) => {
        const gross = getGross(b);
        const fee = getFee(b);
        const refund = getRefund(b);
        const net = gross - fee - refund;

        return {
          id: b._id.toString(),
          date: b.createdAt,
          branch: getListingCity(b),
          brand: getListingBrand(b),
          type: getProductType(b),
          method: getPaymentMethod(b),
          status: b.status,
          gross,
          fee,
          refund,
          net,
        };
      });

    res.json({
      permissionError: false,
      series,
      byBranch,
      byProduct,
      summary: {
        totalGross,
        totalNet,
        refunds: totalRefunds,
        fees: totalFees,
        avgBookingValue,
        bookings: totalBookings,
        takeRate,
        conversion: 0,
        mrr,
      },
      rows,
    });
  } catch (err) {
    console.error("getIncomeAnalytics error", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getOccupancyReport(req, res) {
  try {
    const {
      datePreset = "last30",
      brand = "all",
      branch = "all",
      type = "all",
      status = "all",
    } = req.query;

    let days = 30;
    if (datePreset === "last7") days = 7;
    if (datePreset === "last90") days = 90;

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const listingFilter = {};
    if (brand !== "all") listingFilter.brand = brand;
    if (branch !== "all") listingFilter.city = branch;
    if (type !== "all") listingFilter.category = type;
    if (status !== "all") listingFilter.status = status;

    const listings = await Listing.find(listingFilter).lean();

    if (!listings.length) {
      return res.json({
        permissionError: false,
        summary: {
          avgOccupancy: 0,
          peakHour: "",
          peakDay: "",
          underutilizedCount: 0,
        },
        byHour: [],
        byBranch: [],
        rows: [],
        brandOptions: [],
        branchOptions: [],
        typeOptions: [],
        statusOptions: [],
      });
    }

    const listingIds = listings.map((l) => l._id);

    const bookings = await Booking.find({
      listingId: { $in: listingIds },
      status: { $in: ["paid", "confirmed", "completed"] },
      start: { $lt: end },
      end: { $gt: start },
    }).lean();

    const perListing = new Map();
    const perHour = new Array(24).fill(0).map(() => ({ total: 0, count: 0 }));
    const perBranch = new Map();

    const brandSet = new Set();
    const branchSet = new Set();
    const typeSet = new Set();
    const statusSet = new Set();

    const msPerHour = 60 * 60 * 1000;
    const rangeHours = Math.max(1, (end - start) / msPerHour);

    listings.forEach((l) => {
      perListing.set(String(l._id), {
        listing: l,
        bookedHours: 0,
      });

      if (l.city) {
        if (!perBranch.has(l.city)) {
          perBranch.set(l.city, {
            branch: l.city,
            occSum: 0,
            count: 0,
          });
        }
      }

      if (l.brand) brandSet.add(l.brand);
      if (l.city) branchSet.add(l.city);
      if (l.category) typeSet.add(l.category);
      if (l.status) statusSet.add(l.status);
    });

    bookings.forEach((b) => {
      const lid = String(b.listingId);
      const ls = perListing.get(lid);
      if (!ls) return;

      const startClipped = new Date(Math.max(b.start, start));
      const endClipped = new Date(Math.min(b.end, end));
      const hours = Math.max(0, (endClipped - startClipped) / msPerHour);
      ls.bookedHours += hours;

      if (!Number.isNaN(startClipped.getTime())) {
        const hour = startClipped.getHours();
        if (hour >= 0 && hour < 24) {
          perHour[hour].total += hours / rangeHours;
          perHour[hour].count += 1;
        }
      }
    });

    const rows = [];
    let occSum = 0;
    let occCount = 0;
    let underutilizedCount = 0;

    perListing.forEach(({ listing, bookedHours }) => {
      const capacity = listing.capacity || 1;
      const possibleHours = rangeHours * capacity;
      const avgOcc = possibleHours > 0 ? bookedHours / possibleHours : 0;

      occSum += avgOcc;
      occCount += 1;
      if (avgOcc < 0.4) underutilizedCount += 1;

      const peakHour = "";

      rows.push({
        id: listing.code || listing._id.toString().slice(-6).toUpperCase(),
        name: listing.venue || listing.name,
        brand: listing.brand,
        branch: listing.city,
        type: listing.category,
        capacity: listing.capacity,
        avgOcc,
        peak: peakHour,
        updatedAt: listing.updatedAt || listing.createdAt,
        status: listing.status || "active",
      });

      const branchRec = perBranch.get(listing.city);
      if (branchRec) {
        branchRec.occSum += avgOcc;
        branchRec.count += 1;
      }
    });

    const avgOccupancy = occCount ? occSum / occCount : 0;

    const byHour = perHour.map((h, hourIndex) => ({
      hour: `${String(hourIndex).padStart(2, "0")}:00`,
      rate: h.count ? clamp01(h.total / h.count) : 0,
    }));

    let peakHourLabel = "";
    let peakRate = -1;
    byHour.forEach((h) => {
      if (h.rate > peakRate) {
        peakRate = h.rate;
        peakHourLabel = h.hour;
      }
    });

    const peakDay = "";

    const byBranch = Array.from(perBranch.values()).map((b) => ({
      branch: b.branch,
      occ: b.count ? clamp01(b.occSum / b.count) : 0,
    }));

    const brandOptions = Array.from(brandSet).sort();
    const branchOptions = Array.from(branchSet).sort();
    const typeOptions = Array.from(typeSet).sort();
    const statusOptions = Array.from(statusSet).sort();

    res.json({
      permissionError: false,
      summary: {
        avgOccupancy,
        peakHour: peakHourLabel,
        peakDay,
        underutilizedCount,
      },
      byHour,
      byBranch,
      rows,
      brandOptions,
      branchOptions,
      typeOptions,
      statusOptions,
    });
  } catch (err) {
    console.error("getOccupancyReport error", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, Number(n)));
}

module.exports = {
  getIncomeAnalytics,
  getOccupancyReport,
};

// src/admins/controllers/payments.controller.js
const axios = require("axios");
const mongoose = require("mongoose");

const Booking = require("../../models/Booking");

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || "";

/* ========== helpers ========== */

const isAdmin = (req) =>
  String(req.user?.role || "").toLowerCase() === "admin";

function buildPaymongoClient() {
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error("PAYMONGO_SECRET_KEY is not set in env");
  }

  const basic = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64");

  return axios.create({
    baseURL: "https://api.paymongo.com/v1",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
  });
}

/* ========== LIST PAYMENTS ========== */
/**
 * GET /api/admin/payments
 *
 * Query params:
 *  - page, limit
 *  - status    -> Booking.status ("pending_payment", "paid", etc.)
 *  - method    -> Booking.provider ("paymongo")
 *  - userId    -> Booking.userId
 *  - listingId -> Booking.listingId
 *  - dateFrom, dateTo -> filter by createdAt
 *  - search    -> matches payment.checkoutId (extend as needed)
 */
async function listAdminPayments(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const {
      page = 1,
      limit = 20,
      status,
      method,
      userId,
      listingId,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const filter = {};

    // status filter (only if not "all")
    if (status && status !== "all") {
      filter.status = status;
    }

    // provider / method filter (only if not "all")
    if (method && method !== "all") {
      filter.provider = method;
    }

    if (userId && mongoose.isValidObjectId(userId)) {
      filter.userId = userId;
    }

    if (listingId && mongoose.isValidObjectId(listingId)) {
      filter.listingId = listingId;
    }

    // date range on createdAt
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom + "T00:00:00Z");
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo + "T23:59:59Z");
      }
    }

    // simple search on checkoutId for now
    if (search) {
      filter.$or = [
        { "payment.checkoutId": { $regex: search, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      Booking.find(filter)
        .populate("userId", "fullName email")
        .populate("listingId", "title venue city country owner")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Booking.countDocuments(filter),
    ]);

    const items = rows.map((b) => {
      const user =
        b.userId && typeof b.userId === "object" && b.userId._id
          ? b.userId
          : null;

      const listing =
        b.listingId && typeof b.listingId === "object" && b.listingId._id
          ? b.listingId
          : null;

      // main date the UI should use (you can tweak this priority)
      const date = b.updatedAt || b.createdAt || null;

      return {
        id: b._id,

        // core payment info
        amount: b.amount,
        currency: b.currency || "PHP",
        status: b.status,             // "paid", etc.
        provider: b.provider,         // "paymongo"
        method: (b.provider || "").toUpperCase() || "PAYMONGO",
        channel: b.provider,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        date,                         // used by the Date column

        // booking schedule details
        startDate: b.startDate,
        endDate: b.endDate,
        nights: b.nights,
        guests: b.guests,
        checkInTime: b.checkInTime,
        checkOutTime: b.checkOutTime,
        totalHours: b.totalHours,

        // pricing snapshot (for details drawer)
        pricingSnapshot: b.pricingSnapshot || null,

        // PayMongo checkout data
        checkoutId: b.payment?.checkoutId || null,
        checkoutUrl: b.payment?.checkoutUrl || null,
        // when you start saving the actual PayMongo payment id, put it here:
        paymentId: b.payment?.paymentId || null,

        // fallback ID/label
        bookingCode: String(b._id),

        // Customer (users collection)
        customer: user
          ? {
              id: user._id,
              name: user.fullName || "Unknown",
              email: user.email || "",
            }
          : null,

        // Listing (listings collection)
        listing: listing
          ? {
              id: listing._id,
              // prefer title, fallback to venue
              title:
                listing.title ||
                listing.venue ||
                "(No title)",
              city: listing.city || "",
              venue: listing.venue || "",
              country: listing.country || "",
            }
          : null,
      };
    });

    res.json({
      items,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("listAdminPayments error:", err);
    res.status(500).json({ message: "Failed to load payments" });
  }
}

/* ========== CAPTURE PAYMENT ========== */
/**
 * POST /api/admin/payments/:paymentId/capture
 *
 * IMPORTANT:
 *  - PayMongo capture requires the real PayMongo `payment_id` (e.g. "pay_xxx"),
 *    NOT the checkoutId.
 *  - You currently only store `payment.checkoutId` in Booking.
 *  - Once you store `payment.paymentId` from PayMongo (via webhook/success),
 *    this endpoint will work.
 */
async function capturePayment(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).json({ message: "paymentId is required" });
    }

    // assumes you will store payment.paymentId = "pay_xxx"
    const booking = await Booking.findOne({ "payment.paymentId": paymentId });

    if (!booking) {
      return res
        .status(404)
        .json({ message: "Booking with this payment not found or not stored yet" });
    }

    if (booking.status === "paid") {
      return res.status(400).json({ message: "Payment already captured" });
    }

    const client = buildPaymongoClient();

    const amountCentavos = Math.round((booking.amount || 0) * 100);

    const { data } = await client.post(`/payments/${paymentId}/capture`, {
      data: {
        attributes: {
          amount: amountCentavos,
        },
      },
    });

    booking.status = "paid"; // valid value in your enum
    booking.payment = booking.payment || {};
    booking.payment.captureResponse = data;

    await booking.save();

    res.json({
      message: "Payment captured successfully",
      booking,
      paymongo: data,
    });
  } catch (err) {
    console.error("capturePayment error:", err.response?.data || err.message);
    res.status(500).json({ message: "Failed to capture payment" });
  }
}

/* ========== REFUND PAYMENT ========== */
/**
 * POST /api/admin/payments/:paymentId/refund
 * body: { amount }  // in PHP; full booking.amount if omitted
 *
 * NOTE:
 *  - Your Booking.status enum does NOT currently include "refunded".
 *    To avoid validation errors, this function only records the refund
 *    metadata and does not change `status`. If you want a dedicated
 *    refund status, add values to the enum in the Booking schema first.
 */
async function refundPayment(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const { paymentId } = req.params;
    const { amount } = req.body || {};

    if (!paymentId) {
      return res.status(400).json({ message: "paymentId is required" });
    }

    const booking = await Booking.findOne({ "payment.paymentId": paymentId });

    if (!booking) {
      return res
        .status(404)
        .json({ message: "Booking with this payment not found or not stored yet" });
    }

    const client = buildPaymongoClient();

    const refundAmountCentavos = Math.round(
      (amount || booking.amount || 0) * 100
    );

    const { data } = await client.post("/refunds", {
      data: {
        attributes: {
          amount: refundAmountCentavos,
          payment_id: paymentId,
          reason: "requested_by_customer",
        },
      },
    });

    booking.payment = booking.payment || {};
    booking.payment.refunds = booking.payment.refunds || [];
    booking.payment.refunds.push(data);

    await booking.save();

    res.json({
      message: "Refund created successfully",
      booking,
      paymongo: data,
    });
  } catch (err) {
    console.error("refundPayment error:", err.response?.data || err.message);
    res.status(500).json({ message: "Failed to create refund" });
  }
}

module.exports = {
  listAdminPayments,
  capturePayment,
  refundPayment,
};

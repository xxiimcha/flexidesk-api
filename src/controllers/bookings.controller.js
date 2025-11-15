// src/controllers/bookings.controller.js
const axios = require("axios");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Listing = require("../models/Listing");
const User = require("../models/User");
const { generateQrToken } = require("../utils/qrToken");
const { sendBookingConfirmationEmail } = require("../utils/mailer");

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

const uid = (req) => req.user?._id || req.user?.id || req.user?.uid || null;
const isAdmin = (req) => String(req.user?.role || "").toLowerCase() === "admin";

function pickListing(l) {
  if (!l) return null;
  const { _id, title, venue, city, country, images = [], cover } = l;
  return { _id, title, venue, city, country, images, cover };
}

async function attachListings(rows) {
  const ids = [
    ...new Set(
      rows
        .map((b) => String(b.listingId || ""))
        .filter((v) => !!v && mongoose.Types.ObjectId.isValid(v))
    ),
  ];
  if (!ids.length) return rows;

  const list = await Listing.find({ _id: { $in: ids } })
    .select("title venue city country images cover")
    .lean();

  const map = new Map(list.map((l) => [String(l._id), pickListing(l)]));
  return rows.map((b) => ({
    ...b,
    listing: map.get(String(b.listingId)) || null,
  }));
}

function parseISO(d) {
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t : null;
}

function diffDaysISO(a, b) {
  const d1 = parseISO(a);
  const d2 = parseISO(b);
  if (!d1 || !d2) return null;
  const ms = d2.setHours(12, 0, 0, 0) - d1.setHours(12, 0, 0, 0);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function firstPrice(listing) {
  const cands = [
    listing.priceSeatDay,
    listing.priceRoomDay,
    listing.priceWholeDay,
    listing.priceSeatHour,
    listing.priceRoomHour,
    listing.priceWholeMonth,
  ];
  for (const v of cands) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

const toCentavos = (php) =>
  Math.max(0, Math.round(Number(php || 0) * 100));

async function ensureBookingQrToken(booking) {
  if (!booking.qrToken) {
    booking.qrToken = generateQrToken(booking);
    booking.qrGeneratedAt = new Date();
    await booking.save();
  }
  return booking.qrToken;
}

function buildDateTime(dateStr, timeStr, kind = "start") {
  if (!dateStr) return null;
  const t =
    typeof timeStr === "string" && /^\d{2}:\d{2}$/.test(timeStr)
      ? timeStr
      : kind === "end"
      ? "23:59"
      : "00:00";

  const iso = `${dateStr}T${t}:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function findOverlappingBooking({
  listingId,
  startDate,
  endDate,
  checkInTime,
  checkOutTime,
  excludeBookingId,
}) {
  const windowStart = buildDateTime(startDate, checkInTime, "start");
  const windowEnd = buildDateTime(endDate, checkOutTime, "end");

  if (!windowStart || !windowEnd || windowEnd <= windowStart) return null;

  const q = {
    listingId,
    status: { $ne: "cancelled" },
  };

  if (excludeBookingId && mongoose.Types.ObjectId.isValid(excludeBookingId)) {
    q._id = { $ne: excludeBookingId };
  }

  const dateOverlapFilter = {
    $expr: {
      $and: [
        { $lte: [{ $toDate: "$startDate" }, new Date(endDate)] },
        { $gte: [{ $toDate: "$endDate" }, new Date(startDate)] },
      ],
    },
  };

  const candidates = await Booking.find({ ...q, ...dateOverlapFilter })
    .select("_id startDate endDate checkInTime checkOutTime status")
    .lean();

  for (const b of candidates) {
    const bStart = buildDateTime(b.startDate, b.checkInTime, "start");
    const bEnd = buildDateTime(b.endDate, b.checkOutTime, "end");
    if (!bStart || !bEnd) continue;
    if (windowStart < bEnd && bStart < windowEnd) {
      return b;
    }
  }

  return null;
}

function expandNights(startDate, endDate) {
  const s = parseISO(startDate);
  const e = parseISO(endDate);
  if (!s || !e || e <= s) return [];
  const out = [];
  const d = new Date(s);
  while (d < e) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

async function sendBookingEmailSafe(booking) {
  try {
    const [user, listing] = await Promise.all([
      User.findById(booking.userId)
        .select("email name firstName lastName")
        .lean(),
      Listing.findById(booking.listingId)
        .select("title venue city country address")
        .lean(),
    ]);

    if (!user || !user.email) return;

    await sendBookingConfirmationEmail({
      to: user.email,
      user,
      booking: booking.toObject ? booking.toObject() : booking,
      listing,
    });
  } catch (err) {
    console.error("Failed to send booking confirmation email:", err);
  }
}

/* ===================== READ ===================== */

async function listMine(req, res, next) {
  try {
    const me = uid(req);
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const docs = await Booking.find({ userId: me })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(await attachListings(docs));
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const me = uid(req);
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const { all, userId, status } = req.query;
    const q = {};

    if (all && isAdmin(req)) {
      if (userId && mongoose.Types.ObjectId.isValid(userId)) q.userId = userId;
      if (status) q.status = status;
    } else {
      q.userId = me;
    }

    const docs = await Booking.find(q).sort({ createdAt: -1 }).lean();
    return res.json(await attachListings(docs));
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const me = uid(req);
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid id" });

    const b = await Booking.findById(id).lean();
    if (!b) return res.status(404).json({ message: "Not found" });
    if (!isAdmin(req) && String(b.userId) !== String(me)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [withListing] = await attachListings([b]);
    return res.json(withListing);
  } catch (e) {
    next(e);
  }
}

async function getBlockedDates(req, res, next) {
  try {
    const { listingId } = req.query || {};

    if (!listingId || !mongoose.isValidObjectId(listingId)) {
      return res.status(422).json({ message: "Invalid listingId" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = await Booking.find({
      listingId,
      status: { $ne: "cancelled" },
      endDate: { $gte: today.toISOString().slice(0, 10) },
    })
      .select("startDate endDate status")
      .lean();

    const set = new Set();
    for (const b of bookings) {
      for (const d of expandNights(b.startDate, b.endDate)) {
        set.add(d);
      }
    }

    const blockedDates = Array.from(set).sort();
    return res.json({ blockedDates });
  } catch (e) {
    next(e);
  }
}

/* ===================== AVAILABILITY ===================== */

async function checkAvailability(req, res, next) {
  try {
    const {
      listingId,
      startDate,
      endDate,
      checkInTime,
      checkOutTime,
      excludeBookingId,
    } = req.body || {};

    if (!listingId || !mongoose.isValidObjectId(listingId)) {
      return res.status(422).json({ message: "Invalid listingId" });
    }
    if (!startDate || !endDate) {
      return res
        .status(422)
        .json({ message: "Missing startDate or endDate" });
    }

    const overlap = await findOverlappingBooking({
      listingId,
      startDate,
      endDate,
      checkInTime,
      checkOutTime,
      excludeBookingId,
    });

    return res.json({ available: !overlap });
  } catch (e) {
    next(e);
  }
}

/* ===================== WRITE ===================== */

async function cancel(req, res, next) {
  try {
    const me = uid(req);
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid id" });

    const b = await Booking.findById(id);
    if (!b) return res.status(404).json({ message: "Not found" });
    if (!isAdmin(req) && String(b.userId) !== String(me)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (b.status === "cancelled")
      return res.json({ ok: true, booking: b });

    const now = new Date();
    const starts = new Date(b.startDate);
    if (Number.isFinite(starts.getTime()) && starts < now) {
      return res
        .status(400)
        .json({ message: "Already started; cannot cancel." });
    }

    b.status = "cancelled";
    await b.save();

    const [withListing] = await attachListings([b.toObject()]);
    return res.json({ ok: true, booking: withListing });
  } catch (e) {
    next(e);
  }
}

async function markPaid(req, res, next) {
  try {
    const me = uid(req);
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid id" });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Not found" });

    if (!isAdmin(req) && String(booking.userId) !== String(me)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    booking.status = "paid";
    await ensureBookingQrToken(booking);

    await sendBookingEmailSafe(booking);

    const [withListing] = await attachListings([booking.toObject()]);
    return res.json({ ok: true, booking: withListing });
  } catch (e) {
    next(e);
  }
}

/* ===================== PAYMONGO CHECKOUT ===================== */

async function createBookingIntent(req, res) {
  try {
    if (!PAYMONGO_SECRET_KEY) {
      return res
        .status(500)
        .json({ message: "Payment gateway not configured." });
    }

    const me = uid(req);
    if (!me) return res.status(401).json({ message: "Unauthenticated" });

    const {
      listingId,
      startDate,
      endDate,
      nights,
      guests = 1,
      returnUrl,
      multiplyByGuests = false,
      checkInTime,
      checkOutTime,
      totalHours,
      pricing,
    } = req.body || {};

    if (!listingId || !startDate || !endDate) {
      return res
        .status(422)
        .json({ message: "Missing required fields" });
    }
    if (!mongoose.isValidObjectId(listingId)) {
      return res
        .status(422)
        .json({ message: "Invalid listingId" });
    }

    const s = parseISO(startDate);
    const e = parseISO(endDate);
    if (!s || !e)
      return res.status(422).json({ message: "Invalid dates" });
    if (e < s)
      return res
        .status(422)
        .json({ message: "endDate must be after startDate" });

    const listing = await Listing.findById(listingId).lean();
    if (!listing)
      return res.status(404).json({ message: "Listing not found" });

    const basePrice = firstPrice(listing);
    if (!basePrice)
      return res
        .status(422)
        .json({ message: "Listing has no valid price" });

    const nightsCount =
      Number.isFinite(Number(nights)) && Number(nights) > 0
        ? Number(nights)
        : diffDaysISO(startDate, endDate) || 1;

    const guestCount = Math.max(1, Number(guests) || 1);
    const perGuestFactor = multiplyByGuests ? guestCount : 1;
    const totalPhp = basePrice * nightsCount * perGuestFactor;

    const overlapping = await findOverlappingBooking({
      listingId,
      startDate,
      endDate,
      checkInTime,
      checkOutTime,
    });

    if (overlapping) {
      return res.status(409).json({
        message:
          "Selected dates and times are no longer available for this listing.",
        conflictBookingId: String(overlapping._id),
      });
    }

    const booking = await Booking.create({
      userId: me,
      listingId,
      startDate,
      endDate,
      nights: nightsCount,
      guests: guestCount,
      currency: listing.currency || "PHP",
      amount: totalPhp,
      status: "paid",
      provider: "paymongo",
      checkInTime: checkInTime || null,
      checkOutTime: checkOutTime || null,
      totalHours: totalHours || null,
      pricingSnapshot: pricing || null,
    });

    const successUrl =
      (returnUrl || `${APP_URL}/app/bookings/thank-you`) +
      `?status=paid&bookingId=${booking._id}`;
    const cancelUrl = `${APP_URL}/checkout?cancelled=1&bookingId=${booking._id}`;

    const payload = {
      data: {
        attributes: {
          amount: toCentavos(totalPhp),
          currency: "PHP",
          description: `Booking ${booking._id} • ${
            listing.venue || listing.title || "Workspace"
          }`,
          payment_method_types: ["card", "gcash"],
          success_url: successUrl,
          cancel_url: cancelUrl,
          statement_descriptor: "FLEXIDESK",
          metadata: {
            bookingId: String(booking._id),
            listingId: String(listing._id),
            userId: String(me),
            nights: String(nightsCount),
            guests: String(guestCount),
          },
          line_items: [
            {
              name: listing.venue || listing.title || "Workspace",
              amount: toCentavos(basePrice),
              currency: "PHP",
              quantity: nightsCount * perGuestFactor,
            },
          ],
        },
      },
    };

    const pmRes = await axios.post(
      "https://api.paymongo.com/v1/checkout_sessions",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(PAYMONGO_SECRET_KEY + ":").toString(
              "base64"
            ),
          "Idempotency-Key": String(booking._id),
        },
        timeout: 15000,
      }
    );

    const checkout = pmRes?.data?.data?.attributes || {};
    const checkoutId = pmRes?.data?.data?.id;
    const checkoutUrl = checkout?.checkout_url || checkout?.url;

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { payment: { checkoutId, checkoutUrl } },
    });

    return res.json({
      bookingId: String(booking._id),
      amount: totalPhp,
      currency: "PHP",
      nights: nightsCount,
      guests: guestCount,
      checkout: { id: checkoutId, url: checkoutUrl },
    });
  } catch (err) {
    console.error(
      "createBookingIntent error:",
      err?.response?.data || err
    );
    const apiError =
      err?.response?.data?.errors?.[0]?.detail ||
      err?.response?.data?.errors?.[0]?.title ||
      err?.message;
    return res
      .status(500)
      .json({ message: apiError || "Failed to create checkout" });
  }
}

module.exports = {
  listMine,
  list,
  getOne,
  cancel,
  createBookingIntent,
  markPaid,
  checkAvailability,
  getBlockedDates,
};

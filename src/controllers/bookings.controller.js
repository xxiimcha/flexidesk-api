const axios = require("axios");
const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const Booking = require("../models/Booking");

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY; // sk_test_xxx
const APP_URL = process.env.APP_URL || "http://localhost:5173";

function firstPrice(listing) {
  const cands = [
    listing.priceSeatDay, listing.priceRoomDay, listing.priceWholeDay,
    listing.priceSeatHour, listing.priceRoomHour, listing.priceWholeMonth
  ];
  for (const v of cands) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
const toCentavos = (php) => Math.round(Number(php) * 100);

exports.createBookingIntent = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const { listingId, startDate, endDate, nights = 1, guests = 1, returnUrl } = req.body || {};
    if (!listingId || !startDate || !endDate) {
      return res.status(422).json({ message: "Missing required fields" });
    }

    if (!mongoose.isValidObjectId(listingId)) {
      return res.status(422).json({ message: "Invalid listingId" });
    }

    const listing = await Listing.findById(listingId).lean();
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    const price = firstPrice(listing);
    if (!price) return res.status(422).json({ message: "Listing has no valid price" });

    const nightsCount = Number(nights) > 0 ? Number(nights) : 1;
    // tweak this if you charge per guest
    const totalPhp = price * nightsCount;

    // 1) Create booking doc with userId (✅ this is where we insert the logged-in user id)
    const booking = await Booking.create({
      userId,
      listingId,
      startDate,
      endDate,
      nights: nightsCount,
      guests: Number(guests) || 1,
      currency: listing.currency || "PHP",
      amount: totalPhp,
      status: "pending_payment",
      provider: "paymongo",
    });

    // 2) Create PayMongo Checkout Session
    const successUrl = (returnUrl || `${APP_URL}/app/bookings/thank-you`) + `?status=paid&bookingId=${booking._id}`;
    const cancelUrl = `${APP_URL}/checkout?cancelled=1&bookingId=${booking._id}`;

    const payload = {
      data: {
        attributes: {
          amount: toCentavos(totalPhp),
          currency: "PHP",
          description: `Booking ${booking._id} • ${listing.venue || listing.category || "Workspace"}`,
          payment_method_types: ["card", "gcash"], // add others you enabled
          success_url: successUrl,
          cancel_url: cancelUrl,
          statement_descriptor: "FLEXIDESK",
          metadata: {
            bookingId: String(booking._id),
            listingId: String(listing._id),
            userId: String(userId),     // propagate for reconciliation
          },
          line_items: [
            {
              name: listing.venue || "Workspace",
              amount: toCentavos(price),
              currency: "PHP",
              quantity: nightsCount,
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
          Authorization: "Basic " + Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64"),
        },
      }
    );

    const checkout = pmRes?.data?.data?.attributes || {};
    const checkoutId = pmRes?.data?.data?.id;
    const checkoutUrl = checkout?.checkout_url || checkout?.url;

    // 3) Save provider refs
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { payment: { checkoutId, checkoutUrl } }
    });

    return res.json({
      bookingId: String(booking._id),
      checkout: { id: checkoutId, url: checkoutUrl },
    });
  } catch (err) {
    console.error("createBookingIntent error:", err?.response?.data || err);
    const apiError = err?.response?.data?.errors?.[0]?.detail;
    return res.status(500).json({ message: apiError || "Failed to create checkout" });
  }
};

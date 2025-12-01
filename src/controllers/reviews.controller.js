// src/controllers/reviews.controller.js
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Listing = require("../models/Listing");

const recalcListingRating = async (listingId) => {
  const [stats] = await Review.aggregate([
    { $match: { listing: listingId, status: "visible" } },
    {
      $group: {
        _id: "$listing",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (!stats) {
    await Listing.findByIdAndUpdate(listingId, {
      $set: {
        ratingAvg: 0,
        ratingCount: 0,
        rating: 0,
        reviewsCount: 0,
      },
    }).catch(() => {});
    return;
  }

  const avg = Math.round(stats.avgRating * 10) / 10;
  const count = stats.count;

  await Listing.findByIdAndUpdate(listingId, {
    $set: {
      ratingAvg: avg,
      ratingCount: count,
      rating: avg,
      reviewsCount: count,
    },
  }).catch(() => {});
};

exports.createForBooking = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const { rating, comment } = req.body;

    if (!rating) {
      return res.status(400).json({ message: "Rating is required." });
    }

    const booking = await Booking.findById(bookingId).populate("listing");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    const userId = req.user?.uid || req.user?._id;
    const bookingUserId =
      booking.user || booking.client || booking.customer || booking.clientId;

    if (!userId || !bookingUserId || String(bookingUserId) !== String(userId)) {
      return res.status(403).json({ message: "Not allowed to review this booking." });
    }

    if (!booking.listing && !booking.listingId) {
      return res.status(400).json({ message: "Booking is not linked to a listing." });
    }

    const now = new Date();
    const start = booking.startDate || booking.from;
    const bookingStatus = booking.status;
    if (start && new Date(start) > now && bookingStatus !== "completed") {
      return res
        .status(400)
        .json({ message: "You can only review completed or past bookings." });
    }

    const listingId = booking.listing?._id || booking.listingId;
    if (!listingId) {
      return res.status(400).json({ message: "Listing not found for this booking." });
    }

    let review = await Review.findOne({
      user: userId,
      booking: booking._id,
    });

    if (review) {
      review.rating = rating;
      review.comment = comment || "";
      review.status = "visible";
      await review.save();
    } else {
      review = await Review.create({
        user: userId,
        listing: listingId,
        booking: booking._id,
        rating,
        comment: comment || "",
      });
    }

    recalcListingRating(listingId).catch(() => {});

    return res.json({
      id: review._id,
      message: "Review saved.",
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "You already submitted a review for this booking.",
      });
    }

    return res.status(500).json({ message: err.message || "Failed to submit review." });
  }
};

exports.listForListing = async (req, res) => {
  try {
    const listingId = req.params.listingId || req.query.listing;
    if (!listingId) {
      return res.status(400).json({ message: "listingId is required." });
    }

    const status = req.query.status || "visible";
    const limit = Math.min(50, Number(req.query.limit) || 20);

    const query = { listing: listingId };
    if (status) query.status = status;

    const reviews = await Review.find(query)
      .populate("user", "name fullName firstName avatar")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const listing = await Listing.findById(listingId)
      .select("ratingAvg ratingCount rating reviewsCount")
      .lean();

    return res.json({
      reviews,
      rating:
        listing?.ratingAvg ??
        listing?.rating ??
        0,
      count:
        listing?.ratingCount ??
        listing?.reviewsCount ??
        reviews.length,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load reviews." });
  }
};

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
      $set: { ratingAvg: 0, ratingCount: 0 },
    }).catch(() => {});
    return;
  }

  await Listing.findByIdAndUpdate(listingId, {
    $set: {
      ratingAvg: Math.round(stats.avgRating * 10) / 10,
      ratingCount: stats.count,
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
    const listingId = req.params.listingId;

    const reviews = await Review.find({
      listing: listingId,
      status: "visible",
    })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ items: reviews });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load reviews." });
  }
};

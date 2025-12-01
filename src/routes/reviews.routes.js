// src/routes/reviews.routes.js
const express = require("express");
const router = express.Router();

const reviewsController = require("../controllers/reviews.controller");
const requireUser = require("../middleware/requireUser");

// ----- Public: list reviews for a listing -----
// Frontend call: GET /reviews?listing=<id>&status=visible
router.get("/", reviewsController.listForListing);

// ----- Public: legacy /listing/:listingId path -----
router.get("/listing/:listingId", reviewsController.listForListing);

// ----- Protected: create or update review for a booking -----
// Frontend call: POST /reviews/booking/:bookingId
router.post("/booking/:bookingId", requireUser, reviewsController.createForBooking);

module.exports = router;

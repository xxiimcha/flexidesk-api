// src/routes/reviews.routes.js
const express = require("express");
const router = express.Router();

const reviewsController = require("../controllers/reviews.controller");

router.get("/listing/:listingId", reviewsController.listForListing);

module.exports = router;

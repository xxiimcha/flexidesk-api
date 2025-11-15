// src/owners/routes/bookings.routes.js
const express = require("express");
const router = express.Router();

const { getOwnerBookingsMine } = require("../controllers/owner.bookings.controller");

router.get("/mine", getOwnerBookingsMine);

module.exports = router;

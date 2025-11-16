// src/owners/routes/bookings.routes.js
const express = require("express");
const router = express.Router();

const { getOwnerBookingsMine } = require("../controllers/owner.bookings.controller");
const { requireAuth } = require("../../middleware/auth");

// GET /api/owner/bookings/mine
router.get("/mine", requireAuth, getOwnerBookingsMine);   

module.exports = router;

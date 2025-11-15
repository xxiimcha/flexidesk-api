// src/routes/bookings.routes.js
const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const ctrl = require("../controllers/bookings.controller");

// current user's bookings
router.get("/me", requireAuth, ctrl.listMine);

// list bookings (admin can see all with ?all=1)
router.get("/", requireAuth, ctrl.list);

// blocked dates for a listing (used by ListingDetails calendar)
// GET /api/bookings/blocked-dates?listingId=...
router.get("/blocked-dates", requireAuth, ctrl.getBlockedDates);

// availability check for a specific date/time range
// POST /api/bookings/check-availability
router.post("/check-availability", requireAuth, ctrl.checkAvailability);

// create PayMongo checkout intent
router.post("/intent", requireAuth, ctrl.createBookingIntent);

// cancel booking
router.post("/:id/cancel", requireAuth, ctrl.cancel);

// get a single booking
router.get("/:id", requireAuth, ctrl.getOne);

module.exports = router;

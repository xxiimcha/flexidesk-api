// src/routes/bookings.routes.js
const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/bookings.controller");
const reviewCtrl = require("../controllers/reviews.controller");

// current user's bookings
router.get("/me", requireAuth, ctrl.listMine);
router.get("/", requireAuth, ctrl.list);
router.get("/blocked-dates", requireAuth, ctrl.getBlockedDates);
router.post("/check-availability", requireAuth, ctrl.checkAvailability);
router.post("/intent", requireAuth, ctrl.createBookingIntent);
router.post("/:id/cancel", requireAuth, ctrl.cancel);
router.post("/:id/review", requireAuth, reviewCtrl.createForBooking);

// get a single booking
router.get("/:id", requireAuth, ctrl.getOne);

module.exports = router;

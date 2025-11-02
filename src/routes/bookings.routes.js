const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const { createBookingIntent } = require("../controllers/bookings.controller");

router.post("/intent", requireAuth, createBookingIntent);

module.exports = router;

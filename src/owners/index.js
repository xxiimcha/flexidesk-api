const router = require("express").Router();

router.use("/listings", require("./routes/listings.routes"));
router.use("/bookings", require("./routes/bookings.routes"));
router.use("/inquiries", require("./routes/inquiries.routes"));
router.use("/analytics", require("./routes/analytics.routes"));
router.use("/notifications", require("./routes/notifications.routes"));

module.exports = router;

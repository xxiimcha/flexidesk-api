const router = require("express").Router();

router.use("/listings", require("./routes/listings.routes"));
router.use("/bookings", require("./routes/bookings.routes"));
router.use("/inquiries", require("./routes/inquiries.routes"));

module.exports = router;

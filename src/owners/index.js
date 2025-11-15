const router = require("express").Router();
router.use("/listings", require("./routes/listings.routes"));
router.use("/bookings", require("./routes/bookings.routes"));
module.exports = router;

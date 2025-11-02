const router = require("express").Router();
router.use("/listings", require("./routes/listings.routes"));
module.exports = router;

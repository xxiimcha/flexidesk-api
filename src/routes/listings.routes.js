const router = require("express").Router();
const ctrl = require("../controllers/listings.controller");

router.get("/", ctrl.listPublic);

module.exports = router;

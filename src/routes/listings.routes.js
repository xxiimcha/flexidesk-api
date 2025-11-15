const router = require("express").Router();
const ctrl = require("../controllers/listings.controller");

router.get("/search", ctrl.searchPublic);

router.get("/", ctrl.listPublic);
router.get("/:id", ctrl.getPublicById);

module.exports = router;

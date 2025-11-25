const router = require("express").Router();
const requireUser = require("../../middleware/requireUser");
const ctrl = require("../controllers/owner.notifications.controller");

router.get("/summary", requireUser, ctrl.getSummary);

module.exports = router;

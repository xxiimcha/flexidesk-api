const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const ctrl = require("../controllers/account.controller");

router.get("/", requireAuth, ctrl.getAccount);

module.exports = router;

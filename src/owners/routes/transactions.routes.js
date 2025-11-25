const router = require("express").Router();
const requireUser = require("../../middleware/requireUser");
const ctrl = require("../controllers/owner.transactions.controller");

router.get("/mine", requireUser, ctrl.listMine);
router.get("/:id", requireUser, ctrl.getById);

module.exports = router;

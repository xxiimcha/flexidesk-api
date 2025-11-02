const router = require("express").Router();
const requireUser = require("../../middleware/requireUser");
const ctrl = require("../controllers/owner.listings.controller");

// CREATE
router.post("/", requireUser, ctrl.create);

// LIST MINE
router.get("/mine", requireUser, ctrl.listMine);

// GET ONE
router.get("/:id", requireUser, ctrl.getById);

// UPDATE FIELDS
router.put("/:id", requireUser, ctrl.update);

// UPDATE STATUS
router.patch("/:id/status", requireUser, ctrl.updateStatus);

// DELETE
router.delete("/:id", requireUser, ctrl.remove);

module.exports = router;

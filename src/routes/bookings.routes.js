// src/routes/bookings.routes.js
const router = require("express").Router();
const requireAuth = require("../middleware/auth");
const ctrl = require("../controllers/bookings.controller");

router.get("/me", requireAuth, ctrl.listMine);   
router.get("/", requireAuth, ctrl.list);         
router.post("/intent", requireAuth, ctrl.createBookingIntent); 
router.post("/:id/cancel", requireAuth, ctrl.cancel);         
router.get("/:id", requireAuth, ctrl.getOne);                

module.exports = router;

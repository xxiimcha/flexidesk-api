// src/admins/dashboard.routes.js
const router = require("express").Router();
const ctrl = require("./dashboard.controller");

// If you have an admin auth middleware, enable it:
// const requireAdmin = require("../middleware/requireAdmin");
// router.get("/dashboard", requireAdmin, ctrl.getDashboard);

router.get("/dashboard", ctrl.getDashboard);

module.exports = router;

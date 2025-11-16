// src/admins/routes/index.routes.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const auth = require("../controllers/auth.controller");
const dashboard = require("../controllers/dashboard.controller");

// sanity checks...
if (typeof requireAuth !== "function") throw new Error("requireAuth is not a function");
if (typeof requireAdmin !== "function") throw new Error("requireAdmin is not a function");
if (typeof auth?.login !== "function") throw new Error("auth.login is not a function");
if (typeof auth?.me !== "function") throw new Error("auth.me is not a function");
if (typeof auth?.logout !== "function") throw new Error("auth.logout is not a function");
if (typeof dashboard?.getDashboard !== "function") {
  throw new Error("dashboard.getDashboard is not a function");
}

// ========== public ==========
router.post("/login", auth.login);

// ========== admin-only auth ==========
router.get("/me", requireAuth, requireAdmin, auth.me);
router.post("/logout", requireAuth, requireAdmin, auth.logout);

// ========== dashboard stats ==========
router.get("/dashboard", requireAuth, requireAdmin, dashboard.getDashboard);

// ========== payments (mounted from its own routes file) ==========
router.use("/", require("./payments.routes"));

// ========== listings (MongoDB) ==========
router.use("/listings", require("./listings.routes"));

router.get("/_ping", (_req, res) => res.json({ status: "ok" }));

module.exports = router;

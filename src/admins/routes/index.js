// src/admins/routes/index.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const auth = require("../controllers/auth.controller");

// (optional) sanity checks
if (typeof requireAuth !== "function") throw new Error("requireAuth is not a function");
if (typeof requireAdmin !== "function") throw new Error("requireAdmin is not a function");
if (typeof auth?.login !== "function") throw new Error("auth.login is not a function");
if (typeof auth?.me !== "function") throw new Error("auth.me is not a function");
if (typeof auth?.logout !== "function") throw new Error("auth.logout is not a function");

// public
router.post("/login", auth.login);

// admin-only
router.get("/me", requireAuth, requireAdmin, auth.me);
router.post("/logout", requireAuth, requireAdmin, auth.logout);

// example protected endpoint
router.get("/dashboard-stats", requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;

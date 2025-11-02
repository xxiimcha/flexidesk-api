// src/admins/routes/index.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth"); // <-- two levels up
const auth = require("../controllers/auth.controller");

// quick sanity checks to catch wrong imports early
if (typeof requireAuth !== "function") throw new Error("requireAuth is not a function");
if (typeof requireAdmin !== "function") throw new Error("requireAdmin is not a function");
if (typeof auth?.login !== "function") throw new Error("auth.login is not a function");
if (typeof auth?.me !== "function") throw new Error("auth.me is not a function");
if (typeof auth?.logout !== "function") throw new Error("auth.logout is not a function");

// routes
router.post("/login", auth.login);                               // public
router.get("/me", requireAuth, requireAdmin, auth.me);           // admin-only
router.post("/logout", requireAuth, requireAdmin, auth.logout);  // admin-only

module.exports = router;

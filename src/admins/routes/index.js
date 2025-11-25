const express = require("express");
const router = express.Router();

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const auth = require("../controllers/auth.controller");
const dashboard = require("../controllers/dashboard.controller");

if (typeof requireAuth !== "function") throw new Error("requireAuth is not a function");
if (typeof requireAdmin !== "function") throw new Error("requireAdmin is not a function");
if (typeof auth?.login !== "function") throw new Error("auth.login is not a function");
if (typeof auth?.me !== "function") throw new Error("auth.me is not a function");
if (typeof auth?.logout !== "function") throw new Error("auth.logout is not a function");
if (typeof dashboard?.getDashboard !== "function") {
  throw new Error("dashboard.getDashboard is not a function");
}

router.post("/login", auth.login);

router.get("/me", requireAuth, requireAdmin, auth.me);
router.post("/logout", requireAuth, requireAdmin, auth.logout);

router.get("/dashboard", requireAuth, requireAdmin, dashboard.getDashboard);

router.use("/", require("./payments.routes"));
router.use("/listings", require("./listings.routes"));
router.use("/users", require("./users.routes"));
router.use("/analytics", require("./analytics.routes"));
router.use("/cases", require("./cases.routes"));
router.use("/reports", require("./reports.route"));
router.use("/bookings", require("./bookings.routes"));

router.get("/_ping", (_req, res) => res.json({ status: "ok" }));

module.exports = router;

// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./src/config/db");

const app = express();

const allowedOrigins = [
  process.env.APP_URL,           
  process.env.APP_URL_2,       
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "up" }));
app.use("/api", require("./src/routes/emailTest.routes"));

app.use("/api/auth", require("./src/routes/auth.routes"));
app.use("/api/users", require("./src/routes/users.routes"));
app.use("/api/listings", require("./src/routes/listings.routes"));
app.use("/api/saves", require("./src/routes/saves.routes"));
app.use("/api/bookings", require("./src/routes/bookings.routes"));
app.use("/api/inquiries", require("./src/routes/inquiries.routes"));
app.use("/api/account", require("./src/routes/account.routes"));

app.use("/api/owner", require("./src/owners"));
app.use("/api/admin", require("./src/admins"));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not Found" });
  }
  next();
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.message || err);
  res.status(500).json({ error: "Unexpected server error" });
});

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
})();

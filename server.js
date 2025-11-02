const express = require("express");
const cors = require("cors");
const cookie = require("cookie-parser");
const { connectDB } = require("./src/config/db");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: process.env.APP_URL, // your Vite dev server
  credentials: true
}));
app.use(express.json());
app.use(cookie());

// simple health check
app.get("/api/health", (_req, res) => res.json({ status: "up" }));

// routes
app.use("/api/auth", require("./src/routes/auth.routes"));
app.use("/api/users", require("./src/routes/users.routes"));
app.use("/api/listings", require("./src/routes/listings.routes"));
app.use("/api/saves", require("./src/routes/saves.routes"));
app.use("/api/bookings", require("./src/routes/bookings.routes"));

// owner routes
app.use("/api/owner", require("./src/owners")); 

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () =>
    console.log(`API listening on http://localhost:${PORT}`)
  );
})();

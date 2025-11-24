const User = require("../models/User");
const Booking = require("../models/Booking");

function buildFallbackProfile(user) {
  const now = new Date();
  const createdYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : now.getFullYear();
  const yearsOn = now.getFullYear() - createdYear || 0;

  return {
    name: user?.name || user?.fullName || (user?.email ? user.email.split("@")[0] : "Guest"),
    role: "Guest",
    avatar:
      user?.avatar ||
      user?.avatarUrl ||
      "https://i.pravatar.cc/160?img=13",
    location:
      user?.city && user?.country
        ? `${user.city}, ${user.country}`
        : "Philippines",
    yearsOn,
    trips: 0,
    reviews: 0,
    bio: user?.bio || "Loves discovering new workspaces.",
    verified: !!user?.isVerified,
  };
}

function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end || start);

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";

  const sameDay = s.toDateString() === e.toDateString();
  const sameYear = s.getFullYear() === e.getFullYear();

  if (sameDay) {
    return s.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (sameYear) {
    const left = s.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });
    const right = e.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }

  const left = s.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const right = e.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${left} – ${right}`;
}

exports.getAccount = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(uid).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const profile = buildFallbackProfile(user);

    const bookings = await Booking.find({
      client: user._id,
      status: { $in: ["completed", "finished", "checked_out"] },
    })
      .populate("listing")
      .sort({ startDate: -1 })
      .lean()
      .catch(() => []);

    const tripsByYear = {};

    if (Array.isArray(bookings)) {
      bookings.forEach((b) => {
        const start = b.startDate || b.checkIn || b.from || b.dateFrom;
        const end = b.endDate || b.checkOut || b.to || b.dateTo;
        const listing = b.listing || {};
        const startDate = new Date(start);
        if (Number.isNaN(startDate.getTime())) return;

        const year = startDate.getFullYear();
        const title =
          listing.city ||
          listing.venue ||
          listing.address ||
          listing.title ||
          "Workspace";
        const img =
          listing.coverImage ||
          (Array.isArray(listing.images) && listing.images[0]) ||
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop";

        if (!tripsByYear[year]) tripsByYear[year] = [];

        tripsByYear[year].push({
          id: String(b._id),
          title,
          dates: formatDateRange(start, end),
          img,
        });
      });
    }

    const trips = Object.keys(tripsByYear)
      .sort((a, b) => Number(b) - Number(a))
      .map((year) => ({
        year: Number(year),
        items: tripsByYear[year],
      }));

    profile.trips = bookings?.length || 0;

    const reviews = [];

    const response = {
      profile,
      reviews,
      trips,
    };

    return res.json(response);
  } catch (e) {
    return res.status(500).json({ message: e.message || "Server error" });
  }
};

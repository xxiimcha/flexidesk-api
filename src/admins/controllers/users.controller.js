const mongoose = require("mongoose");
const User = require("../../models/User");
const Listing = require("../../models/Listing");
const VerificationLog = require("../../models/VerificationLog");

// GET /api/admin/users
// Query: page, pageSize, role, vstatus, search
async function listUsers(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize, 10) || 10, 1);

    const { role = "all", vstatus = "all", search = "" } = req.query;

    const filter = {};

    if (role !== "all") {
      filter.role = role;
    }

    if (vstatus !== "all") {
      filter["verification.status"] = vstatus;
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ fullName: regex }, { email: regex }];
    }

    const total = await User.countDocuments(filter);

    const items = await User.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .select("fullName email role verification updatedAt createdAt")
      .lean();

    const mapped = items.map((u) => ({
      id: u._id.toString(),
      fullName: u.fullName || "",
      email: u.email || "",
      role: u.role || "client",
      verification: u.verification || {},
      updatedAt: u.updatedAt || u.createdAt || null,
    }));

    res.json({
      items: mapped,
      total,
      page,
      pageSize,
      hasNext: page * pageSize < total,
    });
  } catch (err) {
    console.error("listUsers error", err);
    res.status(500).json({ message: "Failed to load users." });
  }
}

// POST /api/admin/users/:id/verify
// body: { status: "verified" | "rejected", note?: string }
async function verifyUserId(req, res) {
  try {
    const { id } = req.params;
    const { status, note = "" } = req.body;

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.verification = {
      ...(user.verification || {}),
      status,
      reviewedAt: new Date(),
      reviewedBy: req.user?._id || null,
      notes: note || user.verification?.notes || "",
      idUrl: user.verification?.idUrl || null,
    };
    await user.save();

    await VerificationLog.create({
      type: "user_id",
      action: status === "verified" ? "approve" : "reject",
      userId: user._id,
      notes: note,
      createdBy: req.user?._id || null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("verifyUserId error", err);
    res.status(500).json({ message: "Failed to update verification." });
  }
}

// GET /api/admin/users/:id/pending-listings
async function getPendingListingsByOwner(req, res) {
  try {
    const { id } = req.params;

    const listings = await Listing.find({
      ownerId: id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .select("title name status ownerId")
      .lean();

    const mapped = listings.map((ls) => ({
      id: ls._id.toString(),
      title: ls.title || ls.name || "",
      status: ls.status,
      ownerId: ls.ownerId?.toString?.() || "",
    }));

    res.json({ items: mapped });
  } catch (err) {
    console.error("getPendingListingsByOwner error", err);
    res.status(500).json({ message: "Failed to load listings." });
  }
}

// POST /api/admin/listings/:id/approve
async function approveListing(req, res) {
  try {
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ message: "Listing not found." });

    listing.status = "active";
    listing.reviewedAt = new Date();
    await listing.save();

    await VerificationLog.create({
      type: "listing",
      action: "approve",
      listingId: listing._id,
      ownerId: listing.ownerId || listing.owner || null,
      notes: "",
      createdBy: req.user?._id || null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("approveListing error", err);
    res.status(500).json({ message: "Failed to approve listing." });
  }
}

// POST /api/admin/listings/:id/reject
// body: { note?: string }
async function rejectListing(req, res) {
  try {
    const { id } = req.params;
    const { note = "Does not meet guidelines" } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ message: "Listing not found." });

    listing.status = "rejected";
    listing.reviewedAt = new Date();
    listing.notes = note;
    await listing.save();

    await VerificationLog.create({
      type: "listing",
      action: "reject",
      listingId: listing._id,
      ownerId: listing.ownerId || listing.owner || null,
      notes: note,
      createdBy: req.user?._id || null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("rejectListing error", err);
    res.status(500).json({ message: "Failed to reject listing." });
  }
}

// GET /api/admin/users/:id/logs
async function getVerificationLogs(req, res) {
  try {
    const { id } = req.params;
    const objectId = new mongoose.Types.ObjectId(id);

    const logs = await VerificationLog.find({
      $or: [{ userId: objectId }, { ownerId: objectId }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const mapped = logs.map((log) => ({
      id: log._id.toString(),
      type: log.type,
      action: log.action,
      userId: log.userId?.toString?.(),
      ownerId: log.ownerId?.toString?.(),
      listingId: log.listingId?.toString?.(),
      notes: log.notes || "",
      createdAt: log.createdAt,
    }));

    res.json({ items: mapped });
  } catch (err) {
    console.error("getVerificationLogs error", err);
    res.status(500).json({ message: "Failed to load logs." });
  }
}

module.exports = {
  listUsers,
  verifyUserId,
  getPendingListingsByOwner,
  approveListing,
  rejectListing,
  getVerificationLogs,
};

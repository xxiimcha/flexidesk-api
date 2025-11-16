// controllers/owner/listings.controller.js
const Listing = require("../../models/Listing");
const User = require("../../models/User");
const { signJwt } = require("../../utils/jwt");

exports.create = async (req, res) => {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let upgradedToken = null;
    if (user.role === "client") {
      user.role = "owner";
      await user.save();
      upgradedToken = signJwt({ uid: user.id, email: user.email, role: user.role });
    }

    const listing = await Listing.create({
      owner: user._id,
      ...req.body,
      status: "draft",
    });

    res.json({
      id: String(listing._id),
      ...(upgradedToken ? { token: upgradedToken } : {}),
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Create failed" });
  }
};

exports.listMine = async (req, res) => {
  try {
    const { status, limit = 12, cursor } = req.query;
    const q = { owner: req.user.uid };
    if (status) q.status = status;

    const pageSize = Math.min(Number(limit) || 12, 50);
    const find = Listing.find(q).sort({ updatedAt: -1, _id: -1 }).limit(pageSize + 1);
    if (cursor) find.where({ _id: { $lt: cursor } });

    const docs = await find.lean();
    const hasMore = docs.length > pageSize;
    if (hasMore) docs.pop();

    res.json({
      items: docs.map((d) => ({ id: String(d._id), ...d })),
      nextCursor: hasMore ? String(docs[docs.length - 1]._id) : null,
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load listings" });
  }
};

exports.getById = async (req, res) => {
  try {
    const doc = await Listing.findOne({ _id: req.params.id, owner: req.user.uid }).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json({ listing: { id: String(doc._id), ...doc } });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load listing" });
  }
};

exports.update = async (req, res) => {
  try {
    const fields = { ...req.body, updatedAt: new Date() };
    delete fields._id;
    delete fields.owner;

    const doc = await Listing.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.uid },
      { $set: fields },
      { new: true }
    ).lean();

    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json({ listing: { id: String(doc._id), ...doc } });
  } catch (e) {
    res.status(500).json({ message: e.message || "Update failed" });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "active", "archived"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const doc = await Listing.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.uid },
      { $set: { status } },
      { new: true }
    ).lean();

    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json({ status: doc.status, updatedAt: doc.updatedAt });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to update status" });
  }
};

exports.remove = async (req, res) => {
  try {
    const doc = await Listing.findOneAndDelete({ _id: req.params.id, owner: req.user.uid }).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message || "Delete failed" });
  }
};

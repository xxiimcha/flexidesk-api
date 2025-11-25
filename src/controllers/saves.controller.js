const Save = require("../models/Save");
const Listing = require("../models/Listing");

exports.list = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const saves = await Save.find({ userId })
      .populate("listingId")
      .sort({ createdAt: -1 })
      .lean();

    const items = saves
      .map((s) => s.listingId)
      .filter(Boolean);

    res.json(items);
  } catch (err) {
    next(err);
  }
};

exports.check = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    const saved = await Save.exists({ userId, listingId });
    res.json({ saved: !!saved });
  } catch (err) {
    next(err);
  }
};

exports.save = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;

    const exists = await Listing.exists({ _id: listingId });
    if (!exists) {
      return res.status(404).json({ message: "Listing not found" });
    }

    await Save.updateOne(
      { userId, listingId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    res.json({ ok: true, saved: true });
  } catch (err) {
    next(err);
  }
};

exports.unsave = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    await Save.deleteOne({ userId, listingId });
    res.json({ ok: true, saved: false });
  } catch (err) {
    next(err);
  }
};

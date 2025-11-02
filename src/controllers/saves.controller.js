const Save = require("../models/Save");

exports.check = async (req, res, next) => {
  try {
    const userId = req.user.id;           
    const { listingId } = req.params;
    const saved = await Save.exists({ userId, listingId });
    res.json({ saved: !!saved });
  } catch (err) { next(err); }
};

exports.save = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    await Save.updateOne(
      { userId, listingId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true, saved: true });
  } catch (err) { next(err); }
};

exports.unsave = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    await Save.deleteOne({ userId, listingId });
    res.json({ ok: true, saved: false });
  } catch (err) { next(err); }
};

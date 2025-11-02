// Public listings controller
const Listing = require("../models/Listing");

/**
 * GET /api/listings?status=active&limit=24&cursor=<_id>
 * Public list of listings by status (default: active).
 */
exports.listPublic = async (req, res) => {
  try {
    const {
      status = "active",
      limit = 24,
      cursor, // optional _id cursor for pagination
    } = req.query;

    const pageSize = Math.min(Number(limit) || 24, 50);

    const q = {};
    if (status) q.status = status; // "active" for public

    const find = Listing.find(q)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(pageSize + 1);

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

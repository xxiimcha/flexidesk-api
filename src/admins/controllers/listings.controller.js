const mongoose = require("mongoose");
const Listing = require("../../models/Listing");
const User = require("../../models/User");

function pickName(u) {
  if (!u) return null;
  return (
    u.fullName ||
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.email ||
    String(u._id)
  );
}

function dbToApi(r, ownerDoc) {
  return {
    id: String(r._id),
    name: r.venue || "Untitled",
    type: r.category || "hot_desk",
    status: r.status || "draft",
    priceHourly: r.priceSeatHour ?? null,
    capacity: typeof r.seats === "number" ? r.seats : null,
    location: r.city || "",
    address: [r.address, r.address2].filter(Boolean).join(", "),
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    venue: r.venue,
    city: r.city,
    address2: r.address2,
    shortDesc: r.shortDesc,
    longDesc: r.longDesc,
    amenities: r.amenities || {},
    isFeatured: !!r.isFeatured,
    owner: r.owner
      ? {
          id: String(r.owner),
          name: pickName(ownerDoc),
          email: ownerDoc?.email || null,
        }
      : null,
  };
}

function apiToDb(src) {
  const out = {};

  if (src.name !== undefined) out.venue = String(src.name).trim();
  if (src.type !== undefined) out.category = String(src.type).trim();
  if (src.status !== undefined) out.status = String(src.status).trim();

  if (src.priceHourly !== undefined) {
    const n = Number(src.priceHourly);
    out.priceSeatHour = Number.isFinite(n) ? n : null;
  }

  if (src.capacity !== undefined) {
    const n = Number(src.capacity);
    out.seats = Number.isFinite(n) ? n : 0;
  }

  if (src.location !== undefined) out.city = String(src.location).trim();

  if (src.address !== undefined) {
    const s = String(src.address).trim();
    const [line1, ...rest] = s.split(/\s*,\s*/);
    out.address = line1 || "";
    out.address2 = rest.join(", ");
  }

  if (src.description !== undefined) {
    out.longDesc = String(src.description).trim();
    if (!src.shortDesc && out.longDesc) out.shortDesc = out.longDesc.slice(0, 120);
  }

  if (src.amenities !== undefined) {
    let list = [];
    if (Array.isArray(src.amenities))
      list = src.amenities.map((s) => String(s).trim()).filter(Boolean);
    else if (typeof src.amenities === "string")
      list = src.amenities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const known = ["wifi", "ac", "power", "coffee", "whiteboard", "projector"];
    out.amenities = {};
    known.forEach((k) => {
      out.amenities[k] = list.includes(k);
    });
  }

  if (src.isFeatured !== undefined) {
    out.isFeatured = !!src.isFeatured;
  }

  return out;
}

function parseSort(sortParam) {
  const fallback = { updatedAt: -1, _id: -1 };
  const map = {
    updatedAt: "updatedAt",
    priceHourly: "priceSeatHour",
    capacity: "seats",
    name: "venue",
  };
  if (!sortParam) return fallback;
  const [field, dir] = String(sortParam).split("_");
  const dbField = map[field];
  if (!dbField) return fallback;
  const direction = dir === "asc" ? 1 : -1;
  return { [dbField]: direction, _id: direction };
}

function buildFilter(q) {
  const filter = {};
  if (q.status && q.status !== "all") filter.status = q.status;
  if (q.type && q.type !== "all") filter.category = q.type;
  if (q.search && String(q.search).trim()) {
    const s = String(q.search).trim();
    const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ venue: rx }, { address: rx }, { city: rx }];
  }
  if (q.featured === "featured") filter.isFeatured = true;
  if (q.featured === "not_featured") filter.isFeatured = { $ne: true };
  return filter;
}

exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const sort = parseSort(req.query.sort);
    const filter = buildFilter(req.query);

    const cursor = req.query.cursor;
    const sortField = Object.keys(sort)[0] || "updatedAt";
    const sortDir = sort[sortField] === 1 ? 1 : -1;

    const find = { ...filter };

    if (cursor) {
      if (!mongoose.isValidObjectId(cursor))
        return res.status(400).json({ error: "Invalid cursor" });
      const cursorDoc = await Listing.findById(cursor)
        .select({ [sortField]: 1, _id: 1 })
        .lean();
      if (cursorDoc) {
        const fieldVal = cursorDoc[sortField];
        if (sortField === "_id") {
          find._id =
            sortDir === 1 ? { $gt: cursorDoc._id } : { $lt: cursorDoc._id };
        } else {
          find.$or = [
            {
              [sortField]:
                sortDir === 1 ? { $gt: fieldVal } : { $lt: fieldVal },
            },
            {
              [sortField]: fieldVal,
              _id:
                sortDir === 1
                  ? { $gt: cursorDoc._id }
                  : { $lt: cursorDoc._id },
            },
          ];
        }
      }
    }

    const rows = await Listing.find(find)
      .sort(sort)
      .limit(limit + 1)
      .populate("owner", "fullName email")
      .lean();

    let nextCursor = null;
    if (rows.length > limit) {
      nextCursor = String(rows[limit - 1]._id);
      rows.length = limit;
    }

    res.json({
      items: rows.map((r) =>
        dbToApi(r, {
          name: r.owner?.fullName || r.owner?.name || null,
          email: r.owner?.email || null,
        })
      ),
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });

    const doc = await Listing.findById(id)
      .populate("owner", "fullName email")
      .lean();
    if (!doc) return res.status(404).json({ error: "Not found" });

    res.json({
      item: {
        ...doc,
        owner: doc.owner
          ? {
              id: String(doc.owner._id),
              name: doc.owner.fullName || doc.owner.name || null,
              email: doc.owner.email || null,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const payload = apiToDb(req.body || {});
    if (!payload.venue)
      return res.status(400).json({ error: "Name (venue) is required" });
    const doc = await Listing.create(payload);
    res.status(201).json({ id: String(doc._id) });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });
    const payload = apiToDb(req.body || {});
    await Listing.findByIdAndUpdate(id, payload, { runValidators: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });
    if (!["active", "draft", "archived"].includes(status))
      return res.status(400).json({ error: "Invalid status" });
    await Listing.findByIdAndUpdate(id, { status }, { runValidators: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.updateFeatured = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { featured } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });

    if (typeof featured !== "boolean")
      return res.status(400).json({ error: "featured must be boolean" });

    const doc = await Listing.findByIdAndUpdate(
      id,
      { isFeatured: featured },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) return res.status(404).json({ error: "Not found" });

    return res.json({ ok: true, isFeatured: !!doc.isFeatured });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });
    await Listing.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

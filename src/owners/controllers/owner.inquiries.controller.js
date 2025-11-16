const Inquiry = require("../../models/Inquiry");
const Listing = require("../../models/Listing");
const User = require("../../models/User");

const uid = (req) => req.user?.uid || null;

function toId(v) {
  if (!v) return null;
  return typeof v === "string" ? v : String(v);
}

exports.getOwnerInquiriesMine = async function getOwnerInquiriesMine(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) return res.status(401).json({ message: "Unauthorized" });

    const docs = await Inquiry.find({ hostId: ownerId })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    const listingIds = Array.from(
      new Set(
        docs
          .map((d) => toId(d.listingId))
          .filter(Boolean)
      )
    );

    const guestIds = Array.from(
      new Set(
        docs
          .map((d) => toId(d.guestId))
          .filter(Boolean)
      )
    );

    const [listingDocs, guestDocs] = await Promise.all([
      Listing.find({ _id: { $in: listingIds } })
        .select("shortDesc title city region country")
        .lean(),
      User.find({ _id: { $in: guestIds } })
        .select("fullName name email")
        .lean(),
    ]);

    const listingMap = Object.fromEntries(
      listingDocs.map((l) => [toId(l._id), l])
    );
    const guestMap = Object.fromEntries(
      guestDocs.map((u) => [toId(u._id), u])
    );

    const items = docs.map((doc) => {
      const listing = listingMap[toId(doc.listingId)] || null;
      const guest = guestMap[toId(doc.guestId)] || null;

      const messages = doc.messages || [];
      const lastMessage = messages.length ? messages[messages.length - 1] : null;

      const guestName =
        doc.guestName ||
        (guest && (guest.fullName || guest.name || guest.email)) ||
        "Guest";

      const unreadCount =
        typeof doc.unreadCountHost === "number"
          ? doc.unreadCountHost
          : 0;

      const lastMsg = lastMessage
        ? {
            text: lastMessage.body,
            from:
              toId(lastMessage.senderId) === toId(ownerId)
                ? "owner"
                : "guest",
            createdAt: lastMessage.createdAt,
            read: Array.isArray(lastMessage.readBy)
              ? lastMessage.readBy
                  .map((x) => toId(x))
                  .includes(toId(ownerId))
              : false,
          }
        : null;

      return {
        id: doc._id,
        guestName,
        listing: listing
          ? {
              _id: listing._id,
              shortDesc: listing.shortDesc,
              title: listing.title,
              city: listing.city,
              region: listing.region,
              country: listing.country,
            }
          : null,
        lastMessage: lastMsg,
        unreadCount,
      };
    });

    return res.json({ items });
  } catch (err) {
    console.error("getOwnerInquiriesMine error:", err);
    return res.status(500).json({ message: "Failed to load inquiries" });
  }
};

exports.getOwnerInquiryById = async function getOwnerInquiryById(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) return res.status(401).json({ message: "Unauthorized" });

    const id = req.params.id;

    const doc = await Inquiry.findOne({ _id: id, hostId: ownerId }).lean();
    if (!doc) return res.status(404).json({ message: "Inquiry not found" });

    const listing = doc.listingId
      ? await Listing.findById(doc.listingId)
          .select("shortDesc title city region country")
          .lean()
      : null;

    const guest = doc.guestId
      ? await User.findById(doc.guestId)
          .select("fullName name email")
          .lean()
      : null;

    const guestName =
      doc.guestName ||
      (guest && (guest.fullName || guest.name || guest.email)) ||
      "Guest";

    const listingShape = listing
      ? {
          _id: listing._id,
          shortDesc: listing.shortDesc,
          title: listing.title,
          city: listing.city,
          region: listing.region,
          country: listing.country,
        }
      : null;

    const messages = (doc.messages || []).map((m) => ({
      _id: m._id,
      text: m.body,
      from: toId(m.senderId) === toId(ownerId) ? "owner" : "guest",
      read: Array.isArray(m.readBy)
        ? m.readBy.map((x) => toId(x)).includes(toId(ownerId))
        : false,
      createdAt: m.createdAt,
    }));

    return res.json({
      id: doc._id,
      guestName,
      listing: listingShape,
      messages,
    });
  } catch (err) {
    console.error("getOwnerInquiryById error:", err);
    return res.status(500).json({ message: "Failed to load inquiry" });
  }
};

exports.replyOwnerInquiry = async function replyOwnerInquiry(req, res) {
  try {
    const ownerId = uid(req);
    if (!ownerId) return res.status(401).json({ message: "Unauthorized" });

    const id = req.params.id;
    const text = String(req.body.message || "").trim();
    if (!text) return res.status(400).json({ message: "Message is required" });

    const doc = await Inquiry.findOne({ _id: id, hostId: ownerId }).exec();
    if (!doc) return res.status(404).json({ message: "Inquiry not found" });

    const now = new Date();
    const msg = {
      senderId: ownerId,
      body: text,
      createdAt: now,
      readBy: [ownerId],
    };

    doc.messages = doc.messages || [];
    doc.messages.push(msg);
    doc.lastMessageAt = now;
    doc.unreadCountGuest = (doc.unreadCountGuest || 0) + 1;
    doc.unreadCountHost = 0;
    doc.updatedAt = now;

    await doc.save();

    const saved = doc.messages[doc.messages.length - 1];

    return res.status(201).json({
      _id: saved._id,
      text: saved.body,
      from: "owner",
      read: true,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    console.error("replyOwnerInquiry error:", err);
    return res.status(500).json({ message: "Failed to send reply" });
  }
};

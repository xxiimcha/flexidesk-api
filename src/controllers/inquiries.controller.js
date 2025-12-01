// controllers/inquiries.controller.js
const mongoose = require("mongoose");

function isISODate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function isTimeHHMM(s) { return !s || /^\d{2}:\d{2}$/.test(String(s)); }
function diffHours(dateA, timeA, dateB, timeB) {
  try {
    const start = new Date(`${dateA}T${timeA || "00:00"}:00Z`);
    const end = new Date(`${dateB}T${timeB || "00:00"}:00Z`);
    const ms = end - start; if (ms <= 0) return 0;
    const hours = ms / 36e5;
    return Math.ceil(hours * 4) / 4;
  } catch { return 0; }
}
function getUserId(user) { return String(user?.id || user?.uid || user?._id || ""); }

const Inquiry = mongoose.models.Inquiry || require("../models/Inquiry");
const Listing = mongoose.models.Listing || require("../models/Listing");
const User = mongoose.models.User || require("../models/User");

function isAdmin(user) { return user?.role === "admin" || user?.role === "superadmin"; }
function canReadInquiry(inquiry, user) {
  const uid = getUserId(user);
  if (!uid) return false;
  if (isAdmin(user)) return true;
  return String(inquiry.guestId) === uid || String(inquiry.hostId) === uid;
}
function canReplyInquiry(inquiry, user) { return canReadInquiry(inquiry, user); }

/* ---------- helpers for populated fields ---------- */
function listingTitleFrom(doc) {
  const l = doc.listing || doc.listingId;
  return (
    l?.title ||
    l?.name ||
    l?.venue ||
    l?.address ||
    l?.city ||
    "Conversation"
  );
}

function listingPhotoFrom(doc) {
  const l = doc.listing || doc.listingId;
  if (!l) return "";
  const fromArray = Array.isArray(l.photos) && l.photos.length ? l.photos[0] : "";
  const fromMetaUrl =
    Array.isArray(l.photosMeta) && l.photosMeta[0]?.url ? l.photosMeta[0].url : "";
  return l.coverPhoto || fromArray || fromMetaUrl || "";
}

function hostNameFrom(doc) {
  const h = doc.host || doc.hostId;
  return h?.fullName || h?.name || "";
}
function hostAvatarFrom(doc) {
  const h = doc.host || doc.hostId;
  return h?.avatar || "";
}

/* ---------- mappers ---------- */
function mapThreadSummary(doc, meId) {
  const lastMsg = (doc.messages || [])[doc.messages.length - 1];
  const youAreGuest = String(doc.guestId?._id || doc.guestId) === String(meId);
  const unread = youAreGuest ? (doc.unreadCountGuest || 0) : (doc.unreadCountHost || 0);
  return {
    id: String(doc._id),
    space: listingTitleFrom(doc),
    host: hostNameFrom(doc),
    avatar: hostAvatarFrom(doc),
    last: lastMsg?.body || "",
    time: doc.lastMessageAt ? new Date(doc.lastMessageAt).toLocaleString() : "",
    unread,
    reservation: doc.reservation || null,
    listingPhoto: listingPhotoFrom(doc),
    schedule: doc.meta || null,
  };
}

function mapMessages(doc, meId) {
  return (doc.messages || []).map((m) => ({
    id: String(m._id || m.createdAt?.getTime() || Math.random()),
    from: String(m.senderId) === String(meId) ? "me" : "host",
    text: m.body,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    status: (m.readBy || []).some(x => String(x) === String(meId)) ? "read" : "sent",
  }));
}

/* ================== CREATE ================== */
exports.createInquiry = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { listingId, message, to, meta = {} } = req.body || {};
    if (!listingId) return res.status(400).json({ message: "listingId is required" });

    const body = String(message || "").trim();
    if (!body || body.length < 3) return res.status(400).json({ message: "Message is too short" });

    const listing = await Listing.findById(listingId).lean();
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    const hostId = String(to || listing.owner || listing.ownerId || "");
    if (!hostId) return res.status(400).json({ message: "Host not found for this listing" });

    const guestId = String(uid);
    if (guestId === hostId) return res.status(400).json({ message: "You cannot inquire on your own listing" });

    const cleanMeta = {};
    if (isISODate(meta.startDate)) cleanMeta.startDate = meta.startDate;
    if (isISODate(meta.endDate)) cleanMeta.endDate = meta.endDate;
    if (isTimeHHMM(meta.checkInTime)) cleanMeta.checkInTime = meta.checkInTime || null;
    if (isTimeHHMM(meta.checkOutTime)) cleanMeta.checkOutTime = meta.checkOutTime || null;
    const pax = Number(meta.guests || 0); if (pax > 0) cleanMeta.guests = pax;
    const nights = Number(meta.nights || 0); if (nights > 0) cleanMeta.nights = nights;
    let totalHours = Number(meta.totalHours || 0);
    if ((!totalHours || totalHours <= 0) && cleanMeta.startDate && cleanMeta.endDate) {
      totalHours = diffHours(cleanMeta.startDate, cleanMeta.checkInTime, cleanMeta.endDate, cleanMeta.checkOutTime);
    }
    if (totalHours > 0) cleanMeta.totalHours = totalHours;

    const key = `${guestId}_${hostId}_${listingId}`;
    const now = new Date();

    const doc = await Inquiry.create({
      listingId,
      hostId,
      guestId,
      key,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      meta: cleanMeta,
      messages: [{ senderId: guestId, body, createdAt: now, readBy: [guestId] }],
      unreadCountHost: 1,
      unreadCountGuest: 0,
    });

    return res.status(201).json({ ok: true, inquiry: doc });
  } catch (err) { next(err); }
};

/* ================== LIST ================== */
exports.listMyInquiries = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const role = String(req.query.role || "guest").toLowerCase();
    const filter = role === "host" ? { hostId: uid } : { guestId: uid };

    const list = await Inquiry.find(filter)
      .sort({ lastMessageAt: -1 })
      .slice("messages", -1)
      .populate({
        path: "listingId",
        select: "title name venue address city photos coverPhoto photosMeta",
      })
      .populate({ path: "hostId", select: "fullName name avatar" })
      .lean();

    const enriched = list.map(d => ({
      ...d,
      listing: d.listingId || null,
      host: d.hostId || null,
    }));

    const threads = enriched.map(d => mapThreadSummary(d, uid));
    return res.json({ ok: true, threads });
  } catch (err) { next(err); }
};

/* ================== GET ONE ================== */
exports.getInquiry = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const inquiry = await Inquiry.findById(req.params.id)
      .populate({
        path: "listingId",
        select: "title name venue address city photos coverPhoto photosMeta",
      })
      .populate({ path: "hostId", select: "fullName name avatar" });

    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (!canReadInquiry(inquiry, req.user)) return res.status(403).json({ message: "Forbidden" });

    return res.json({ ok: true, inquiry });
  } catch (err) { next(err); }
};

/* ================== MESSAGES ================== */
exports.getInquiryMessages = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (!canReadInquiry(inquiry, req.user)) return res.status(403).json({ message: "Forbidden" });

    const msgs = mapMessages(inquiry, uid);
    return res.json({ ok: true, messages: msgs });
  } catch (err) { next(err); }
};

/* ================== REPLY ================== */
exports.replyInquiry = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (!canReplyInquiry(inquiry, req.user)) return res.status(403).json({ message: "Forbidden" });

    const body = String(req.body?.message || "").trim();
    if (!body || body.length < 2) return res.status(400).json({ message: "Message is too short" });

    const senderId = String(uid);
    const now = new Date();

    inquiry.messages.push({ senderId, body, createdAt: now, readBy: [senderId] });

    const isGuest = String(inquiry.guestId) === senderId;
    if (isGuest) inquiry.unreadCountHost = (inquiry.unreadCountHost || 0) + 1;
    else inquiry.unreadCountGuest = (inquiry.unreadCountGuest || 0) + 1;

    inquiry.lastMessageAt = now;
    inquiry.updatedAt = now;
    await inquiry.save();

    return res.json({ ok: true, inquiry });
  } catch (err) { next(err); }
};

/* ================== MARK READ ================== */
exports.markInquiryRead = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (!canReadInquiry(inquiry, req.user)) return res.status(403).json({ message: "Forbidden" });

    let touched = false;
    inquiry.messages.forEach((m) => {
      if (!m.readBy?.some(x => String(x) === String(uid))) {
        m.readBy = [...(m.readBy || []), uid];
        touched = true;
      }
    });

    if (String(inquiry.guestId) === uid) inquiry.unreadCountGuest = 0;
    else if (String(inquiry.hostId) === uid) inquiry.unreadCountHost = 0;

    if (touched) {
      inquiry.updatedAt = new Date();
      await inquiry.save();
    }
    return res.json({ ok: true });
  } catch (err) { next(err); }
};

/* ================== SET STATUS ================== */
exports.setInquiryStatus = async (req, res, next) => {
  try {
    const uid = getUserId(req.user);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { status } = req.body || {};
    const allowed = ["open", "closed", "archived", "resolved"];
    if (!allowed.includes(String(status))) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}` });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (!canReadInquiry(inquiry, req.user)) return res.status(403).json({ message: "Forbidden" });

    inquiry.status = status;
    inquiry.updatedAt = new Date();
    await inquiry.save();

    return res.json({ ok: true, inquiry });
  } catch (err) { next(err); }
};

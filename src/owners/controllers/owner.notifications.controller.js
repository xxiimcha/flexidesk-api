const Booking = require("../../models/Booking");
const Inquiry = require("../../models/Inquiry");
const Listing = require("../../models/Listing");

exports.getSummary = async (req, res) => {
  try {
    const ownerId = req.user.uid;

    // STEP 1: Find all listings owned by this host
    const listings = await Listing.find({ owner: ownerId }, { _id: 1 }).lean();
    const listingIds = listings.map(l => l._id);

    // STEP 2: Count NEW BOOKINGS / PAYMENTS
    // You can adjust the statuses you consider as "new"
    const newBookings = await Booking.find({
      listingId: { $in: listingIds },
      status: { $in: ["pending", "confirmed", "paid"] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const newBookingsCount = newBookings.length;

    // STEP 3: Count UNREAD INQUIRY MESSAGES
    const unreadInquiries = await Inquiry.find({
      hostId: ownerId,
      unreadCountHost: { $gt: 0 }
    })
      .sort({ lastMessageAt: -1 })
      .limit(5)
      .lean();

    const unreadInquiriesCount = unreadInquiries.length;

    // STEP 4: Compose response
    return res.json({
      bookings: {
        unreadCount: newBookingsCount,
        latest: newBookings.map(b => ({
          id: b._id,
          listingId: b.listingId,
          status: b.status,
          startDate: b.startDate,
          endDate: b.endDate,
          amount: b.amount,
          createdAt: b.createdAt
        }))
      },
      inquiries: {
        unreadCount: unreadInquiriesCount,
        latest: unreadInquiries.map(i => ({
          id: i._id,
          listingId: i.listingId,
          guestId: i.guestId,
          lastMessageAt: i.lastMessageAt,
          meta: i.meta
        }))
      },
      totalUnread: newBookingsCount + unreadInquiriesCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

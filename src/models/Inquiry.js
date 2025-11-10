// models/Inquiry.js
const { Schema, model, Types } = require("mongoose");

const MessageSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: true },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: true, id: false }
);

const InquirySchema = new Schema(
  {
    // Optional human/debug key; not used for uniqueness
    key: { type: String, index: true },

    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    hostId:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    guestId:   { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    status: {
      type: String,
      enum: ["open", "closed", "archived", "resolved"],
      default: "open",
      index: true,
    },

    meta: {
      startDate: String,    // "YYYY-MM-DD"
      endDate: String,      // "YYYY-MM-DD"
      checkInTime: String,  // "HH:MM"
      checkOutTime: String, // "HH:MM"
      guests: Number,
      nights: Number,
      totalHours: Number,
    },

    messages: [MessageSchema],

    unreadCountHost: { type: Number, default: 0 },
    unreadCountGuest: { type: Number, default: 0 },

    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,        // adds createdAt, updatedAt
    versionKey: false,
    minimize: false,
  }
);

// One active conversation per guest↔host↔listing
InquirySchema.index(
  { guestId: 1, hostId: 1, listingId: 1 },
  { unique: true, name: "uniq_guest_host_listing" }
);

// Keep lastMessageAt in sync when messages are added
InquirySchema.pre("save", function (next) {
  if (this.isModified("messages") && Array.isArray(this.messages) && this.messages.length) {
    const last = this.messages[this.messages.length - 1];
    if (last?.createdAt) this.lastMessageAt = last.createdAt;
    else this.lastMessageAt = new Date();
  }
  next();
});

module.exports = model("Inquiry", InquirySchema);

// models/Listing.js
const { Schema, model, Types } = require("mongoose");

const Money = { type: Number, default: 0 };

const ListingSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: "User", required: true, index: true },

    category: String,
    scope: String,
    venue: String,

    address: String,
    address2: String,
    district: String,
    city: String,
    region: String,
    zip: String,
    country: String,
    lat: String,
    lng: String,
    showApprox: { type: Boolean, default: false },

    seats: { type: Number, default: 0 },
    rooms: { type: Number, default: 0 },
    privateRooms: { type: Number, default: 0 },
    minHours: { type: Number, default: 0 },
    hasLocks: { type: Boolean, default: false },

    shortDesc: String,
    longDesc: String,
    wifiMbps: String,
    outletsPerSeat: String,
    noiseLevel: String,

    currency: { type: String, default: "PHP" },
    priceSeatDay: Money,
    priceSeatHour: Money,
    priceRoomHour: Money,
    priceRoomDay: Money,
    priceWholeDay: Money,
    priceWholeMonth: Money,
    serviceFee: Money,
    cleaningFee: Money,

    amenities: { type: Schema.Types.Mixed, default: {} },
    accessibility: { type: Schema.Types.Mixed, default: {} },
    parking: { type: String, default: "none" },

    photosMeta: { type: Array, default: [] },
    coverIndex: { type: Number, default: 0 },

    customMessage: { type: String, default: "" },
    guestNotes: { type: String, default: "" },
    openingHoursWeekdays: { type: String, default: "" },
    openingHoursWeekends: { type: String, default: "" },
    checkinInstructions: { type: String, default: "" },
    otherRules: { type: String, default: "" },

    status: { type: String, enum: ["draft", "active", "archived"], default: "draft", index: true },
    isFeatured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = model("Listing", ListingSchema);

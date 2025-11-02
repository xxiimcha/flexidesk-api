const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },

    startDate: { type: String, required: true }, 
    endDate: { type: String, required: true },
    nights: { type: Number, default: 1 },
    guests: { type: Number, default: 1 },

    currency: { type: String, default: "PHP" },
    amount: { type: Number, required: true }, 

    status: { type: String, enum: ["pending_payment", "paid", "cancelled"], default: "pending_payment" },
    provider: { type: String, default: "paymongo" },

    payment: {
      checkoutId: String,
      checkoutUrl: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", BookingSchema);

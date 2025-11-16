const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
    },

    images: [
      {
        url: String,
        key: String, // if using S3 or Cloudinary public_id
      },
    ],

    // For admin moderation
    status: {
      type: String,
      enum: ["visible", "hidden", "flagged"],
      default: "visible",
      index: true,
    },

    flaggedReason: {
      type: String,
      default: "",
    },

    // Owner response to review
    ownerReply: {
      message: { type: String, default: "" },
      repliedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

/* Prevent multi-review abuse:
   One user should only review a specific booking once */
ReviewSchema.index({ user: 1, booking: 1 }, { unique: true });

module.exports = mongoose.model("Review", ReviewSchema);

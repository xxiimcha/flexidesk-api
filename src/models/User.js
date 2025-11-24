const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["client", "owner", "admin"],
      default: "client",
      index: true,
    },

    avatar: { type: String },

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationCode: {
      type: String,
      default: null,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
    },

    identityStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
      index: true,
    },

    identityType: {
      type: String,
      default: null,
      trim: true,
    },

    identityNumberLast4: {
      type: String,
      default: null,
      trim: true,
    },

    identityDocumentFrontUrl: {
      type: String,
      default: null,
    },

    identityDocumentBackUrl: {
      type: String,
      default: null,
    },

    identityVerifiedAt: {
      type: Date,
      default: null,
    },

    identityReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    identityReviewNotes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

UserSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

UserSchema.virtual("isIdentityVerified").get(function () {
  return this.identityStatus === "verified";
});

module.exports = model("User", UserSchema);

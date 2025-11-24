const { Schema, model, Types } = require("mongoose");

const PreferencesSchema = new Schema(
  {
    workspaceType: { type: String, default: "any" },
    seatingPreference: { type: String, default: "any" },
    allowInstantBookings: { type: Boolean, default: true },
    preferredCity: { type: String, default: "" },
    receiveEmailUpdates: { type: Boolean, default: true },
  },
  { _id: false }
);

const IdentityDocumentSchema = new Schema(
  {
    type: { type: String },
    url: { type: String },
    publicId: { type: String },
  },
  { _id: false }
);

const ClientProfileSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, unique: true },

    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    bio: { type: String, default: "" },
    location: { type: String, default: "" },

    identityStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },

    identityDocuments: [IdentityDocumentSchema],

    preferences: {
      type: PreferencesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = model("ClientProfile", ClientProfileSchema);

const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },
    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["client", "owner", "admin"],
      default: "client",
      index: true
    },

    avatar: { type: String },

    failedLoginAttempts: {
      type: Number,
      default: 0
    },

    lockUntil: {
      type: Date,
      default: null
    },

    emailVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationCode: {
      type: String,
      default: null
    },

    emailVerificationExpires: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// virtual: check if account is currently locked
UserSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

module.exports = model("User", UserSchema);

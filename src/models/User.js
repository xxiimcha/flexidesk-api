const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["client", "owner", "admin"], default: "client", index: true },
    avatar: { type: String }
  },
  { timestamps: true }
);

module.exports = model("User", UserSchema);

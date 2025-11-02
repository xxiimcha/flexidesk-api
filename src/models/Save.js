const mongoose = require("mongoose");

const SaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  createdAt: { type: Date, default: Date.now },
});
SaveSchema.index({ userId: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model("Save", SaveSchema);

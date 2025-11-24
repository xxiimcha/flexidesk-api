const User = require("../models/User");
const ClientProfile = require("../models/ClientProfile");
const cloudinary = require("../utils/cloudinary");

const DEFAULT_PREFS = {
  workspaceType: "any",
  seatingPreference: "any",
  allowInstantBookings: true,
  preferredCity: "",
  receiveEmailUpdates: true,
};

// GET /account
exports.getAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let profile = await ClientProfile.findOne({ user: user._id });
    if (!profile) profile = await ClientProfile.create({ user: user._id });

    const yearsOn =
      new Date().getFullYear() - (user.createdAt?.getFullYear() || 2024);

    res.json({
      profile: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        role: user.role,
        avatar: profile.avatarUrl,
        location: profile.location,
        bio: profile.bio,
        yearsOn,
        emailVerified: user.emailVerified,
        identityStatus: profile.identityStatus,
        verified: profile.identityStatus === "verified",
      },
      reviews: [],
      trips: [],
      preferences: profile.preferences || DEFAULT_PREFS,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PUT /account/profile
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.uid);
    let profile = await ClientProfile.findOne({ user: user._id });

    const { name, location, bio } = req.body;

    if (name) user.fullName = name.trim();
    if (location) profile.location = location.trim();
    if (bio) profile.bio = bio.trim();

    // Avatar upload
    if (req.file) {
      if (profile.avatarPublicId) {
        await cloudinary.uploader.destroy(profile.avatarPublicId);
      }

      profile.avatarUrl = req.file.path;
      profile.avatarPublicId = req.file.filename;
    }

    await user.save();
    await profile.save();

    res.json({ message: "Profile updated", profile });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PUT /account/preferences
exports.updatePreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.uid);
    let profile = await ClientProfile.findOne({ user: user._id });

    profile.preferences = { ...profile.preferences, ...req.body };
    await profile.save();

    res.json({ message: "Preferences updated", preferences: profile.preferences });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /account/identity-docs
exports.uploadIdentityDocs = async (req, res) => {
  try {
    const user = await User.findById(req.user.uid);
    let profile = await ClientProfile.findOne({ user: user._id });

    const files = req.files || {};
    const docs = [];

    ["front", "back"].forEach((type) => {
      if (files[type] && files[type][0]) {
        docs.push({
          type,
          url: files[type][0].path,
          publicId: files[type][0].filename,
        });
      }
    });

    docs.forEach((doc) => profile.identityDocuments.push(doc));

    profile.identityStatus = "pending";
    await profile.save();

    res.json({
      message: "Identity documents uploaded",
      documents: profile.identityDocuments,
      identityStatus: "pending",
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

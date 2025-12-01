const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "flexidesk/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const uploadAvatar = multer({ storage: avatarStorage });

module.exports = uploadAvatar;
module.exports.uploadAvatar = uploadAvatar;

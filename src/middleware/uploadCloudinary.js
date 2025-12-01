const multer = require("multer");
const cloudinary = require("../utils/cloudinary");
const multerStorageCloudinary = require("multer-storage-cloudinary");

const CloudinaryStorage =
  multerStorageCloudinary.CloudinaryStorage ||
  multerStorageCloudinary.default ||
  multerStorageCloudinary;

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "flexidesk/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 512, height: 512, crop: "limit" }],
  },
});

const identityStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "flexidesk/identity",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
});

exports.uploadAvatar = multer({ storage: avatarStorage });
exports.uploadIdentity = multer({ storage: identityStorage });

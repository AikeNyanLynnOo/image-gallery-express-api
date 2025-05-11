const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar
} = require("../controllers/profileController");
const ApiResponse = require("../utils/apiResponse");

// Configure multer for avatar upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Supported formats: JPEG, PNG, GIF, WebP")
      );
    }
  },
});

// Custom error handler for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(
        ApiResponse.error("File size too large", {
          file: "Avatar size must be less than 2MB",
        })
      );
    }
    return res.status(400).json(
      ApiResponse.error("Upload error", {
        file: error.message,
      })
    );
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json(
      ApiResponse.error("Unsupported file type", {
        file: "Please upload a supported image format (JPEG, PNG, GIF, WebP)",
      })
    );
  }

  next(error);
};

// All routes require authentication
router.use(authenticateToken);

// Profile routes
router.get("/", getProfile);
router.patch("/", updateProfile);
router.post(
  "/avatar",
  upload.single("avatar"),
  handleMulterError,
  uploadAvatar
);
router.delete("/avatar", deleteAvatar);

module.exports = router;

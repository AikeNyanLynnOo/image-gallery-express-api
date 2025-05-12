const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const ApiResponse = require("../utils/apiResponse");
const {
  uploadImage,
  getUserImages,
  getPublicImages,
  deleteImage,
  toggleFavorite,
  getFavoriteImages,
  checkFavoriteStatus,
  updateImage,
  togglePublishStatus
} = require("../controllers/imageController");
const UserFavorite = require('../models/UserFavorite');

// Custom error handler for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(
        ApiResponse.error("File size too large", {
          file: "Image size must be less than 5MB. Please upload a smaller image.",
        })
      );
    }
    return res.status(400).json(
      ApiResponse.error("Upload error", {
        file: error.message,
      })
    );
  }

  // Handle unsupported file type error
  if (error.message.includes("Invalid file type")) {
    return res.status(400).json(
      ApiResponse.error("Unsupported file type", {
        file: "Please upload a supported image format (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, ICO, HEIC, HEIF, AVIF, JPEG 2000, JPEG XL)",
      })
    );
  }

  next(error);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
      "image/x-icon",
      "image/heic",
      "image/heif",
      "image/avif",
      "image/jp2",
      "image/jpx",
      "image/jpm",
      "image/jxl",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Supported formats: ${allowedTypes.join(", ")}`
        )
      );
    }
  },
});

// Public route (no authentication required)
router.get("/public", getPublicImages);

// Protected routes
router.use(authenticateToken);
router.post("/upload", upload.single("image"), handleMulterError, uploadImage);
router.get("/", getUserImages);
router.patch("/:imageId", updateImage);
router.delete("/:imageId", deleteImage);
router.patch("/:imageId/publish", togglePublishStatus);

// Favorite routes
router.post('/:imageId/favorite', toggleFavorite);
router.get('/favorites', getFavoriteImages);
router.get('/:imageId/favorite', checkFavoriteStatus);

module.exports = router;

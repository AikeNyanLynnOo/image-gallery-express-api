const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const {
  uploadImage,
  getUserImages,
  deleteImage,
  toggleFavorite
} = require('../controllers/imageController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

router.use(authenticateToken);

router.post('/upload', upload.single('image'), uploadImage);
router.get('/my-images', getUserImages);
router.delete('/:imageId', deleteImage);
router.patch('/:imageId/favorite', toggleFavorite);

module.exports = router; 
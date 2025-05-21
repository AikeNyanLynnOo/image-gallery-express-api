const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const {
  createCollection,
  getUserCollections,
  addImageToCollection,
  removeImageFromCollection,
  deleteCollection
} = require('../controllers/collectionController');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticateToken);

// Collection routes
router.post('/', upload.single('coverImage'), createCollection);
router.get('/', getUserCollections);
router.post('/add-image', addImageToCollection);
router.post('/remove-image', removeImageFromCollection);
router.delete('/:collectionId', deleteCollection);

module.exports = router; 
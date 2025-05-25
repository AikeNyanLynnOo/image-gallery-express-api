const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const {
  createCollection,
  getUserCollections,
  getPublicCollections,
  addImageToCollection,
  removeImageFromCollection,
  deleteCollection,
  updateCollection,
  toggleCollectionVisibility
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

// Public routes
router.get('/public', getPublicCollections);

// Protected routes
router.use(authenticateToken);

// Collection routes
router.post('/', upload.single('coverImage'), createCollection);
router.get('/', getUserCollections);
router.post('/add-image', addImageToCollection);
router.post('/remove-image', removeImageFromCollection);
router.put('/:collectionId', upload.single('coverImage'), updateCollection);
router.delete('/:collectionId', deleteCollection);
router.patch('/:collectionId/visibility', toggleCollectionVisibility);

module.exports = router; 
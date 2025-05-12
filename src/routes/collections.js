const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createCollection,
  getUserCollections,
  addImageToCollection,
  removeImageFromCollection,
  deleteCollection
} = require('../controllers/collectionController');

// All routes require authentication
router.use(authenticateToken);

// Collection routes
router.post('/', createCollection);
router.get('/', getUserCollections);
router.post('/add-image', addImageToCollection);
router.post('/remove-image', removeImageFromCollection);
router.delete('/:collectionId', deleteCollection);

module.exports = router; 
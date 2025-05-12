const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createTopic,
  getAllTopics,
  getTopicById,
  addImageToTopic,
  removeImageFromTopic,
  updateTopic,
  deleteTopic
} = require('../controllers/topicController');

// Public routes
router.get('/', getAllTopics);
router.get('/:topicId', getTopicById);

// Protected routes
router.use(authenticateToken);
router.post('/', createTopic);
router.post('/add-image', addImageToTopic);
router.post('/remove-image', removeImageFromTopic);
router.patch('/:topicId', updateTopic);
router.delete('/:topicId', deleteTopic);

module.exports = router; 
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cloudinaryId: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false  // Images are private by default
  },
  collections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection'
  }],
  topics: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Image', imageSchema); 
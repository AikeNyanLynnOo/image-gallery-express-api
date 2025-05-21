const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    maxLength: 100 
  },
  description: { 
    type: String, 
    trim: true, 
    maxLength: 500,
    default: null
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  coverImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image',
    default: null
  },
  images: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Image' 
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt timestamp before saving
collectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Collection', collectionSchema); 
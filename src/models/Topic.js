const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    unique: true, 
    maxLength: 100 
  },
  description: { 
    type: String, 
    trim: true, 
    maxLength: 500,
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
topicSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Topic', topicSchema); 
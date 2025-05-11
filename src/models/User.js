const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxLength: 50,
      default: null
    },
    lastName: {
      type: String,
      trim: true,
      maxLength: 50,
      default: null
    },
    displayName: {
      type: String,
      trim: true,
      maxLength: 50,
      default: null
    },
    bio: {
      type: String,
      maxLength: 500,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    location: {
      type: String,
      maxLength: 100,
      default: null
    },
    website: {
      type: String,
      maxLength: 200,
      default: null
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Update the updatedAt timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 
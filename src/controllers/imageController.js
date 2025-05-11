const cloudinary = require('../config/cloudinary');
const Image = require('../models/Image');
const sharp = require('sharp');
const ApiResponse = require('../utils/apiResponse');

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(
        ApiResponse.error('No file uploaded', {
          file: 'Please upload an image file'
        })
      );
    }

    const file = req.file;
    const userId = req.user.userId;

    // Check file size
    if (file.size > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json(
        ApiResponse.error('File size too large', {
          file: 'Image size must be less than 5MB. Please upload a smaller image.'
        })
      );
    }
    
    // Compress image if it's too large
    let buffer = file.buffer;
    if (file.size > 1024 * 1024) { // If larger than 1MB
      buffer = await sharp(file.buffer)
        .toFormat('jpeg', { quality: 80 })
        .toBuffer();
    }

    // Upload to Cloudinary with proper format settings
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `users/${userId}`,
          resource_type: 'image',
          format: 'jpg', // Default to jpg for better compression
          quality: 'auto:good', // Automatic quality optimization
          fetch_format: 'auto' // Let Cloudinary choose the best format for delivery
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // Save image metadata to MongoDB
    const image = new Image({
      userId,
      cloudinaryId: result.public_id,
      url: result.secure_url,
      format: result.format,
      originalFormat: file.mimetype,
      size: result.bytes
    });
    await image.save();

    res.status(201).json(
      ApiResponse.success(
        { image },
        'Image uploaded successfully'
      )
    );
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json(
      ApiResponse.error('Failed to upload image', {
        general: error.message
      })
    );
  }
};

const getUserImages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const images = await Image.find({ userId }).sort({ uploadedAt: -1 });
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(image.cloudinaryId);

    // Delete from MongoDB
    await image.deleteOne();

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    image.isFavorite = !image.isFavorite;
    await image.save();

    res.json({ 
      message: 'Favorite status updated',
      image
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadImage,
  getUserImages,
  deleteImage,
  toggleFavorite
}; 
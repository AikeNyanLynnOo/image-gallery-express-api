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

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `users/${userId}`,
          resource_type: 'image',
          format: 'jpg',
          quality: 'auto:good',
          fetch_format: 'auto'
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
    const images = await Image.find({ userId })
      .sort({ uploadedAt: -1 })
      .select('-__v'); // Exclude version key

    res.json(
      ApiResponse.success(
        { images },
        'Images retrieved successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to retrieve images', {
        general: error.message
      })
    );
  }
};

const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    // Find and verify ownership
    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error('Image not found', {
          image: 'Image not found or you do not have permission to delete it'
        })
      );
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(image.cloudinaryId);
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      // Continue with local deletion even if Cloudinary fails
    }

    // Delete from MongoDB
    await image.deleteOne();

    res.json(
      ApiResponse.success(
        null,
        'Image deleted successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to delete image', {
        general: error.message
      })
    );
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    // Find and verify ownership
    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error('Image not found', {
          image: 'Image not found or you do not have permission to modify it'
        })
      );
    }

    // Toggle favorite status
    image.isFavorite = !image.isFavorite;
    await image.save();

    res.json(
      ApiResponse.success(
        { image },
        `Image ${image.isFavorite ? 'added to' : 'removed from'} favorites`
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to update favorite status', {
        general: error.message
      })
    );
  }
};

module.exports = {
  uploadImage,
  getUserImages,
  deleteImage,
  toggleFavorite
}; 
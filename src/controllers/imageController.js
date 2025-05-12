const cloudinary = require('../config/cloudinary');
const Image = require('../models/Image');
const Topic = require('../models/Topic');
const ApiResponse = require('../utils/apiResponse');
const UserFavorite = require('../models/UserFavorite');

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
    // if (file.size > 1024 * 1024) { // If larger than 1MB
    //   buffer = await sharp(file.buffer)
    //     .toFormat('jpeg', { quality: 80 })
    //     .toBuffer();
    // }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `users/${userId}`,
          resource_type: 'image',
          // format: 'jpg',  // Commented out to preserve original format
          // quality: 'auto:good',  // Commented out to preserve original quality
          // fetch_format: 'auto'  // Commented out to prevent format conversion
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
    const { published } = req.query; // Optional query parameter

    let query = { userId };
    
    // If published status is specified, filter by it
    if (published !== undefined) {
      query.isPublished = published === 'true';
    }

    const images = await Image.find(query)
      .populate('topics')
      .populate('collections')
      .sort({ uploadedAt: -1 })
      .select('-__v');

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

// Update image (including topics)
const updateImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { topics } = req.body; // Expecting array of topic IDs
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

    // If topics are provided, update them
    if (topics) {
      // Validate that all topics exist
      const existingTopics = await Topic.find({ _id: { $in: topics } });
      if (existingTopics.length !== topics.length) {
        return res.status(400).json(
          ApiResponse.error('Invalid topics', {
            topics: 'One or more topics do not exist'
          })
        );
      }

      // Get current topics for comparison
      const currentTopics = image.topics.map(t => t.toString());
      const newTopics = topics.map(t => t.toString());

      // Find topics to add and remove
      const topicsToAdd = newTopics.filter(t => !currentTopics.includes(t));
      const topicsToRemove = currentTopics.filter(t => !newTopics.includes(t));

      // Update image's topics
      image.topics = topics;
      await image.save();

      // Update topics' images arrays
      if (topicsToAdd.length > 0) {
        await Topic.updateMany(
          { _id: { $in: topicsToAdd } },
          { $addToSet: { images: imageId } }
        );
      }

      if (topicsToRemove.length > 0) {
        await Topic.updateMany(
          { _id: { $in: topicsToRemove } },
          { $pull: { images: imageId } }
        );
      }
    }

    // Populate topics in response
    const updatedImage = await Image.findById(imageId)
      .populate('topics')
      .populate('collections');

    res.json(
      ApiResponse.success(
        { image: updatedImage },
        'Image updated successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to update image', {
        general: error.message
      })
    );
  }
};

// Toggle image publish status
const togglePublishStatus = async (req, res) => {
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

    // Toggle publish status
    image.isPublished = !image.isPublished;
    await image.save();

    res.json(
      ApiResponse.success(
        { 
          image,
          message: `Image ${image.isPublished ? 'published' : 'unpublished'} successfully`
        },
        `Image ${image.isPublished ? 'published' : 'unpublished'} successfully`
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to update publish status', {
        general: error.message
      })
    );
  }
};

// Get public images (new function)
const getPublicImages = async (req, res) => {
  try {
    const images = await Image.find({ isPublished: true })
      .populate('topics')
      .populate('collections')
      .sort({ uploadedAt: -1 })
      .select('-__v');

    res.json(
      ApiResponse.success(
        { images },
        'Public images retrieved successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to retrieve public images', {
        general: error.message
      })
    );
  }
};

// Toggle favorite status (add/remove)
const toggleFavorite = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    // Check if image exists
    const image = await Image.findOne({ _id: imageId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error('Image not found', {
          image: 'Image not found'
        })
      );
    }

    // Check if user has permission to favorite the image
    // Allow if: 1) Image is public OR 2) User is the owner
    if (!image.isPublished && image.userId.toString() !== userId) {
      return res.status(403).json(
        ApiResponse.error('Permission denied', {
          image: 'You can only favorite public images or your own images'
        })
      );
    }

    // Check if already in favorites
    const existingFavorite = await UserFavorite.findOne({ userId, imageId });
    
    if (existingFavorite) {
      // Remove from favorites
      await UserFavorite.findOneAndDelete({ userId, imageId });
      return res.json(
        ApiResponse.success(
          { 
            isFavorite: false,
            message: 'Image removed from favorites successfully'
          },
          'Image removed from favorites successfully'
        )
      );
    } else {
      // Add to favorites
      const favorite = new UserFavorite({ userId, imageId });
      await favorite.save();
      return res.json(
        ApiResponse.success(
          { 
            isFavorite: true,
            favorite,
            message: 'Image added to favorites successfully'
          },
          'Image added to favorites successfully'
        )
      );
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json(
        ApiResponse.error('Image already in favorites', {
          image: 'This image is already in your favorites'
        })
      );
    }
    res.status(500).json(
      ApiResponse.error('Failed to toggle favorite status', {
        general: error.message
      })
    );
  }
};

// Get user's favorite images
const getFavoriteImages = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all favorites for the user and populate the image details
    const favorites = await UserFavorite.find({ userId })
      .populate({
        path: 'imageId',
        populate: [
          { path: 'topics' },
          { path: 'collections' }
        ],
        // Only select necessary fields
        select: 'url cloudinaryId isPublished topics collections uploadedAt'
      })
      .sort({ createdAt: -1 }); // Sort by when the image was favorited

    // Extract images from favorites and filter out any null values
    // (in case an image was deleted but the favorite entry remains)
    const images = favorites
      .map(fav => fav.imageId)
      .filter(image => image !== null);

    res.json(
      ApiResponse.success(
        { 
          images,
          total: images.length
        },
        'Favorite images retrieved successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to retrieve favorite images', {
        general: error.message
      })
    );
  }
};

// Check if image is in user's favorites
const checkFavoriteStatus = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    // Check if image exists
    const image = await Image.findOne({ _id: imageId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error('Image not found', {
          image: 'Image not found'
        })
      );
    }

    // Check if user has permission to view the image
    // Allow if: 1) Image is public OR 2) User is the owner
    if (!image.isPublished && image.userId.toString() !== userId) {
      return res.status(403).json(
        ApiResponse.error('Permission denied', {
          image: 'You can only check favorite status for public images or your own images'
        })
      );
    }

    // Check if image is in user's favorites
    const favorite = await UserFavorite.findOne({ userId, imageId });
    
    res.json(
      ApiResponse.success(
        { 
          isFavorite: !!favorite,
          imageId,
          userId
        },
        'Favorite status checked successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to check favorite status', {
        general: error.message
      })
    );
  }
};

// Update the exports
module.exports = {
  uploadImage,
  getUserImages,
  getPublicImages,
  deleteImage,
  toggleFavorite,        // Replace addToFavorites and removeFromFavorites with toggleFavorite
  getFavoriteImages,
  checkFavoriteStatus,
  updateImage,
  togglePublishStatus,
}; 
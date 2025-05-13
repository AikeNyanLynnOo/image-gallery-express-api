const cloudinary = require("../config/cloudinary");
const Image = require("../models/Image");
const Topic = require("../models/Topic");
const ApiResponse = require("../utils/apiResponse");
const UserFavorite = require("../models/UserFavorite");

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(
        ApiResponse.error('No file uploaded', {
          file: 'Please upload an image file'
        })
      );
    }

    const { title } = req.body;
    
    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json(
        ApiResponse.error('Invalid title', {
          title: 'Title is required and must be a non-empty string'
        })
      );
    }

    // Check title length
    if (title.length > 200) {
      return res.status(400).json(
        ApiResponse.error('Title too long', {
          title: 'Title must be less than 200 characters'
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

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `users/${userId}`,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    // Save image metadata to MongoDB
    const image = new Image({
      userId,
      title: title.trim(),
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
      query.isPublished = published === "true";
    }

    const images = await Image.find(query)
      .populate("topics")
      .populate("collections")
      .sort({ uploadedAt: -1 })
      .select("-__v");

    res.json(ApiResponse.success({ images }, "Images retrieved successfully"));
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve images", {
        general: error.message,
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
        ApiResponse.error("Image not found", {
          image: "Image not found or you do not have permission to delete it",
        })
      );
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(image.cloudinaryId);
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
      // Continue with local deletion even if Cloudinary fails
    }

    // Delete from MongoDB
    await image.deleteOne();

    res.json(ApiResponse.success(null, "Image deleted successfully"));
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to delete image", {
        general: error.message,
      })
    );
  }
};

// Update image (including topics and title)
const updateImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { topics, title } = req.body;
    const userId = req.user.userId;

    // Find and verify ownership
    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error("Image not found", {
          image: "Image not found or you do not have permission to modify it",
        })
      );
    }

    // If title is provided, validate and update it
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json(
          ApiResponse.error("Invalid title", {
            title: "Title must be a non-empty string",
          })
        );
      }

      if (title.length > 200) {
        return res.status(400).json(
          ApiResponse.error("Title too long", {
            title: "Title must be less than 200 characters",
          })
        );
      }

      image.title = title.trim();
    }

    // If topics are provided, update them
    if (topics) {
      // Validate that all topics exist
      const existingTopics = await Topic.find({ _id: { $in: topics } });
      if (existingTopics.length !== topics.length) {
        return res.status(400).json(
          ApiResponse.error("Invalid topics", {
            topics: "One or more topics do not exist",
          })
        );
      }

      // Get current topics for comparison
      const currentTopics = image.topics.map((t) => t.toString());
      const newTopics = topics.map((t) => t.toString());

      // Find topics to add and remove
      const topicsToAdd = newTopics.filter((t) => !currentTopics.includes(t));
      const topicsToRemove = currentTopics.filter(
        (t) => !newTopics.includes(t)
      );

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
    } else {
      await image.save();
    }

    // Populate topics in response
    const updatedImage = await Image.findById(imageId)
      .populate("topics")
      .populate("collections");

    res.json(
      ApiResponse.success({ image: updatedImage }, "Image updated successfully")
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to update image", {
        general: error.message,
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
        ApiResponse.error("Image not found", {
          image: "Image not found or you do not have permission to modify it",
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
          message: `Image ${
            image.isPublished ? "published" : "unpublished"
          } successfully`,
        },
        `Image ${image.isPublished ? "published" : "unpublished"} successfully`
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to update publish status", {
        general: error.message,
      })
    );
  }
};

// Get public images with filtering and pagination
const getPublicImages = async (req, res) => {
  try {
    const {
      collection,
      topic,
      keyword,
      dateRange,
      sortBy,
      page = 1,    // Default to first page
      limit = 10   // Default to 10 items per page
    } = req.query;

    // Convert page and limit to numbers and validate
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(50, Math.max(1, parseInt(limit))); // Limit between 1 and 50

    // Build the base query for published images
    const query = { isPublished: true };

    // Add collection filter if provided
    if (collection) {
      query.collections = collection;
    }

    // Add topic filter if provided
    if (topic) {
      query.topics = topic;
    }

    // Add keyword search if provided (case-insensitive partial match on slug)
    if (keyword) {
      query.slug = { $regex: keyword, $options: 'i' };
    }

    // Add date range filter if provided
    if (dateRange) {
      const now = new Date();
      let startDate;

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case '3days':
          startDate = new Date(now.setDate(now.getDate() - 3));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          // If invalid dateRange, ignore it
          break;
      }

      if (startDate) {
        query.uploadedAt = { $gte: startDate };
      }
    }

    // Build sort options
    let sortOptions = { uploadedAt: -1 }; // Default sort by upload date

    if (sortBy) {
      switch (sortBy) {
        case 'views':
          sortOptions = { views: -1 };
          break;
        case 'likes':
          sortOptions = { likes: -1 };
          break;
        case 'downloads':
          sortOptions = { downloads: -1 };
          break;
        // If invalid sortBy, keep default sort
      }
    }

    // Calculate skip value for pagination
    const skip = (pageNumber - 1) * limitNumber;

    // Execute query with filters, sorting, and pagination
    const [images, total] = await Promise.all([
      Image.find(query)
        .populate('topics')
        .populate('collections')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .select('-__v'),
      Image.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    res.json(
      ApiResponse.success(
        { 
          images,
          pagination: {
            total,
            totalPages,
            currentPage: pageNumber,
            limit: limitNumber,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? pageNumber + 1 : null,
            prevPage: hasPrevPage ? pageNumber - 1 : null
          },
          filters: {
            collection: collection || null,
            topic: topic || null,
            keyword: keyword || null,
            dateRange: dateRange || null,
            sortBy: sortBy || 'uploadedAt'
          }
        },
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

    // Find the image and verify it exists
    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json(ApiResponse.error("Image not found"));
    }

    // Check if the image is already favorited by the user
    const existingFavorite = await UserFavorite.findOne({
      userId,
      imageId,
    });

    if (existingFavorite) {
      // Remove from favorites
      await UserFavorite.deleteOne({ _id: existingFavorite._id });

      // Decrement likes count
      image.likes = Math.max(0, image.likes - 1); // Ensure likes don't go below 0
      await image.save();

      res.json(
        ApiResponse.success(
          { isFavorited: false },
          "Image removed from favorites"
        )
      );
    } else {
      // Add to favorites
      const newFavorite = new UserFavorite({
        userId,
        imageId,
      });
      await newFavorite.save();

      // Increment likes count
      image.likes += 1;
      await image.save();

      res.json(
        ApiResponse.success({ isFavorited: true }, "Image added to favorites")
      );
    }
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to toggle favorite status", {
        general: error.message,
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
        path: "imageId",
        populate: [{ path: "topics" }, { path: "collections" }],
        // Only select necessary fields
        select: "url cloudinaryId isPublished topics collections uploadedAt",
      })
      .sort({ createdAt: -1 }); // Sort by when the image was favorited

    // Extract images from favorites and filter out any null values
    // (in case an image was deleted but the favorite entry remains)
    const images = favorites
      .map((fav) => fav.imageId)
      .filter((image) => image !== null);

    res.json(
      ApiResponse.success(
        {
          images,
          total: images.length,
        },
        "Favorite images retrieved successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve favorite images", {
        general: error.message,
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
        ApiResponse.error("Image not found", {
          image: "Image not found",
        })
      );
    }

    // Check if user has permission to view the image
    // Allow if: 1) Image is public OR 2) User is the owner
    if (!image.isPublished && image.userId.toString() !== userId) {
      return res.status(403).json(
        ApiResponse.error("Permission denied", {
          image:
            "You can only check favorite status for public images or your own images",
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
          userId,
        },
        "Favorite status checked successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to check favorite status", {
        general: error.message,
      })
    );
  }
};

// Get random image (optionally filtered by topic)
const getRandomImage = async (req, res) => {
  try {
    const { topicId } = req.params;

    // Build query for published images
    const query = { isPublished: true };

    // If topicId is provided, add it to the query
    if (topicId) {
      // Verify topic exists
      const topic = await Topic.findById(topicId);
      if (!topic) {
        return res.status(404).json(ApiResponse.error("Topic not found"));
      }
      query.topics = topicId;
    }

    // Get all matching images
    const images = await Image.find(query)
      .populate("topics")
      .populate("collections");

    if (!images.length) {
      return res
        .status(404)
        .json(
          ApiResponse.error(
            topicId
              ? "No images found for this topic"
              : "No published images found"
          )
        );
    }

    // Get a random image from the array
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.json(
      ApiResponse.success(
        { image: randomImage },
        "Random image retrieved successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve random image", {
        general: error.message,
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
  toggleFavorite,
  getFavoriteImages,
  checkFavoriteStatus,
  updateImage,
  togglePublishStatus,
  getRandomImage,
};

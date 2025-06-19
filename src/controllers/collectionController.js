const Collection = require("../models/Collection");
const Image = require("../models/Image");
const ApiResponse = require("../utils/apiResponse");
const cloudinary = require("../config/cloudinary");

// Create a collection
const createCollection = async (req, res) => {
  try {
    const { name, description, coverImageId, isPublic } = req.body;
    const userId = req.user.userId;

    // Check if collection with same name already exists for this user
    const existingCollection = await Collection.findOne({
      userId,
      name: { $regex: new RegExp(`^${name}$`, "i") }, // Case-insensitive match
    });

    if (existingCollection) {
      return res.status(400).json(
        ApiResponse.error("Collection already exists", {
          name: "You already have a collection with this name",
        })
      );
    }

    let coverImage = null;

    // Handle cover image - either from existing image or new upload
    if (req.file) {
      // New image upload
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `users/${userId}/covers`,
              resource_type: "image",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(req.file.buffer);
      });

      // Create new image document for the cover
      coverImage = new Image({
        userId,
        title: `${name} Cover Image`,
        cloudinaryId: result.public_id,
        url: result.secure_url,
        isPublished: false, // Cover images are private by default
      });
      await coverImage.save();
    } else if (coverImageId) {
      // Use existing image
      coverImage = await Image.findOne({ _id: coverImageId, userId });
      if (!coverImage) {
        return res.status(400).json(
          ApiResponse.error("Invalid cover image", {
            coverImageId:
              "Cover image not found or you do not have permission to use it",
          })
        );
      }
    }

    const collection = new Collection({
      name,
      description,
      userId,
      isPublic: isPublic || false, // Default to false if not provided
      coverImage: coverImage ? coverImage._id : null,
    });

    await collection.save();

    // Populate the cover image in the response
    const populatedCollection = await Collection.findById(
      collection._id
    ).populate("coverImage");

    res
      .status(201)
      .json(
        ApiResponse.success(
          { collection: populatedCollection },
          "Collection created successfully"
        )
      );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to create collection", {
        general: error.message,
      })
    );
  }
};

// Get user's collections
const getUserCollections = async (req, res) => {
  try {
    const userId = req.user.userId;
    const collections = await Collection.find({ userId })
      .populate({
        path: "coverImage",
        match: { userId } // Only show user's own cover images
      })
      .populate({
        path: "images",
        match: { userId } // Only show user's own images
      })
      .sort({ updatedAt: -1 });

    // Transform collections to include total published images count
    const transformedCollections = collections.map(collection => {
      const collectionObj = collection.toObject();
      collectionObj.totalImages = collection.images.length;
      collectionObj.publishedImages = collection.images.filter(img => img.isPublished).length;
      return collectionObj;
    });

    res.json(
      ApiResponse.success({ collections: transformedCollections }, "Collections retrieved successfully")
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve collections", {
        general: error.message,
      })
    );
  }
};

// Get public collections
const getPublicCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ isPublic: true })
      .populate({
        path: "coverImage",
        match: { isPublished: true }
      })
      .populate({
        path: "images",
        match: { isPublished: true },
        select: "url cloudinaryId title isPublished" // Only select necessary fields
      })
      .populate("userId", "username avatar")
      .sort({ updatedAt: -1 });

    // Filter out collections with no published images
    const filteredCollections = collections
      .filter(collection => collection.images.length > 0)
      .map(collection => {
        const collectionObj = collection.toObject();
        collectionObj.totalImages = collection.images.length;
        return collectionObj;
      });

    res.json(
      ApiResponse.success({ collections: filteredCollections }, "Public collections retrieved successfully")
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve public collections", {
        general: error.message
      })
    );
  }
};

// Add image to collection
const addImageToCollection = async (req, res) => {
  try {
    const { collectionId, imageId } = req.body;
    const userId = req.user.userId;

    // Verify collection ownership
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json(
        ApiResponse.error("Collection not found", {
          collection:
            "Collection not found or you do not have permission to modify it",
        })
      );
    }

    // Verify image ownership
    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error("Image not found", {
          image: "Image not found or you do not have permission to add it",
        })
      );
    }

    // Check if image is already in collection
    if (collection.images.includes(imageId)) {
      return res.status(400).json(
        ApiResponse.error("Image already in collection", {
          image: "This image is already in the collection",
        })
      );
    }

    // Add image to collection
    collection.images.push(imageId);
    await collection.save();

    // Add collection to image
    image.collections.push(collectionId);
    await image.save();

    res.json(
      ApiResponse.success(
        { collection },
        "Image added to collection successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to add image to collection", {
        general: error.message,
      })
    );
  }
};

// Remove image from collection
const removeImageFromCollection = async (req, res) => {
  try {
    const { collectionId, imageId } = req.body;
    const userId = req.user.userId;

    // Verify collection ownership
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json(
        ApiResponse.error("Collection not found", {
          collection:
            "Collection not found or you do not have permission to modify it",
        })
      );
    }

    // Check if image is in collection
    if (!collection.images.includes(imageId)) {
      return res.status(400).json(
        ApiResponse.error("Image not in collection", {
          image: "This image is not in the collection",
        })
      );
    }

    // Remove image from collection
    collection.images = collection.images.filter(
      (id) => id.toString() !== imageId
    );
    await collection.save();

    // Remove collection from image
    const image = await Image.findOne({ _id: imageId, userId });
    if (image) {
      image.collections = image.collections.filter(
        (id) => id.toString() !== collectionId
      );
      await image.save();
    }

    res.json(
      ApiResponse.success(
        { collection },
        "Image removed from collection successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to remove image from collection", {
        general: error.message,
      })
    );
  }
};

// Delete collection
const deleteCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const userId = req.user.userId;

    // Verify collection ownership
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json(
        ApiResponse.error("Collection not found", {
          collection:
            "Collection not found or you do not have permission to delete it",
        })
      );
    }

    // Store collection data before deletion
    const deletedCollection = {
      _id: collection._id,
      name: collection.name,
      description: collection.description,
      userId: collection.userId,
      images: collection.images,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };

    // Remove collection reference from all images
    await Image.updateMany(
      { collections: collectionId },
      { $pull: { collections: collectionId } }
    );

    // Delete collection
    await collection.deleteOne();

    res.json(
      ApiResponse.success(
        { deletedCollection },
        "Collection deleted successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to delete collection", {
        general: error.message,
      })
    );
  }
};

// Update collection
const updateCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { name, description, coverImageId, isPublic } = req.body;
    const userId = req.user.userId;

    // Verify collection ownership
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json(
        ApiResponse.error("Collection not found", {
          collection:
            "Collection not found or you do not have permission to modify it",
        })
      );
    }

    // Check if new name already exists for this user
    if (name) {
      const existingCollection = await Collection.findOne({
        userId,
        name: { $regex: new RegExp(`^${name}$`, "i") }, // Case-insensitive match
        _id: { $ne: collectionId },
      });
      if (existingCollection) {
        return res.status(400).json(
          ApiResponse.error("Collection name already exists", {
            name: "You already have a collection with this name",
          })
        );
      }
    }

    let coverImage = null;

    // Handle cover image - either from existing image or new upload
    if (req.file) {
      // New image upload
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `users/${userId}/covers`,
              resource_type: "image",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(req.file.buffer);
      });

      // Create new image document for the cover
      coverImage = new Image({
        userId,
        title: `${name || collection.name} Cover Image`,
        cloudinaryId: result.public_id,
        url: result.secure_url,
        isPublished: false, // Cover images are private by default
      });
      await coverImage.save();
    } else if (coverImageId) {
      // Use existing image
      coverImage = await Image.findOne({ _id: coverImageId, userId });
      if (!coverImage) {
        return res.status(400).json(
          ApiResponse.error("Invalid cover image", {
            coverImageId:
              "Cover image not found or you do not have permission to use it",
          })
        );
      }
    }

    // Update collection fields
    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (coverImage) collection.coverImage = coverImage._id;
    if (isPublic !== undefined) collection.isPublic = isPublic;

    await collection.save();

    // Populate the cover image in the response
    const updatedCollection = await Collection.findById(
      collection._id
    ).populate("coverImage");

    res.json(
      ApiResponse.success(
        { collection: updatedCollection },
        "Collection updated successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to update collection", {
        general: error.message,
      })
    );
  }
};

// Toggle collection visibility (publish/unpublish)
const toggleCollectionVisibility = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const userId = req.user.userId;

    // Verify collection ownership
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json(
        ApiResponse.error("Collection not found", {
          collection: "Collection not found or you do not have permission to modify it"
        })
      );
    }

    // Toggle the isPublic status
    collection.isPublic = !collection.isPublic;
    await collection.save();

    res.json(
      ApiResponse.success(
        { 
          collection,
          message: collection.isPublic 
            ? "Collection published successfully" 
            : "Collection unpublished successfully"
        },
        collection.isPublic 
          ? "Collection is now public" 
          : "Collection is now private"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to toggle collection visibility", {
        general: error.message
      })
    );
  }
};

// Get collection page data
const getCollectionPage = async (req, res) => {
  try {
    const {
      imageCount,
      dateCreated,
      sortBy = 'likes',
      keyword = '',
      page = 1,
      limit = 10
    } = req.query;

    // Convert page and limit to numbers and validate
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(50, Math.max(1, parseInt(limit))); // Limit between 1 and 50

    // Build the base query for public collections with published images
    const baseQuery = { isPublic: true };

    // Add image count filter if provided
    if (imageCount) {
      const imageCountQuery = {
        $lookup: {
          from: "images",
          let: { collectionImages: "$images" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$_id", "$$collectionImages"] },
                    { $eq: ["$isPublished", true] }
                  ]
                }
              }
            }
          ],
          as: "publishedImages"
        }
      };

      const imageCountMatch = {
        $match: {
          $expr: {
            $let: {
              vars: {
                count: { $size: "$publishedImages" }
              },
              in: {
                $switch: {
                  branches: [
                    { case: { $eq: [imageCount, "less_than_10"] }, then: { $lt: ["$$count", 10] } },
                    { case: { $eq: [imageCount, "10_to_50"] }, then: { $and: [{ $gte: ["$$count", 10] }, { $lte: ["$$count", 50] }] } },
                    { case: { $eq: [imageCount, "50_to_100"] }, then: { $and: [{ $gt: ["$$count", 50] }, { $lte: ["$$count", 100] }] } },
                    { case: { $eq: [imageCount, "more_than_100"] }, then: { $gt: ["$$count", 100] } }
                  ],
                  default: true
                }
              }
            }
          }
        }
      };

      baseQuery.$and = [imageCountQuery, imageCountMatch];
    }

    // Add date created filter if provided
    if (dateCreated) {
      const now = new Date();
      let startDate;

      switch (dateCreated) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "3days":
          startDate = new Date(now.setDate(now.getDate() - 3));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        baseQuery.createdAt = { $gte: startDate };
      }
    }

    // Add text search if provided
    if (keyword) {
      baseQuery.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { "user.username": { $regex: keyword, $options: 'i' } }
      ];
    }

    // Build sort options based on collection metrics
    let sortOptions = {};
    switch (sortBy) {
      case 'likes':
        sortOptions = { 'metrics.totalLikes': -1 };
        break;
      case 'views':
        sortOptions = { 'metrics.totalViews': -1 };
        break;
      case 'downloads':
        sortOptions = { 'metrics.totalDownloads': -1 };
        break;
      default:
        sortOptions = { 'metrics.totalLikes': -1 }; // Default to total likes
    }

    // Calculate skip value for pagination
    const skip = (pageNumber - 1) * limitNumber;

    // Get featured collections (4 most popular collections)
    const featuredCollections = await Collection.aggregate([
      { $match: { isPublic: true } },
      {
        $lookup: {
          from: "images",
          let: { collectionImages: "$images" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$_id", "$$collectionImages"] },
                    { $eq: ["$isPublished", true] }
                  ]
                }
              }
            }
          ],
          as: "publishedImages"
        }
      },
      {
        $match: {
          $expr: { $gt: [{ $size: "$publishedImages" }, 0] }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "images",
          localField: "coverImage",
          foreignField: "_id",
          as: "coverImage"
        }
      },
      {
        $addFields: {
          metrics: {
            totalViews: { $sum: "$publishedImages.views" },
            totalLikes: { $sum: "$publishedImages.likes" },
            totalDownloads: { $sum: "$publishedImages.downloads" },
            totalEngagement: {
              $add: [
                { $multiply: [{ $sum: "$publishedImages.views" }, 0.5] },
                { $multiply: [{ $sum: "$publishedImages.likes" }, 2] },
                { $multiply: [{ $sum: "$publishedImages.downloads" }, 3] }
              ]
            }
          },
          coverImage: { $arrayElemAt: ["$coverImage", 0] },
          totalImages: { $size: "$publishedImages" }
        }
      },
      { $sort: { "metrics.totalEngagement": -1 } },
      { $limit: 4 },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          totalImages: 1,
          metrics: 1,
          coverImage: 1,
          "user._id": 1,
          "user.username": 1,
          "user.avatar": 1
        }
      }
    ]);

    // Get search results with pagination
    const [collections, total] = await Promise.all([
      Collection.aggregate([
        { $match: baseQuery },
        {
          $lookup: {
            from: "images",
            let: { collectionImages: "$images" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$_id", "$$collectionImages"] },
                      { $eq: ["$isPublished", true] }
                    ]
                  }
                }
              }
            ],
            as: "publishedImages"
          }
        },
        {
          $match: {
            $expr: { $gt: [{ $size: "$publishedImages" }, 0] }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $lookup: {
            from: "images",
            localField: "coverImage",
            foreignField: "_id",
            as: "coverImage"
          }
        },
        {
          $addFields: {
            metrics: {
              totalViews: { $sum: "$publishedImages.views" },
              totalLikes: { $sum: "$publishedImages.likes" },
              totalDownloads: { $sum: "$publishedImages.downloads" },
              totalEngagement: {
                $add: [
                  { $multiply: [{ $sum: "$publishedImages.views" }, 0.5] },
                  { $multiply: [{ $sum: "$publishedImages.likes" }, 2] },
                  { $multiply: [{ $sum: "$publishedImages.downloads" }, 3] }
                ]
              }
            },
            coverImage: { $arrayElemAt: ["$coverImage", 0] },
            totalImages: { $size: "$publishedImages" }
          }
        },
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: limitNumber },
        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            totalImages: 1,
            metrics: 1,
            coverImage: 1,
            "user._id": 1,
            "user.username": 1,
            "user.avatar": 1
          }
        }
      ]),
      Collection.countDocuments(baseQuery)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    // Define filter options for the response (similar to explore page)
    const imageCountOptions = [
      { name: "Less than 10", value: "less_than_10" },
      { name: "10 to 50", value: "10_to_50" },
      { name: "50 to 100", value: "50_to_100" },
      { name: "More than 100", value: "more_than_100" }
    ];
    const dateCreatedOptions = [
      { name: "Today", value: "today" },
      { name: "Last 3 Days", value: "3days" },
      { name: "This Week", value: "week" },
      { name: "This Month", value: "month" }
    ];
    const sortByOptions = [
      { name: "Most Likes", value: "likes" },
      { name: "Most Views", value: "views" },
      { name: "Most Downloads", value: "downloads" }
    ];

    res.json(
      ApiResponse.success(
        {
          featuredCollections,
          collections,
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
          filterOptions: {
            imageCount: imageCountOptions,
            dateCreated: dateCreatedOptions,
            sortBy: sortByOptions
          },
          filters: {
            imageCount: imageCount || null,
            dateCreated: dateCreated || null,
            sortBy,
            keyword: keyword || null
          }
        },
        "Collection page data retrieved successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve collection page data", {
        general: error.message
      })
    );
  }
};

module.exports = {
  createCollection,
  getUserCollections,
  getPublicCollections,
  addImageToCollection,
  removeImageFromCollection,
  deleteCollection,
  updateCollection,
  toggleCollectionVisibility,
  getCollectionPage
};

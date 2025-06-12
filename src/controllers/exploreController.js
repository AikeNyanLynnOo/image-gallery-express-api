const Topic = require("../models/Topic");
const Image = require("../models/Image");
const Collection = require("../models/Collection");
const ApiResponse = require("../utils/apiResponse");

// Get explore page data
const getExploreData = async (req, res) => {
  try {
    const {
      collection,
      topic,
      keyword,
      uploadedWithin,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    // Convert page and limit to numbers and validate
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(50, Math.max(1, parseInt(limit))); // Limit between 1 and 50

    // Get filter options
    const timeFilters = [
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

    // Get suggested topics
    const suggestedTopics = await Topic.aggregate([
      {
        $lookup: {
          from: 'images',
          localField: '_id',
          foreignField: 'topics',
          as: 'images'
        }
      },
      {
        $addFields: {
          totalLikes: {
            $reduce: {
              input: '$images',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.likes'] }
            }
          }
        }
      },
      {
        $sort: { totalLikes: -1, name: 1 }
      },
      {
        $limit: 10
      },
      {
        $project: { name: 1, value: '$_id' }
      }
    ]);

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
      query.slug = { $regex: keyword, $options: "i" };
    }

    // Add uploaded within filter if provided
    if (uploadedWithin) {
      const now = new Date();
      let startDate;

      switch (uploadedWithin) {
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
          // If invalid uploadedWithin, ignore it
          break;
      }

      if (startDate) {
        query.uploadedAt = { $gte: startDate };
      }
    }

    // Build sort options
    let sortOptions = { uploadedAt: -1 };

    if (sortBy) {
      switch (sortBy) {
        case "views":
          sortOptions = { views: -1 };
          break;
        case "likes":
          sortOptions = { likes: -1 };
          break;
        case "downloads":
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
        .populate({
          path: 'userId',
          select: 'email profile'
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .select('-__v'),
      Image.countDocuments(query)
    ]);

    // Get all unique user IDs from the images
    const userIds = [...new Set(images.map(img => img.userId._id))];

    // Get collections count, total images count, and total likes for all users in parallel
    const [collectionsCount, imagesCount, likesCount] = await Promise.all([
      Collection.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', totalCollections: { $sum: 1 } } }
      ]),
      Image.aggregate([
        { $match: { userId: { $in: userIds }, isPublished: true } },
        { $group: { _id: '$userId', totalImages: { $sum: 1 } } }
      ]),
      Image.aggregate([
        { $match: { userId: { $in: userIds }, isPublished: true } },
        { $group: { _id: '$userId', totalLikes: { $sum: '$likes' } } }
      ])
    ]);

    // Create maps for quick lookup
    const collectionsCountMap = collectionsCount.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.totalCollections;
      return acc;
    }, {});

    const imagesCountMap = imagesCount.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.totalImages;
      return acc;
    }, {});

    const likesCountMap = likesCount.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.totalLikes;
      return acc;
    }, {});

    // Get all topics for random selection
    const allTopics = await Topic.find().select('name');

    // Transform the response to rename userId to user and add counts
    const transformedImages = images.map(image => {
      const imageObj = image.toObject();
      const user = imageObj.userId;
      
      // Add counts to user object
      user.totalCollections = collectionsCountMap[user._id.toString()] || 0;
      user.totalImages = imagesCountMap[user._id.toString()] || 0;
      user.totalLikes = likesCountMap[user._id.toString()] || 0;
      
      // Rename userId to user
      imageObj.user = user;
      delete imageObj.userId;

      // Add 3 random tags to each image
      const shuffledTopics = [...allTopics].sort(() => 0.5 - Math.random());
      imageObj.tags = shuffledTopics.slice(0, 3).map(topic => topic.name);
      
      return imageObj;
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    // Get topic and collection names if they exist
    let topicName = null;
    let collectionName = null;

    if (topic) {
      const topicDoc = await Topic.findById(topic);
      if (topicDoc) {
        topicName = topicDoc.name;
      }
    }

    if (collection) {
      const collectionDoc = await Collection.findById(collection);
      if (collectionDoc) {
        collectionName = collectionDoc.name;
      }
    }

    res.json(
      ApiResponse.success(
        {
          filterOptions: {
            time: timeFilters,
            sortBy: sortByOptions
          },
          suggestedTopics,
          images: transformedImages,
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
            collection: collectionName,
            topic: topicName,
            keyword: keyword || null,
            uploadedWithin: uploadedWithin || null,
            sortBy: sortBy || 'uploadedAt'
          }
        },
        "Explore page data retrieved successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve explore page data", {
        general: error.message
      })
    );
  }
};

module.exports = {
  getExploreData
}; 
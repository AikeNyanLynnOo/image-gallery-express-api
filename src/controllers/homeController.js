const Topic = require("../models/Topic");
const Image = require("../models/Image");
const Collection = require("../models/Collection");
const ApiResponse = require("../utils/apiResponse");

// Get home page data
const getHomeData = async (req, res) => {
  try {
    // 1. Get 4 topics
    const topics = await Topic.aggregate([
      { $sample: { size: 4 } },
      { $project: { name: 1, description: 1 } }
    ]);

    // 2. Get 4 hero images (stunning public images)
    const heroImages = await Image.aggregate([
      { $match: { isPublished: true } },
      {
        $addFields: {
          // Calculate a quality score based on engagement and image properties
          qualityScore: {
            $add: [
              { $multiply: ["$likes", 3] },
              { $multiply: ["$views", 0.5] },
              { $multiply: ["$downloads", 2] }
            ]
          }
        }
      },
      { $sort: { qualityScore: -1 } },
      { $limit: 4 },
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
        $project: {
          _id: 1,
          title: 1,
          url: 1,
          cloudinaryId: 1,
          "user._id": 1,
          "user.username": 1,
          "user.profile.firstName": 1,
          "user.profile.lastName": 1,
          "user.profile.displayName": 1,
          "user.profile.bio": 1,
          "user.profile.avatar": 1,
          "user.profile.location": 1,
          "user.profile.website": 1
        }
      }
    ]);

    // 3. Get 9 featured images based on engagement
    const featuredImages = await Image.aggregate([
      { $match: { isPublished: true } },
      {
        $addFields: {
          // Calculate engagement score: likes*2 + views + downloads*3
          engagementScore: {
            $add: [
              { $multiply: ["$likes", 2] },
              "$views",
              { $multiply: ["$downloads", 3] }
            ]
          }
        }
      },
      { $sort: { engagementScore: -1 } },
      { $limit: 9 },
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
        $project: {
          _id: 1,
          title: 1,
          url: 1,
          cloudinaryId: 1,
          likes: 1,
          views: 1,
          downloads: 1,
          "user._id": 1,
          "user.username": 1,
          "user.profile.firstName": 1,
          "user.profile.lastName": 1,
          "user.profile.displayName": 1,
          "user.profile.bio": 1,
          "user.profile.avatar": 1,
          "user.profile.location": 1,
          "user.profile.website": 1
        }
      }
    ]);

    // 4. Get 4 popular collections
    const popularCollections = await Collection.aggregate([
      { $match: { isPublic: true } },
      {
        $lookup: {
          from: "images",
          localField: "images",
          foreignField: "_id",
          as: "collectionImages"
        }
      },
      {
        $addFields: {
          // Calculate popularity based on total likes, views, and downloads of images
          popularity: {
            $reduce: {
              input: "$collectionImages",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  { $multiply: ["$$this.likes", 2] },
                  "$$this.views",
                  { $multiply: ["$$this.downloads", 3] }
                ]
              }
            }
          }
        }
      },
      { $sort: { popularity: -1 } },
      { $limit: 4 },
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
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          "user._id": 1,
          "user.username": 1,
          "user.profile.firstName": 1,
          "user.profile.lastName": 1,
          "user.profile.displayName": 1,
          "user.profile.bio": 1,
          "user.profile.avatar": 1,
          "user.profile.location": 1,
          "user.profile.website": 1,
          coverImage: { $arrayElemAt: ["$coverImage", 0] },
          totalImages: { $size: "$images" }
        }
      }
    ]);

    res.json(
      ApiResponse.success(
        {
          topics,
          heroImages,
          featuredImages,
          popularCollections
        },
        "Home page data retrieved successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve home page data", {
        general: error.message
      })
    );
  }
};

module.exports = {
  getHomeData
}; 
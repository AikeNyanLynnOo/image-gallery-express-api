const Topic = require('../models/Topic');
const Image = require('../models/Image');
const ApiResponse = require('../utils/apiResponse');

// Create a topic (admin only)
const createTopic = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if topic already exists
    const existingTopic = await Topic.findOne({ name });
    if (existingTopic) {
      return res.status(400).json(
        ApiResponse.error('Topic already exists', {
          name: 'A topic with this name already exists'
        })
      );
    }

    const topic = new Topic({
      name,
      description
    });

    await topic.save();

    res.status(201).json(
      ApiResponse.success(
        { topic },
        'Topic created successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to create topic', {
        general: error.message
      })
    );
  }
};

// Get all topics
const getAllTopics = async (req, res) => {
  try {
    const topics = await Topic.find()
      .populate('images')
      .sort({ name: 1 });

    res.json(
      ApiResponse.success(
        { topics },
        'Topics retrieved successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to retrieve topics', {
        general: error.message
      })
    );
  }
};

// Get topic by ID
const getTopicById = async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await Topic.findById(topicId)
      .populate('images');

    if (!topic) {
      return res.status(404).json(
        ApiResponse.error('Topic not found')
      );
    }

    res.json(
      ApiResponse.success(
        { topic },
        'Topic retrieved successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to retrieve topic', {
        general: error.message
      })
    );
  }
};

// Add image to topic
const addImageToTopic = async (req, res) => {
  try {
    const { topicId, imageId } = req.body;
    const userId = req.user.userId;

    // Verify topic exists
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json(
        ApiResponse.error('Topic not found')
      );
    }

    // Verify image ownership
    const image = await Image.findOne({ _id: imageId, userId });
    if (!image) {
      return res.status(404).json(
        ApiResponse.error('Image not found', {
          image: 'Image not found or you do not have permission to add it'
        })
      );
    }

    // Check if image is already in topic
    if (topic.images.includes(imageId)) {
      return res.status(400).json(
        ApiResponse.error('Image already in topic', {
          image: 'This image is already in the topic'
        })
      );
    }

    // Add image to topic
    topic.images.push(imageId);
    await topic.save();

    // Add topic to image
    if (!image.topics.includes(topicId)) {
      image.topics.push(topicId);
      await image.save();
    }

    res.json(
      ApiResponse.success(
        { topic },
        'Image added to topic successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to add image to topic', {
        general: error.message
      })
    );
  }
};

// Remove image from topic
const removeImageFromTopic = async (req, res) => {
  try {
    const { topicId, imageId } = req.body;
    const userId = req.user.userId;

    // Verify topic exists
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json(
        ApiResponse.error('Topic not found')
      );
    }

    // Check if image is in topic
    if (!topic.images.includes(imageId)) {
      return res.status(400).json(
        ApiResponse.error('Image not in topic', {
          image: 'This image is not in the topic'
        })
      );
    }

    // Remove image from topic
    topic.images = topic.images.filter(id => id.toString() !== imageId);
    await topic.save();

    // Remove topic from image
    const image = await Image.findOne({ _id: imageId, userId });
    if (image) {
      image.topics = image.topics.filter(id => id.toString() !== topicId);
      await image.save();
    }

    res.json(
      ApiResponse.success(
        { topic },
        'Image removed from topic successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to remove image from topic', {
        general: error.message
      })
    );
  }
};

// Update topic
const updateTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { name, description } = req.body;

    // Check if new name already exists
    if (name) {
      const existingTopic = await Topic.findOne({ 
        name, 
        _id: { $ne: topicId } 
      });
      if (existingTopic) {
        return res.status(400).json(
          ApiResponse.error('Topic name already exists', {
            name: 'A topic with this name already exists'
          })
        );
      }
    }

    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json(
        ApiResponse.error('Topic not found')
      );
    }

    if (name) topic.name = name;
    if (description !== undefined) topic.description = description;

    await topic.save();

    res.json(
      ApiResponse.success(
        { topic },
        'Topic updated successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to update topic', {
        general: error.message
      })
    );
  }
};

// Delete topic
const deleteTopic = async (req, res) => {
  try {
    const { topicId } = req.params;

    // Verify topic exists
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json(
        ApiResponse.error('Topic not found')
      );
    }

    // Remove topic reference from all images
    await Image.updateMany(
      { topics: topicId },
      { $pull: { topics: topicId } }
    );

    // Delete topic
    await topic.deleteOne();

    res.json(
      ApiResponse.success(
        null,
        'Topic deleted successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to delete topic', {
        general: error.message
      })
    );
  }
};

module.exports = {
  createTopic,
  getAllTopics,
  getTopicById,
  addImageToTopic,
  removeImageFromTopic,
  updateTopic,
  deleteTopic
}; 
const Collection = require('../models/Collection');
const Image = require('../models/Image');
const ApiResponse = require('../utils/apiResponse');

// Create a collection
const createCollection = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.userId;

    const collection = new Collection({
      name,
      description,
      userId
    });

    await collection.save();

    res.status(201).json(
      ApiResponse.success(
        { collection },
        'Collection created successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to create collection', {
        general: error.message
      })
    );
  }
};

// Get user's collections
const getUserCollections = async (req, res) => {
  try {
    const userId = req.user.userId;
    const collections = await Collection.find({ userId })
      .populate('images')
      .sort({ updatedAt: -1 });

    res.json(
      ApiResponse.success(
        { collections },
        'Collections retrieved successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to retrieve collections', {
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
        ApiResponse.error('Collection not found', {
          collection: 'Collection not found or you do not have permission to modify it'
        })
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

    // Add image to collection if not already present
    if (!collection.images.includes(imageId)) {
      collection.images.push(imageId);
      await collection.save();
    }

    // Add collection to image if not already present
    if (!image.collections.includes(collectionId)) {
      image.collections.push(collectionId);
      await image.save();
    }

    res.json(
      ApiResponse.success(
        { collection },
        'Image added to collection successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to add image to collection', {
        general: error.message
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
        ApiResponse.error('Collection not found', {
          collection: 'Collection not found or you do not have permission to modify it'
        })
      );
    }

    // Remove image from collection
    collection.images = collection.images.filter(id => id.toString() !== imageId);
    await collection.save();

    // Remove collection from image
    const image = await Image.findOne({ _id: imageId, userId });
    if (image) {
      image.collections = image.collections.filter(id => id.toString() !== collectionId);
      await image.save();
    }

    res.json(
      ApiResponse.success(
        { collection },
        'Image removed from collection successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to remove image from collection', {
        general: error.message
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
        ApiResponse.error('Collection not found', {
          collection: 'Collection not found or you do not have permission to delete it'
        })
      );
    }

    // Remove collection reference from all images
    await Image.updateMany(
      { collections: collectionId },
      { $pull: { collections: collectionId } }
    );

    // Delete collection
    await collection.deleteOne();

    res.json(
      ApiResponse.success(
        null,
        'Collection deleted successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to delete collection', {
        general: error.message
      })
    );
  }
};

module.exports = {
  createCollection,
  getUserCollections,
  addImageToCollection,
  removeImageFromCollection,
  deleteCollection
}; 
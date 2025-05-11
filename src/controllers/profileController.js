const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const ApiResponse = require("../utils/apiResponse");
const sharp = require("sharp");

// Helper function to remove sensitive data from user object
const sanitizeUser = (user) => {
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;
  delete sanitizedUser.verificationToken;
  delete sanitizedUser.verificationTokenExpires;
  delete sanitizedUser.__v; // Remove version key
  return sanitizedUser;
};

// Helper function to delete avatar from Cloudinary
const deleteAvatarFromCloudinary = async (avatarUrl) => {
  if (!avatarUrl) return;

  try {
    // Extract the public ID from the avatar URL
    const uploadIndex = avatarUrl.indexOf('upload/');
    if (uploadIndex !== -1) {
      // Get everything after 'upload/' and before the file extension
      const afterUpload = avatarUrl.slice(uploadIndex + 7); // 7 is length of 'upload/'
      // Remove version number if present (format: v1234567890/)
      const withoutVersion = afterUpload.replace(/^v\d+\//, '');
      // Remove file extension
      const publicId = withoutVersion.split('.')[0];
      
      console.log('Attempting to delete avatar with public ID:', publicId);
      const deleteResult = await cloudinary.uploader.destroy(publicId);
      console.log('Delete result:', deleteResult);
      return true;
    }
  } catch (error) {
    console.error('Error deleting avatar from Cloudinary:', error);
    return false;
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    res.json(
      ApiResponse.success(
        { user: sanitizeUser(user) },
        "Profile retrieved successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to retrieve profile", {
        general: error.message,
      })
    );
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, displayName, bio, location, website } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    // Update profile fields
    user.profile = {
      ...user.profile,
      firstName: firstName || user.profile.firstName,
      lastName: lastName || user.profile.lastName,
      displayName: displayName || user.profile.displayName,
      bio: bio || user.profile.bio,
      location: location || user.profile.location,
      website: website || user.profile.website,
    };

    await user.save();

    res.json(
      ApiResponse.success(
        { user: sanitizeUser(user) },
        "Profile updated successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to update profile", {
        general: error.message,
      })
    );
  }
};

// Upload avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(
        ApiResponse.error("No file uploaded", {
          file: "Please upload an image file",
        })
      );
    }

    const file = req.file;
    const userId = req.user.userId;

    // Check file size
    if (file.size > 2 * 1024 * 1024) {
      // 2MB
      return res.status(400).json(
        ApiResponse.error("File size too large", {
          file: "Avatar size must be less than 2MB",
        })
      );
    }

    // Process image with sharp
    const buffer = await sharp(file.buffer)
      .resize(200, 200, {
        fit: "cover",
        position: "center",
      })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `avatars/${userId}`,
            resource_type: "image",
            format: "jpg",
            quality: "auto:good",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(buffer);
    });

    // Update user's avatar URL
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    // Delete old avatar if exists
    if (user.profile.avatar) {
      await deleteAvatarFromCloudinary(user.profile.avatar);
    }

    user.profile.avatar = result.secure_url;
    await user.save();

    res.json(
      ApiResponse.success(
        { user: sanitizeUser(user) },
        "Avatar uploaded successfully"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to upload avatar", {
        general: error.message,
      })
    );
  }
};

// Delete avatar
const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found')
      );
    }

    // Check if user has an avatar
    if (!user.profile.avatar) {
      return res.status(400).json(
        ApiResponse.error('No avatar to delete', {
          avatar: 'User does not have an avatar'
        })
      );
    }

    // Delete avatar from Cloudinary
    await deleteAvatarFromCloudinary(user.profile.avatar);

    // Remove avatar from user profile
    user.profile.avatar = null;
    await user.save();

    res.json(
      ApiResponse.success(
        { user: sanitizeUser(user) },
        'Avatar deleted successfully'
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error('Failed to delete avatar', {
        general: error.message
      })
    );
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar
};

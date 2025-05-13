const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200,
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
  },
  cloudinaryId: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  isPublished: {
    type: Boolean,
    default: false, // Images are private by default
  },
  collections: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
    },
  ],
  topics: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    },
  ],
  likes: {
    type: Number,
    default: 0,
    min: 0,
  },
  views: {
    type: Number,
    default: 0,
    min: 0,
  },
  downloads: {
    type: Number,
    default: 0,
    min: 0,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create a function to generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
    .replace(/(^-|-$)/g, "") // Remove leading/trailing hyphens
    .replace(/-+/g, "-"); // Replace multiple hyphens with single hyphen
};

// Pre-save middleware to generate and set slug
imageSchema.pre("save", async function (next) {
  // Check if this is a new document or if title is modified
  if (this.isNew || this.isModified("title")) {
    // Generate base slug
    let slug = generateSlug(this.title);
    let counter = 1;
    let originalSlug = slug;

    // Check if slug exists and append number if it does
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${originalSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }
  next();
});

// Create indexes for better query performance
imageSchema.index({ title: "text" }); // For text search on title
imageSchema.index({ likes: -1 }); // For sorting by popularity
imageSchema.index({ views: -1 }); // For sorting by views
imageSchema.index({ downloads: -1 }); // For sorting by downloads

module.exports = mongoose.model("Image", imageSchema);

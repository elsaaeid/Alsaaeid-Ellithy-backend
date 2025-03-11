const mongoose = require("mongoose");

// Reply Schema
const replySchema = new mongoose.Schema({
  _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true // Automatically generate an ObjectId for each reply
  },
  commentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Comment', // Reference to the Comment model
  },
  user: {
      type: String,
      required: true,
  },
  photo: {
      type: String,
      required: [true, "Please add a photo"],
      default: "https://i.ibb.co/4pDNDk1/avatar.png",
  },
  reply: {
      type: String,
      required: false,
      trim: true, // Remove whitespace from both ends
  },
  createdAt: {
      type: Date,
      default: Date.now, // Automatically set the date when the reply is created
  },
  updatedAt: {
      type: Date,
      default: Date.now, // Automatically set the date when the reply is updated
  },
});

// Comment Schema
const commentSchema = new mongoose.Schema({
  _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true // Automatically generate an ObjectId for each comment
  },
  user: {
      type: String, // Store the user's name
      required: true
  },
  photo: {
      type: String,
      required: [true, "Please add a photo"],
      default: "https://i.ibb.co/4pDNDk1/avatar.png",
  },
  comment: {
      type: String,
      required: false,
      trim: true // Trim whitespace from the comment
  },
  createdAt: {
      type: Date,
      default: Date.now // Set the default to the current date
  },
  replies: [replySchema] // Use the reply schema for replies
});

// Product Schema
const productSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "User",
    },
    photo: {
      type: String,
      required: [false, "Please add a photo"],
      default: "https://i.ibb.co/4pDNDk1/avatar.png",
  },
    name: {
      type: String,
      required: [false, "Please add a name"],
      trim: true,
    },
    name_ar: { // Arabic name
      type: String,
      required: false,
      trim: true,
  },
    likeCount: {
      type: Number,
      default: 0,
  },
  likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // Reference to the User model
  }],
  comments: [commentSchema], // Use the comment schema for comments
    sku: {
        type: [String],
        required: false,
        default: "SKU",
        trim: true,
    },
    category: {
      type: String,
      required: [false, "Please add a category"],
      trim: true,
    },
    category_ar: { // Arabic category
      type: String,
      required: false,
      trim: true,
  },
    liveDemo: {
      type: String,
      required: [false, "Please add a Live Demo Link"],
      trim: true,
    },
    description: {
      type: String,
      required: [false, "Please add a description"],
      trim: true,
    },
    description_ar: { // Arabic description
      type: String,
      required: false,
      trim: true,
    },
    tags: { type: [String] },
    tags_ar: { type: [String] },
    image: {
      type: Object,
      default: {},
      required: false,
    },
    video: {
      type: Object,
      default: {},
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now
  },
  updatedAt: {
      type: Date,
      default: Date.now
  }
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;

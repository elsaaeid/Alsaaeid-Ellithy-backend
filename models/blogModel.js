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

const blogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, // Reference to the User model
        ref: "User",
        required: true,
    },
    photo: {
        type: String,
        required: [true, "Please add a photo"],
        default: "https://i.ibb.co/4pDNDk1/avatar.png",
    },
    name: {
        type: String,
        required: false,
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
        required: false,
        trim: true,
    },
    category_ar: { // Arabic category
        type: String,
        required: false,
        trim: true,
    },
    code: {
        type: String,
        required: false,
        trim: true,
    },
    description: {
        type: String,
        required: false,
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
    },
    blogItems: [
        {
            name: {
                type: String,
                required: false,
                trim: true,
            },
            name_ar: { // Arabic name for blog item
                type: String,
                required: false,
                trim: true,
            },
            description: {
                type: String,
                required: false,
                trim: true,
            },
            description_ar: { // Arabic description for blog item
                type: String,
                required: false,
                trim: true,
            },
            code: {
                type: String,
                required: false,
                trim: true,
            },
            image: {
                filePath: {
                    required: false,
                    type: String,
                },
                fileName: {
                    required: false,
                    type: String,
                },
            },
            imagePreview: {
                required: false,
                type: String,
            },
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
});


// Create Blog Model
const Blog = mongoose.model("Blog", blogSchema);

module.exports = Blog;
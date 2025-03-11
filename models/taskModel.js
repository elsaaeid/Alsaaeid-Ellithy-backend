const mongoose = require("mongoose");


// task Schema
const taskSchema = mongoose.Schema(
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
    image: {
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

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;

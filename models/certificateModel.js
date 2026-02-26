const mongoose = require("mongoose");


const certificateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: false,
      trim: true,
    },
    name_ar: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    description_ar: {
      type: String,
      required: false,
      trim: true,
    },
    sku: {
      type: String,
      required: false,
      default: "SKU",
      trim: true,
    },
    image: {
      type: Object,
      default: {},
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

const Certificate = mongoose.model("Certificate", certificateSchema);

module.exports = Certificate;
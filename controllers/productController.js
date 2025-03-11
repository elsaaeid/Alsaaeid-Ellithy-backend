const asyncHandler = require("express-async-handler");
const Product = require("../models/productModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;

// Create Product
const createProduct = asyncHandler(async (req, res) => {
  const { 
    name, 
    name_ar, 
    sku, 
    category, 
    category_ar, 
    description, 
    description_ar, 
    tags,
    tags_ar,
    liveDemo, 
  } = req.body;

  // Validation
  if (!name || !category || !description || !tags) {
    res.status(400);
    throw new Error("Please fill in all required fields");
  }

  // Handle Image upload
  let imageFileData = {};
  if (req.files && req.files.image) {
    // Save image to Cloudinary
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.files.image[0].path, {
        folder: "Portfolio React",
        resource_type: "image",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }

    imageFileData = {
      fileName: req.files.image[0].originalname,
      filePath: uploadedFile.secure_url,
      fileType: req.files.image[0].mimetype,
      fileSize: fileSizeFormatter(req.files.image[0].size, 2),
    };
  }

  // Handle Video upload
  let videoFileData = {};
  if (req.files && req.files.video) {
    // Save video to Cloudinary
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.files.video[0].path, {
        folder: "Portfolio React",
        resource_type: "video",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Video could not be uploaded");
    }

    videoFileData = {
      fileName: req.files.video[0].originalname,
      filePath: uploadedFile.secure_url,
      fileType: req.files.video[0].mimetype,
      fileSize: fileSizeFormatter(req.files.video[0].size, 2),
    };
  }

  // Create Product
  const product = await Product.create({
    user: req.user.id,
    name,
    name_ar, // Include Arabic name
    sku,
    category,
    category_ar, // Include Arabic category
    liveDemo,
    description,
    description_ar, // Include Arabic description
    tags: JSON.parse(tags),
    tags_ar: JSON.parse(tags_ar), // Include Arabic tags
    image: imageFileData,
    video: videoFileData, // Include video file data if uploaded
  });

  res.status(201).json(product);
});

// Get all Products
const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('likedBy');
    res.json(products);
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all related product by category
const getRelatedProducts = asyncHandler(async (req, res) => {
  const { category, productId } = req.params; // Destructure category and productId from params

  // Validate category input
  if (!category) {
      return res.status(400).json({ message: "Category is required" });
  }

  try {
      // Fetch the product that matches the productId to compare names
      const foundProduct = await Product.findById(productId);
      if (!foundProduct) {
          return res.status(404).json({ message: "Product not found" });
      }

      // Fetch related products by category
      const products = await Product.find({ category }).limit(5); // Fetch related products

      // Filter out products with the same name as the found product
      const filteredProducts = products.filter(product => product.name !== foundProduct.name);

      // if (!filteredProducts.length) {
      //     return res.status(404).json({ message: "No related products found" });
      // }

      res.status(200).json(filteredProducts); // Return the filtered products
  } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get single product
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  // if product doesn't exist
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // Match product to its user
  // if (product.user.toString() !== req.user.id) {
  //   res.status(401);
  //   throw new Error("User not authorized");
  // }
  res.status(200).json(product);
});

// Delete Product
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  // if product doesnt exist
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // Match product to its user
  if (product.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await product.remove();
  res.status(200).json({ message: "Product deleted." });
});

// Update Product
const updateProduct = asyncHandler(async (req, res) => {
  const {       
    name, 
    name_ar, // Arabic name
    category, 
    category_ar, // Arabic category
    description, 
    description_ar,
    tags,
    tags_ar,
    liveDemo, 
  } = req.body;
  
  const { id } = req.params;

  const product = await Product.findById(id);

  // If product doesn't exist
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Match product to its user
  if (product.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Handle Image upload
  let imageFileData = {};
  if (req.files && req.files.image) {
    // Save image to Cloudinary
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.files.image[0].path, {
        folder: "Portfolio React",
        resource_type: "image",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }

    imageFileData = {
      fileName: req.files.image[0].originalname,
      filePath: uploadedFile.secure_url,
      fileType: req.files.image[0].mimetype,
      fileSize: fileSizeFormatter(req.files.image[0].size, 2),
    };
  }

  // Handle Video upload
  let videoFileData = {};
  if (req.files && req.files.video) {
    // Save video to Cloudinary
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.files.video[0].path, {
        folder: "Portfolio React",
        resource_type: "video",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Video could not be uploaded");
    }

    videoFileData = {
      fileName: req.files.video[0].originalname,
      filePath: uploadedFile.secure_url,
      fileType: req.files.video[0].mimetype,
      fileSize: fileSizeFormatter(req.files.video[0].size, 2),
    };
  }

  // Update Product
  const updatedProduct = await Product.findByIdAndUpdate(
    id, // Use id directly instead of an object
    {
      name,
      name_ar, // Include Arabic name
      category,
      category_ar, // Include Arabic category
      liveDemo,
      description,
      description_ar, // Include Arabic description
      tags: JSON.parse(tags),
      tags_ar: JSON.parse(tags_ar),
      image: Object.keys(imageFileData).length === 0 ? product.image : imageFileData,
      video: Object.keys(videoFileData).length === 0 ? product.video : videoFileData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json(updatedProduct);
});


// Function to like a item post
const likeItem = async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id; // Assuming req.user is set by the protect middleware

  try {
      // Find the item post by ID
      const item = await Product.findById(itemId);
      if (!item) {
          return res.status(404).json({ message: 'Item not found' });
      }

      // Check if the user has already liked the item
      if (item.likedBy.includes(userId)) {
          return res.status(400).json({ message: 'You have already liked this item' });
      }

      // Add the user to the likedBy array
      item.likedBy.push(userId); // Add the user ID to the array
      item.likeCount += 1; // Increment the like count
      await item.save(); // Save the updated item post

      return res.status(200).json({ message: 'Item liked successfully', likeCount: item.likeCount });
  } catch (error) {
      console.error('Error liking item:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Function to unlike a item post
const unlikeItem = async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id; // Assuming req.user is set by the protect middleware

  try {
      // Find the item post by ID
      const item = await Product.findById(itemId);
      if (!item) {
          return res.status(404).json({ message: 'Item not found' });
      }

      // Check if the user has already liked the item
      const likedIndex = item.likedBy.indexOf(userId);
      if (likedIndex === -1) {
          return res.status(400).json({ message: 'You have not liked this item yet' });
      }

      // Remove the user from the likedBy array
      item.likedBy.splice(likedIndex, 1); // Remove the user ID from the array

      // Decrement the like count, ensuring it doesn't go below zero
      if (item.likeCount > 0) {
        item.likeCount -= 1; // Decrement the like count only if it's greater than zero
      }

      await item.save(); // Save the updated item post

      return res.status(200).json({ message: 'Item unliked successfully', likeCount: item.likeCount });
  } catch (error) {
      console.error('Error unliking item:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
//commentItem
const commentItem = async (req, res) => {
  const itemId = req.params.itemId;
  const { comment, userName, userPhoto } = req.body;

  // Log incoming data
  console.log("Received data:", { itemId, comment, userName, userPhoto });

  // Validate input
  if (!comment || !userName || !userPhoto) {
      return res.status(400).json({ message: "Comment and user name are required." });
  }

  // Check if itemId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item ID format." });
  }

  // Find the item post by ID
  const item = await Product.findById(itemId);
  if (!item) {
      return res.status(404).json({ message: "Item post not found." });
  }

  // Create a new comment object
  const newComment = {
      user: userName,
      photo: userPhoto,
      comment: comment,
      createdAt: new Date()
  };

  // Add the new comment to the item's comments array
  item.comments.push(newComment);

  // Save the updated item post
  await item.save();

  // Log the response being sent back
  console.log("Response data:", { message: "Comment added successfully.", comment: newComment });
  res.status(200).json({ message: "Comment added successfully.", comment: newComment });
};

// Reply to a comment
const replyItem = async (req, res) => {
  const { itemId, commentId } = req.params;
  const { reply, userName, userPhoto } = req.body; // Assuming userId is sent with the reply

  // Log incoming data
  console.log("Received data:", { itemId, commentId, reply, userName, userPhoto });
  
  // Validate incoming data
  if (!reply || !userName || !userPhoto) {
      return res.status(400).json({ message: 'Reply and userId are required.' });
  }

  try {
      // Find the item post by ID
      const item = await Product.findById(itemId);
      if (!item) {
          return res.status(404).json({ message: 'Item not found.' });
      }

      // Find the comment by ID
      const comment = item.comments.id(commentId);
      if (!comment) {
          return res.status(404).json({ message: 'Comment not found.' });
      }

      // Create a new reply object
      const newReply = {
          commentId: commentId, // Reference to the comment being replied to
          user: userName,
          photo: userPhoto,
          reply: reply,
          createdAt: new Date()
      };

      // Push the new reply into the comment's replies array
      comment.replies.push(newReply);

      // Save the updated item document
      await item.save();

      // Return the updated comment with replies
      return res.status(200).json(comment);
  } catch (error) {
      console.error('Error replying to comment:', error);
      return res.status(500).json({ message: 'Internal server error.' });
  }
};

// Function to edit a comment
const editComment = async (req, res) => {
  const { commentId } = req.params; // Extract commentId from the request parameters
  const { comment } = req.body; // Extract the new comment text from the request body

  // Log incoming data
  console.log("Editing comment:", { commentId, comment });

  // Validate input
  if (!comment) {
      return res.status(400).json({ message: "Comment text is required." });
  }

  // Check if commentId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID format." });
  }

  // Find the item post that contains the comment
  const item = await Product.findOne({ "comments._id": commentId });
  if (!item) {
      return res.status(404).json({ message: "Comment not found." });
  }

  // Find the comment to edit
  const commentToEdit = item.comments.id(commentId);
  if (!commentToEdit) {
      return res.status(404).json({ message: "Comment not found." });
  }

  // Update the comment text
  commentToEdit.comment = comment;

  // Save the updated item post
  await item.save();

  // Log the response being sent back
  console.log("Response data:", { message: "Comment updated successfully.", comment: commentToEdit });
  res.status(200).json({ message: "Comment updated successfully.", comment: commentToEdit });
};

// Function to delete a comment
const deleteComment = async (req, res) => {
  const { commentId } = req.params; // Extract commentId from the request parameters

  // Log incoming data
  console.log("Attempting to delete comment with ID:", commentId);

  // Check if commentId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID format." });
  }

  // Attempt to find the item and remove the comment
  const item = await Product.findOneAndUpdate(
      { "comments._id": commentId }, // Find item with the comment
      { $pull: { comments: { _id: commentId } } }, // Remove the comment
      { new: true } // Return the updated item
  );

  // Check if the item was found and updated
  if (!item) {
      return res.status(404).json({ message: "Comment not found." });
  }

  // Successfully deleted the comment
  res.status(200).json({ message: "Comment deleted successfully." });
};

module.exports = {
  createProduct,
  getProducts,
  getRelatedProducts,
  getProduct,
  deleteProduct,
  updateProduct,
  likeItem,
  unlikeItem,
  commentItem,
  replyItem,
  editComment,
  deleteComment,
};


const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Blog = require("../models/blogModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;



// Create Blog
const createBlog = asyncHandler(async (req, res) => {
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
      code,
      language,
  } = req.body;

  // Log the incoming request body for debugging
  console.log("Request Body:", req.body);
  
  // Check if blogItems is defined and is a valid JSON string
  let blogItems;
  try {
      // Check if blogItems is present in the request body
      if (req.body.blogItems === null) {
          blogItems = null; // Set to null if explicitly sent as null
      } else if (!req.body.blogItems) {
          return res.status(400).json({ message: "Blog items are required" });
      } else {
          // Attempt to parse blogItems
          blogItems = JSON.parse(req.body.blogItems); 
      }
  } catch (error) {
      return res.status(400).json({ message: "Invalid blog items format" });
  }

  // Check if blogItems is an array or null
  if (blogItems !== null && !Array.isArray(blogItems)) {
      return res.status(400).json({ message: "Blog items must be an array or null" });
  }

  // Handle Image upload
  let fileData = {};
  if (req.files && req.files.image) {
      // Save image to cloudinary
      let uploadedFile;
      try {
          uploadedFile = await cloudinary.uploader.upload(req.files.image[0].path, {
              folder: "Portfolio React",
              resource_type: "image",
          });
      } catch (error) {
          return res.status(500).json({ message: "Image could not be uploaded" });
      }

      fileData = {
          fileName: req.files.image[0].originalname,
          filePath: uploadedFile.secure_url,
          fileType: req.files.image[0].mimetype,
          fileSize: fileSizeFormatter(req.files.image[0].size, 2),
      };
  }

  // Handle blog item images
  let blogItemImages = [];
  if (req.files && req.files.blogItemImages) {
      for (const file of req.files.blogItemImages) {
          let uploadedFile;
          try {
              uploadedFile = await cloudinary.uploader.upload(file.path, {
                  folder: "Portfolio React",
                  resource_type: "image",
              });
              blogItemImages.push({
                  fileName: file.originalname,
                  filePath: uploadedFile.secure_url,
                  fileType: file.mimetype,
                  fileSize: fileSizeFormatter(file.size, 2),
              });
          } catch (error) {
              return res.status(500).json({ message: "Blog item image could not be uploaded" });
          }
      }
  }

  // Create Blog
  const blog = await Blog.create({
      user: req.user.id,
      name, // English name
      name_ar, // Arabic name
      sku,
      category, // English category
      category_ar, // Arabic category
      description, // English description
      description_ar, // Arabic description
      tags: JSON.parse(tags),
      tags_ar: JSON.parse(tags_ar),
      code,
      language,
      image: fileData,
      blogItems: blogItems ? blogItems.map((item, index) => ({
          ...item,
          image: blogItemImages[index] || null // Attach corresponding blog item image if available
      })) : [], // Ensure blogItems is an array
  });

  res.status(201).json(blog);
});
// Get all blogs
const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().populate('likedBy').sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Error retrieving blogs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get all related blogs by category
const getRelatedBlogs = asyncHandler(async (req, res) => {
    const { category, blogId } = req.params; // Destructure category and blogId from params

    // Validate category input
    if (!category) {
        return res.status(400).json({ message: "Category is required" });
    }

    try {
        // Fetch the blog that matches the blogId to compare names
        const foundBlog = await Blog.findById(blogId);
        if (!foundBlog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        // Fetch related blogs by category
        const blogs = await Blog.find({ category }).limit(5).sort({ createdAt: -1 }); // Fetch related blogs

        // Filter out blogs with the same name as the found blog
        const filteredBlogs = blogs.filter(blog => blog.name !== foundBlog.name);

        // if (!filteredBlogs.length) {
        //     return res.status(404).json({ message: "No related blogs found" });
        // }

        res.status(200).json(filteredBlogs); // Return the filtered blogs
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});


// Get single Blog
const getBlog = asyncHandler(async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    // if Blog doesn't exist
    if (!blog) {
        res.status(404);
        throw new Error("Blog not found");
    }
    res.status(200).json(blog);
});

// Delete blog
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  // if blog doesnt exist
  if (!blog) {
    res.status(404);
    throw new Error("Blog not found");
  }
  // Match blog to its user
  if (blog.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await blog.remove();
  res.status(200).json({ message: "Blog deleted." });
});

// Update blog
const updateBlog = asyncHandler(async (req, res) => {
    const { 
        name, 
        name_ar, 
        category, 
        category_ar, 
        description, 
        description_ar, 
        tags,
        tags_ar, 
        code, 
        language,
        blogItems 
    } = req.body;
    const { id } = req.params;

    const blog = await Blog.findById(id);

    // If blog doesn't exist
    if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
    }

    // Match blog to its user
    if (blog.user.toString() !== req.user.id) {
        return res.status(401).json({ message: "User not authorized" });
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


    // Prepare update data
    const updateData = {
        name, 
        name_ar, 
        category, 
        category_ar, 
        description, 
        description_ar, 
        tags: JSON.parse(tags),
        tags_ar: JSON.parse(tags_ar), 
        code,
        language,
        image: Object.keys(imageFileData).length === 0 ? blog.image : imageFileData,
    };

    // Update blogItems if provided
    if (blogItems) {
        const parsedBlogItems = JSON.parse(blogItems); // Parse the JSON string sent from the frontend
        updateData.blogItems = parsedBlogItems.map((blogItem) => ({
            id: blogItem.id || undefined, // Use existing ID or generate a new one
            name: blogItem.name || "",
            name_ar: blogItem.name_ar || "",
            code: blogItem.code || "", // code
            language: blogItem.language || "", // language
            image: blogItem.image || "", // image
            description: blogItem.description || "", // description
            description_ar: blogItem.description_ar || "", // description_ar
        }));
    }

    // Update blog
    const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });

    // Check if the blog was updated
    if (!updatedBlog) {
        return res.status(500).json({ message: "Failed to update blog" });
    }

    res.status(200).json(updatedBlog);
});

// Function to like a item post
const likeItem = async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id; // Assuming req.user is set by the protect middleware

  try {
      // Find the item post by ID
      const item = await Blog.findById(itemId);
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
      const item = await Blog.findById(itemId);
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
  const item = await Blog.findById(itemId);
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
      const item = await Blog.findById(itemId);
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
  const item = await Blog.findOne({ "comments._id": commentId });
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
  const item = await Blog.findOneAndUpdate(
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
  createBlog,
  getBlogs,
  getRelatedBlogs,
  getBlog,
  deleteBlog,
  updateBlog,
  likeItem,
  unlikeItem,
  commentItem,
  replyItem,
  editComment,
  deleteComment,
};

const asyncHandler = require("express-async-handler");
const Video = require("../models/videoModel");



// Create video
const createVideo = asyncHandler(async (req, res) => {
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
    videoUrl,
  } = req.body;

  // Validation
  if (!name || !category || !description || !videoUrl || !tags) {
    res.status(400);
    throw new Error("Please fill in all required fields");
  }

  // Create video
  const newVideo = await Video.create({
    user: req.user.id,
    name,
    name_ar,
    sku,
    category,
    category_ar,
    description,
    description_ar,
    tags: JSON.parse(tags),
    tags_ar: JSON.parse(tags_ar),
    videoUrl,
  });

  res.status(201).json(newVideo);
});


// Get all videos
const getVideos = async (req, res) => {
  try {
    const videos = await Video.find().populate('likedBy');
    res.json(videos);
  } catch (error) {
    console.error('Error retrieving videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get all related video by category
const getRelatedVideos = asyncHandler(async (req, res) => {
  const { category, videoId } = req.params; // Destructure category and videoId from params

  // Validate category input
  if (!category) {
      return res.status(400).json({ message: "Category is required" });
  }

  try {
      // Fetch the video that matches the videoId to compare names
      const foundVideo = await Video.findById(videoId);
      if (!foundVideo) {
          return res.status(404).json({ message: "Video not found" });
      }

      // Fetch related videos by category
      const videos = await Video.find({ category }).limit(5); // Fetch related videos

      // Filter out videos with the same name as the found video
      const filteredVideos = videos.filter(video => video.name !== foundVideo.name);

      // if (!filteredVideos.length) {
      //     return res.status(404).json({ message: "No related videos found" });
      // }

      res.status(200).json(filteredVideos); // Return the filtered videos
  } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
  }
});


// Get single video
const getVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  // if video doesn't exist
  if (!video) {
    res.status(404);
    throw new Error("video not found");
  }
  // Match video to its user
  // if (video.user.toString() !== req.user.id) {
  //   res.status(401);
  //   throw new Error("User not authorized");
  // }
  res.status(200).json(video);
});

// Delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  // if video doesn't exist
  if (!video) {
    res.status(404);
    throw new Error("video not found");
  }
  // Match video to its user
  if (video.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await video.remove();
  res.status(200).json({ message: "video deleted." });
});

// Update video
const updateVideo = asyncHandler(async (req, res) => {
  const {       
    name, 
    name_ar, // Arabic name
    category, 
    category_ar, // Arabic category
    description, 
    description_ar,
    tags, 
    tags_ar, // Arabic tags
    videoUrl,
  } = req.body;
  
  const { id } = req.params;

  const videoItem = await Video.findById(id);

  // If video doesn't exist
  if (!videoItem) {
    res.status(404);
    throw new Error("video not found");
  }

  // Match video to its user
  if (videoItem.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Update video
  const updatedVideo = await Video.findByIdAndUpdate(
    id, // Use id directly instead of an object
    {
      name,
      name_ar, // Include Arabic name
      category,
      category_ar, // Include Arabic category
      description,
      description_ar, // Include Arabic 
      tags: JSON.parse(tags),
      tags_ar: JSON.parse(tags_ar),
      videoUrl,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json(updatedVideo);
});


// Function to like a item post
const likeItem = async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id; // Assuming req.user is set by the protect middleware

  try {
      // Find the item post by ID
      const item = await Video.findById(itemId);
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
      const item = await Video.findById(itemId);
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
  const item = await Video.findById(itemId);
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
      const item = await Video.findById(itemId);
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
  const item = await Video.findOne({ "comments._id": commentId });
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
  const item = await Video.findOneAndUpdate(
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
  createVideo,
  getVideos,
  getRelatedVideos,
  getVideo,
  deleteVideo,
  updateVideo,
  likeItem,
  unlikeItem,
  commentItem,
  replyItem,
  editComment,
  deleteComment,
};


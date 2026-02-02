const asyncHandler = require("express-async-handler");
const Project = require("../models/projectModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;

// Create Project
const createProject = asyncHandler(async (req, res) => {
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

  // Handle Images upload (supporting multiple images)
  let imagesFileData = [];
  if (req.files && req.files.images) {
    const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    
    for (const imageFile of imageFiles) {
      try {
        const uploadedFile = await cloudinary.uploader.upload(imageFile.path, {
          folder: "Portfolio React",
          resource_type: "image",
        });

        imagesFileData.push({
          fileName: imageFile.originalname,
          filePath: uploadedFile.secure_url,
          fileType: imageFile.mimetype,
          fileSize: fileSizeFormatter(imageFile.size, 2),
        });
      } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500);
        throw new Error("Image could not be uploaded");
      }
    }
  } else if (req.files && req.files.image) {
    // Fallback for old single image field
    try {
      const uploadedFile = await cloudinary.uploader.upload(req.files.image[0].path, {
        folder: "Portfolio React",
        resource_type: "image",
      });

      imagesFileData.push({
        fileName: req.files.image[0].originalname,
        filePath: uploadedFile.secure_url,
        fileType: req.files.image[0].mimetype,
        fileSize: fileSizeFormatter(req.files.image[0].size, 2),
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }
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

  // Create Project
  const project = await Project.create({
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
    images: imagesFileData.length > 0 ? imagesFileData : [],
    image: imagesFileData.length > 0 ? imagesFileData[0] : {}, // Keep backward compatibility
    video: videoFileData, // Include video file data if uploaded
  });

  res.status(201).json(project);
});

// Get all Projects
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find().populate('likedBy').sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all related project by category
const getRelatedProjects = asyncHandler(async (req, res) => {
  const { category, projectId } = req.params; // Destructure category and projectId from params

  // Validate category input
  if (!category) {
      return res.status(400).json({ message: "Category is required" });
  }

  try {
      // Fetch the project that matches the projectId to compare names
      const foundProject = await Project.findById(projectId);
      if (!foundProject) {
          return res.status(404).json({ message: "Project not found" });
      }

      // Fetch related projects by category
      const projects = await Project.find({ category }).limit(5).sort({ createdAt: -1 }); // Fetch related projects

      // Filter out projects with the same name as the found project
      const filteredProjects = projects.filter(project => project.name !== foundProject.name);

      // if (!filteredProjects.length) {
      //     return res.status(404).json({ message: "No related projects found" });
      // }

      res.status(200).json(filteredProjects); // Return the filtered projects
  } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get single project
const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  // if project doesn't exist
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  // Match project to its user
  // if (project.user.toString() !== req.user.id) {
  //   res.status(401);
  //   throw new Error("User not authorized");
  // }
  res.status(200).json(project);
});

// Delete Project
const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  // if project doesnt exist
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  // Match project to its user
  // if (project.user.toString() !== req.user.id) {
  //   res.status(401);
  //   throw new Error("User not authorized");
  // }
  await project.remove();
  res.status(200).json({ message: "Project deleted." });
});

// Update Project
const updateProject = asyncHandler(async (req, res) => {
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

  const project = await Project.findById(id);

  // If project doesn't exist
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  // Match project to its user
  if (project.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Handle Images upload (supporting multiple images)
  let imagesFileData = [];
  const existingImages = req.body.existingImages ? 
    (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages]) 
    : [];

  if (req.files && req.files.images) {
    const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    
    for (const imageFile of imageFiles) {
      try {
        const uploadedFile = await cloudinary.uploader.upload(imageFile.path, {
          folder: "Portfolio React",
          resource_type: "image",
        });

        imagesFileData.push({
          fileName: imageFile.originalname,
          filePath: uploadedFile.secure_url,
          fileType: imageFile.mimetype,
          fileSize: fileSizeFormatter(imageFile.size, 2),
        });
      } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500);
        throw new Error("Image could not be uploaded");
      }
    }
  } else if (req.files && req.files.image) {
    // Fallback for old single image field
    try {
      const uploadedFile = await cloudinary.uploader.upload(req.files.image[0].path, {
        folder: "Portfolio React",
        resource_type: "image",
      });

      imagesFileData.push({
        fileName: req.files.image[0].originalname,
        filePath: uploadedFile.secure_url,
        fileType: req.files.image[0].mimetype,
        fileSize: fileSizeFormatter(req.files.image[0].size, 2),
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }
  } else if (existingImages.length > 0) {
    // Keep existing images if no new files uploaded
    imagesFileData = existingImages.map(img => 
      typeof img === 'string' ? { filePath: img } : img
    );
  } else {
    // If no new images and no existing images specified, use old image field if available
    if (project.images && project.images.length > 0) {
      imagesFileData = project.images;
    } else if (project.image && Object.keys(project.image).length > 0) {
      imagesFileData = [project.image];
    }
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

  // Update Project
  const updatedProject = await Project.findByIdAndUpdate(
    id,
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
      images: imagesFileData.length > 0 ? imagesFileData : project.images || [],
      image: imagesFileData.length > 0 ? imagesFileData[0] : (project.image || {}), // Keep backward compatibility
      video: Object.keys(videoFileData).length === 0 ? project.video : videoFileData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json(updatedProject);
});


// Function to like a project post
const likeItem = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user._id; // Assuming req.user is set by the protect middleware

  try {
      // Find the project post by ID
      const project = await Project.findById(projectId);
      if (!project) {
          return res.status(404).json({ message: 'Project not found' });
      }

      // Check if the user has already liked the project
      if (project.likedBy.includes(userId)) {
          return res.status(400).json({ message: 'You have already liked this project' });
      }

      // Add the user to the likedBy array
      project.likedBy.push(userId); // Add the user ID to the array
      project.likeCount += 1; // Increment the like count
      await project.save(); // Save the updated project post

      return res.status(200).json({ message: 'Project liked successfully', likeCount: project.likeCount });
  } catch (error) {
      console.error('Error liking project:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Function to unlike a item post
const unlikeItem = async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id; // Assuming req.user is set by the protect middleware

  try {
      // Find the item post by ID
      const item = await Project.findById(itemId);
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
  const item = await Project.findById(itemId);
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
      const item = await Project.findById(itemId);
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

  // Find the project post that contains the comment
  const project = await Project.findOne({ "comments._id": commentId });
  if (!project) {
      return res.status(404).json({ message: "Comment not found." });
  }

  // Find the comment to edit
  const commentToEdit = project.comments.id(commentId);
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

  // Attempt to find the project and remove the comment
  const project = await Project.findOneAndUpdate(
      { "comments._id": commentId }, // Find project with the comment
      { $pull: { comments: { _id: commentId } } }, // Remove the comment
      { new: true } // Return the updated project
  );

  // Check if the project was found and updated
  if (!item) {
      return res.status(404).json({ message: "Comment not found." });
  }

  // Successfully deleted the comment
  res.status(200).json({ message: "Comment deleted successfully." });
};

module.exports = {
  createProject,
  getProjects,
  getRelatedProjects,
  getProject,
  deleteProject,
  updateProject,
  likeItem,
  unlikeItem,
  commentItem,
  replyItem,
  editComment,
  deleteComment,
};


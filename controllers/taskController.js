const asyncHandler = require("express-async-handler");
const Task = require("../models/taskModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;

// Create task
const createTask = asyncHandler(async (req, res) => {
  const { 
    name, 
    name_ar, 
    sku, 
    category, 
    category_ar, 

  } = req.body;

  // Validation
  if (!name || !category) {
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

  // Create task
  const task = await Task.create({
    user: req.user.id,
    name,
    name_ar, // Include Arabic name
    sku,
    category,
    category_ar, // Include Arabic category
    image: imageFileData,
  });

  res.status(201).json(task);
});

// Get all tasks
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (error) {
    console.error('Error retrieving tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get single task
const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  // if task doesn't exist
  if (!task) {
    res.status(404);
    throw new Error("task not found");
  }
  // Match task to its user
  // if (task.user.toString() !== req.user.id) {
  //   res.status(401);
  //   throw new Error("User not authorized");
  // }
  res.status(200).json(task);
});

// Delete task
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  // if task doesnt exist
  if (!task) {
    res.status(404);
    throw new Error("task not found");
  }
  // Match task to its user
  if (task.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await task.remove();
  res.status(200).json({ message: "task deleted." });
});

// Update task
const updateTask = asyncHandler(async (req, res) => {
  const {       
    name, 
    name_ar, // Arabic name
    category, 
    category_ar, // Arabic category
  } = req.body;
  
  const { id } = req.params;

  const task = await Task.findById(id);

  // If task doesn't exist
  if (!task) {
    res.status(404);
    throw new Error("task not found");
  }

  // Match task to its user
  if (task.user.toString() !== req.user.id) {
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

  // Update task
  const updatedTask = await Task.findByIdAndUpdate(
    id, // Use id directly instead of an object
    {
      name,
      name_ar, // Include Arabic name
      category,
      category_ar, // Include Arabic category
      image: Object.keys(imageFileData).length === 0 ? task.image : imageFileData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json(updatedTask);
});

module.exports = {
  createTask,
  getTasks,
  getTask,
  deleteTask,
  updateTask,
};


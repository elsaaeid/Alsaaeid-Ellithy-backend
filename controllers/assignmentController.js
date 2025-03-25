const asyncHandler = require("express-async-handler");
const Assignment = require("../models/assignmentModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;


// Create assignment
const createAssignment = asyncHandler(async (req, res) => {
  const { 
    name, 
    name_ar, 
    sku, 
    category, 
    category_ar, 
    technicalQuestions, 
    questions,
  } = req.body;

  // Validation
  if (!name || !category || !technicalQuestions || !questions) {
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

  // Create assignment
  const assignment = await Assignment.create({
    user: req.user.id,
    name,
    name_ar,
    sku,
    category,
    category_ar,
    technicalQuestions: JSON.parse(technicalQuestions),
    questions: JSON.parse(questions),
    image: imageFileData,
  });

  res.status(201).json(assignment);
});

module.exports = { createAssignment };

// Get all assignments
const getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find();
    res.json(assignments);
  } catch (error) {
    console.error('Error retrieving assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all related assignment by category
const getRelatedAssignments = asyncHandler(async (req, res) => {
  const { category, assignmentId } = req.params; // Destructure category and assignmentId from params

  // Validate category input
  if (!category) {
      return res.status(400).json({ message: "Category is required" });
  }

  try {
      // Fetch the assignment that matches the assignmentId to compare names
      const foundAssignment = await Assignment.findById(assignmentId);
      if (!foundAssignment) {
          return res.status(404).json({ message: "assignment not found" });
      }

      // Fetch related assignments by category
      const assignments = await Assignment.find({ category }).limit(5); // Fetch related assignments

      // Filter out assignments with the same name as the found assignment
      const filteredAssignments = assignments.filter(assignment => assignment.name !== foundAssignment.name);

      // if (!filteredAssignments.length) {
      //     return res.status(404).json({ message: "No related assignments found" });
      // }

      res.status(200).json(filteredAssignments); // Return the filtered assignments
  } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get single assignment
const getAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  // if assignment doesn't exist
  if (!assignment) {
    res.status(404);
    throw new Error("assignment not found");
  }
  // Match assignment to its user
  // if (assignment.user.toString() !== req.user.id) {
  //   res.status(401);
  //   throw new Error("User not authorized");
  // }
  res.status(200).json(assignment);
});

// Delete assignment
const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  // if assignment doesn't exist
  if (!assignment) {
    res.status(404);
    throw new Error("assignment not found");
  }
  // Match assignment to its user
  if (assignment.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await assignment.remove();
  res.status(200).json({ message: "assignment deleted." });
});

// Update assignment
const updateAssignment = asyncHandler(async (req, res) => {
  const {       
    name, 
    name_ar, 
    sku,
    category, 
    category_ar, 
    technicalQuestions, 
    questions,
  } = req.body;
  
  const { id } = req.params;

  // Find the assignment by ID
  const assignment = await Assignment.findById(id);

  // If assignment doesn't exist
  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }

  // Match assignment to its user
  if (assignment.user.toString() !== req.user.id) {
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

  // Update assignment fields
  assignment.name = name || assignment.name;
  assignment.name_ar = name_ar || assignment.name_ar;
  assignment.sku = sku || assignment.sku;
  assignment.category = category || assignment.category;
  assignment.category_ar = category_ar || assignment.category_ar;
  // Update technical questions if provided
  if (technicalQuestions) {
    const parsedQuestions = JSON.parse(technicalQuestions); // Parse the JSON string sent from the frontend
    assignment.technicalQuestions = parsedQuestions.map((technicalQuestion) => ({
      id: technicalQuestion.id || undefined, // Use existing ID or generate a new one
      technicalQuestion: technicalQuestion.technicalQuestion || "", // English question
      technicalQuestion_ar: technicalQuestion.technicalQuestion_ar || "", // Arabic question
      correctAnswer: technicalQuestion.correctAnswer || "", // English correct answer
      correctAnswer_ar: technicalQuestion.correctAnswer_ar || "", // Arabic correct answer
      correctCode: technicalQuestion.correctCode || "", // English correct code
    }));
  }
  // Update questions if provided
  if (questions) {
    const parsedQuestions = JSON.parse(questions); // Parse the JSON string sent from the frontend
    assignment.questions = parsedQuestions.map((question) => ({
      id: question.id || undefined, // Use existing ID or generate a new one
      question: question.question || "", // English question
      question_ar: question.question_ar || "", // Arabic question
      code: question.code || "", // code
      language: question.language || "", // language
      options: Array.isArray(question.options) ? question.options : [], // English options
      options_ar: Array.isArray(question.options_ar) ? question.options_ar : [], // Arabic options
      correctAnswer: question.correctAnswer || "", // English correct answer
      correctAnswer_ar: question.correctAnswer_ar || "", // Arabic correct answer
    }));
  }

  // Update image if a new one is uploaded
  assignment.image = Object.keys(imageFileData).length === 0 ? assignment.image : imageFileData;

  // Save the updated assignment
  await assignment.save();

  res.status(200).json(assignment);
});

// Send choice assignment score
const sendAssignment = asyncHandler(async (req, res) => {
  const assignmentId = req.params.assignmentId;
  const { userId, userName, userPhoto, score, totalQuestions, answers } = req.body;

  // Log incoming data
  console.log("Received data:", { assignmentId, userId, userName, userPhoto, score, totalQuestions, answers });

  // Validate required fields
  if (!userId || !userName || !userPhoto || !assignmentId || score === undefined || !totalQuestions || !answers) {
    return res.status(400).json({ message: "Please fill in all required fields" });
  }

  try {
    // Find the assignment by ID
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check if the user has already submitted answers for this assignment
    const existingScore = assignment.scores.find((submission) => {
      // Ensure `submission.user` exists before calling `.toString()`
      return submission.user && submission.user.toString() === userId;
    });

    if (existingScore) {
      return res.status(400).json({ message: "You have already submitted the choice" });
    }

    // Parse the answers array
    const parsedAnswers = JSON.parse(answers);


    // Ensure each answer has the required fields
    const validatedAnswers = parsedAnswers.map((answer) => ({
      assignmentId: assignmentId,
      questionIndex: answer.questionIndex,
      selectedOption: answer.selectedOption,
      answer: answer.answer,
      isCorrect: answer.isCorrect !== undefined ? answer.isCorrect : false,
    }));


    // Create a new score object
    const newScore = {
      user: userId,
      userName,
      userPhoto,
      score,
      totalQuestions,
      answers: validatedAnswers, // Use the parsed answers array
      createdAt: new Date(),
    };

    // Add the score to the assignment's scores array
    assignment.scores.push(newScore);

    // Save the updated assignment
    await assignment.save();

    res.status(201).json({ message: "Score submitted successfully", assignment });
  } catch (error) {
    console.error("Error submitting score:", error);
    res.status(500).json({ message: "Failed to submit score", error });
  }
});

// Send technical assignment score
const sendTechnicalAssignment = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params; // Extract assignmentId from URL params
  const { userId, userName, userPhoto, technicalScore, totalQuestions, technicalAnswers } = req.body; // Extract userId and code from request body

  // Log incoming data
  console.log("Received data:", { assignmentId, userId, userName, userPhoto, technicalScore, totalQuestions, technicalAnswers });

  // Validate required fields
  if (!userId || !userName || !userPhoto || technicalScore === undefined || !totalQuestions || !technicalAnswers) {
    return res.status(400).json({ message: "Please fill in all required fields" });
  }

  try {
    // Find the assignment by ID
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check if the user has already submitted code for this assignment
    const existingSubmission = assignment.technicalScores.find((submission) => {
      // Ensure `submission.user` exists before calling `.toString()`
      return submission.user && submission.user.toString() === userId;
    });

    if (existingSubmission) {
      return res.status(400).json({ message: "You have already submitted the code" });
    }

    // Parse the answers array
    const parsedAnswers = JSON.parse(technicalAnswers);

    // Ensure each answer has the required fields
    const validatedAnswers = parsedAnswers.map((technicalAnswer) => ({
      assignmentId: assignmentId,
      questionIndex: technicalAnswer.questionIndex,
      technicalAnswer: technicalAnswer.technicalAnswer,
      codeAnswer: technicalAnswer.codeAnswer,
      language: technicalAnswer.language,
      isCorrect: technicalAnswer.isCorrect !== undefined ? technicalAnswer.isCorrect : false,
    }));

    // Create a technical code object
    const technicalScoreObj = {
      user: userId,
      userName,
      userPhoto,
      technicalScore,
      totalQuestions,
      technicalAnswers: validatedAnswers, // Use the validated answers array
      createdAt: new Date(),
    };

    // Add the technical code to the assignment's technicalScores array
    assignment.technicalScores.push(technicalScoreObj);

    // Save the updated assignment
    await assignment.save();

    res.status(201).json({ message: "Code submitted successfully", assignment });
  } catch (error) {
    console.error("Error submitting code:", error);
    res.status(500).json({ message: "Failed to submit code", error: error.message });
  }
});


// getUserAnswers 
const getUserAnswers = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const { userId } = req.body;
  if (!userId ||!assignmentId) {
    return res.status(400).json({ message: "Please provide user ID and assignment ID" });
  }
  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    const userScore = assignment.scores.find((score) => score.user.toString() === userId);
    if (!userScore) {
      return res.status(404).json({ message: "User has not submitted answers for this assignment" });
    }
    res.status(200).json({ userScore });
  } catch (error) {
    console.error("Error getting user answers:", error);
    res.status(500).json({ message: "Failed to get user answers", error: error.message });
  }
});

module.exports = {
  createAssignment,
  getAssignments,
  getRelatedAssignments,
  getAssignment,
  deleteAssignment,
  updateAssignment,
  sendAssignment,
  sendTechnicalAssignment,
  getUserAnswers,
};


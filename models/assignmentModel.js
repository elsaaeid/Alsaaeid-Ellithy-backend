const mongoose = require("mongoose");


const questionSchema = new mongoose.Schema({
    question: {
      type: String,
      required: false,
    },
    question_ar: {
      type: String,
      required: false,
    },
    code: {
      type: String,
      required: false,
    },
    language: {
      type: String,
      required: false,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (options) => options.length === 4,
        message: 'Each question must have 4 options'
      }
    },
    options_ar: {
      type: [String],
      required: true,
      validate: {
        validator: (options_ar) => options_ar.length === 4,
        message: 'Each question must have 4 options'
      }
    },
    correctAnswer: {
      type: String,
      required: false,
    },
    correctAnswer_ar: {
      type: String,
      required: false,
    },
});

// Answer Schema for storing user answers
const answerSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Assignment", // Reference to the Assignment model
  },
  questionIndex: {
    type: Number,
    required: true,
  },
  selectedOption: {
    type: Number,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  answer: {
    type: String,
    required: false,
  },
});

// Score Schema for storing user scores
const scoreSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "User",
  },
  score: {
    type: Number,
    required: false,
  },
  totalQuestions: {
    type: Number,
    required: false,
  },
  answers: [answerSchema], // Array of user answers
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


//technicalQuestionsSchema 
const technicalQuestionsSchema = new mongoose.Schema({
  technicalQuestion: {
    type: String,
    required: false,
  },
  technicalQuestion_ar: {
    type: String,
    required: false,
  },
  correctAnswer: {
    type: String,
    required: false,
  },
});

//technicalAnswerSchema
const technicalAnswerSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Assignment", // Reference to the Assignment model
  },
  questionIndex: {
    type: Number,
    required: false,
  },
  isCorrect: {
    type: Boolean,
    required: false,
  },
  technicalAnswer: {
    type: String,
    required: false,
  },
  language: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


// technicalScoresSchema
const technicalScoresSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "User",
  },
  technicalScore: {
    type: Number,
    required: false,
  },
  totalQuestions: {
    type: Number,
    required: false,
  },
  technicalAnswers: [technicalAnswerSchema], // Array of user answers
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// assignment Schema
const assignmentSchema = mongoose.Schema(
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
    questions: [questionSchema],
    technicalQuestions : [technicalQuestionsSchema],
    scores: [scoreSchema], // Array of user scores
    technicalScores: [technicalScoresSchema], // Array of user scores
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

const Assignment = mongoose.model("Assignment", assignmentSchema);
module.exports = Assignment;

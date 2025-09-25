const dotenv = require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const userRoute = require("./routes/userRoute");
const projectRoute = require("./routes/projectRoute");
const videoRoute = require("./routes/videoRoute");
const contactRoute = require("./routes/contactRoute");
const blogRoute = require("./routes/blogRoute");
const certificateRoute = require("./routes/certificateRoute");
const taskRoute = require("./routes/taskRoute");
const assignmentRoute = require("./routes/assignmentRoute");
// const chatRoute = require("./routes/chatRoute");
const errorHandler = require("./middleWare/errorMiddleware");
const cors = require('cors');
const cookieParser = require("cookie-parser");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const passport = require('passport');
const session = require('express-session');


const app = express();
const PORT = process.env.PORT || 8081;


const allowedOrigins = ["http://localhost:3000", "https://alsaaeid-ellithy.vercel.app"];

// Middlewares
app.use(cookieParser());
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

app.use(express.json()); // This makes sure Express can parse JSON bodies
// Routes Middleware
app.use("/api/users", userRoute);
app.use("/api/projects", projectRoute);
app.use("/api/contactus", contactRoute);
app.use("/api/videos", videoRoute);
app.use("/api/blogs", blogRoute);
app.use("/api/certificates", certificateRoute);
app.use("/api/tasks", taskRoute);
app.use("/api/assignments", assignmentRoute);
// app.use("/api/chats", chatRoute);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



cloudinary.config({
  cloud_name : process.env.CLOUD_NAME,//process.env.CLOUDINARY_NAME
  api_key    : process.env.CLOUD_API_KEY,//process.env.CLOUDINARY_API_KEY
  api_secret : process.env.CLOUD_API_SECRET,//process.env.CLOUDINARY_API_SECRET
});



// Routes
app.get("*", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type'); // If needed
  res.setHeader('Access-Control-Allow-Credentials', true); // If needed
  res.send("Home Page");
});

// Error Middleware
app.use(errorHandler);
mongoose.set('strictQuery', true);
// Connect to MongoDB with connection pooling options
mongoose.connect(process.env.DATABASE, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  minPoolSize: 2,  // Minimum number of connections in the pool
  maxPoolSize: 10  // Maximum number of connections in the pool
})
.then(() => {
  app.listen(PORT, () => {
    console.log(`Server Running on port ${PORT}`);
  });
})
.catch((err) => console.log('Database connection error:', err));
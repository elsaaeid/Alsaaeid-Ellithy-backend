const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
  createTask,
  getTasks,
  getTask,
  deleteTask,
  updateTask,
} = require("../controllers/taskController");
const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.fields([{ name: "image" }]), createTask);
router.patch("/:id", protect, upload.fields([{ name: "image" }]), updateTask);
router.get("/", getTasks);
router.get("/:id", getTask);
router.delete("/:id", protect, deleteTask);

module.exports = router;

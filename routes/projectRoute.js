const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
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
} = require("../controllers/projectController");
const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.fields([{ name: "images", maxCount: 10 }, { name: "image" }, { name: "video" }]), createProject);
router.patch("/:id", protect, upload.fields([{ name: "images", maxCount: 10 }, { name: "image" }, { name: "video" }]), updateProject);
router.get("/", getProjects);
router.get("/related/:category/:projectId", getRelatedProjects);
router.get("/:id", getProject);
router.delete("/:id", protect, deleteProject);
router.post('/:itemId/like', protect, likeItem);
router.post('/:itemId/unlike', protect, unlikeItem);
router.post('/:itemId', protect, commentItem);
router.post('/:itemId/comments/:commentId', protect, replyItem);
// Route to edit a specific comment
router.put('/comments/:commentId', protect, editComment);
// Route to delete a specific comment
router.delete('/comments/:commentId', protect, deleteComment);

module.exports = router;

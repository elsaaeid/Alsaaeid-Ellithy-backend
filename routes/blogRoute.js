const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
  createBlog,
  getBlogs,
  getBlog,
  deleteBlog,
  updateBlog,
  likeItem,
  unlikeItem,
  commentItem,
  replyItem,
  editComment,
  deleteComment,
  getRelatedBlogs,
} = require("../controllers/blogController");


const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.fields([{ name: 'image' }, { name: 'blogItemImages' }]), createBlog);
router.patch("/:id", protect, upload.fields([{ name: 'image' }, { name: 'blogItemImages' }]), updateBlog);
router.delete("/:id", protect, deleteBlog);
router.get("/", getBlogs);
router.get("/related/:category/:blogId", getRelatedBlogs);
router.get("/:id", getBlog);
router.post('/:itemId/like', protect, likeItem);
router.post('/:itemId/unlike', protect, unlikeItem);
router.post('/:itemId', protect, commentItem);
router.post('/:itemId/comments/:commentId', protect, replyItem);
// Route to edit a specific comment
router.put('/comments/:commentId', protect, editComment);
// Route to delete a specific comment
router.delete('/comments/:commentId', protect, deleteComment);

module.exports = router;

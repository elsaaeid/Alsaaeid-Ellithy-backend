const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
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
} = require("../controllers/videoController");
const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.single("videoUrl"), createVideo);
router.patch("/:id", protect, upload.single("videoUrl"), updateVideo);
router.get("/", getVideos);
router.get("/related/:category/:videoId", getRelatedVideos);
router.get("/:id", getVideo);
router.delete("/:id", protect, deleteVideo);
router.post('/:itemId/like', protect, likeItem);
router.post('/:itemId/unlike', protect, unlikeItem);
router.post('/:itemId', protect, commentItem);
router.post('/:itemId/comments/:commentId', protect, replyItem);
// Route to edit a specific comment
router.put('/comments/:commentId', protect, editComment);
// Route to delete a specific comment
router.delete('/comments/:commentId', protect, deleteComment);

module.exports = router;

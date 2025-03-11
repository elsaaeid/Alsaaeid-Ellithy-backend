const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
  createProduct,
  getProducts,
  getRelatedProducts,
  getProduct,
  deleteProduct,
  updateProduct,
  likeItem,
  unlikeItem,
  commentItem,
  replyItem,
  editComment,
  deleteComment,
} = require("../controllers/productController");
const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.fields([{ name: "image" }, { name: "video" }]), createProduct);
router.patch("/:id", protect, upload.fields([{ name: "image" }, { name: "video" }]), updateProduct);
router.get("/", getProducts);
router.get("/related/:category/:productId", getRelatedProducts);
router.get("/:id", getProduct);
router.delete("/:id", protect, deleteProduct);
router.post('/:itemId/like', protect, likeItem);
router.post('/:itemId/unlike', protect, unlikeItem);
router.post('/:itemId', protect, commentItem);
router.post('/:itemId/comments/:commentId', protect, replyItem);
// Route to edit a specific comment
router.put('/comments/:commentId', protect, editComment);
// Route to delete a specific comment
router.delete('/comments/:commentId', protect, deleteComment);

module.exports = router;

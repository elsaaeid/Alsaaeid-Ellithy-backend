const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
  createAssignment,
  getAssignments,
  getAssignment,
  getRelatedAssignments,
  deleteAssignment,
  updateAssignment,
  sendAssignment,
  sendTechnicalAssignment,
} = require("../controllers/assignmentController");
const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.fields([{ name: "image" }]), createAssignment);
router.patch("/:id", protect, upload.fields([{ name: "image" }]), updateAssignment);
router.get("/", getAssignments);
router.get("/related/:category/:assignmentId", getRelatedAssignments);
router.get("/:id", getAssignment);
router.delete("/:id", protect, deleteAssignment);
router.post("/:assignmentId", sendAssignment);
router.post("/:assignmentId/code", sendTechnicalAssignment);


module.exports = router;

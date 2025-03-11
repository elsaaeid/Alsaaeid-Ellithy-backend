const express = require("express");
const router = express.Router();

const {
  protect
} = require("./authMiddleware");
const {
  createCertificate,
  getCertificates,
  getCertificate,
  deleteCertificate,
  updateCertificate,
} = require("../controllers/certificateController");


const { upload } = require("../utils/fileUpload");

router.post("/", protect, upload.single("image"), createCertificate);
router.patch("/:id", protect, upload.single("image"), updateCertificate);
router.delete("/:id", protect, deleteCertificate);
router.get("/", getCertificates);
router.get("/:id", getCertificate);

module.exports = router;

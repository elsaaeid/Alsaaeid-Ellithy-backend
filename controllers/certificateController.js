const asyncHandler = require("express-async-handler");
const Certificate = require("../models/certificateModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;




// Create Certificate
const createCertificate = asyncHandler(async (req, res) => {
  const { name, sku } = req.body;

  // Handle Image upload
  let fileData = {};
  if (req.file) {
    // Save image to cloudinary
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: "Portfolio React",
        resource_type: "image",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }

    fileData = {
      fileName: req.file.originalname,
      filePath: uploadedFile.secure_url,
      fileType: req.file.mimetype,
      fileSize: fileSizeFormatter(req.file.size, 2),
    };
  }

  // Create Certificate
  const certificate = await Certificate.create({
    user: req.user.id,
    name,
    sku,
    image: fileData,
  });

  res.status(201).json(certificate);
});

// Get all certificates
const getCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find();
    res.json(certificates);
  } catch (error) {
    console.error('Error retrieving certificates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get single Certificate
const getCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);
  // if Certificate doesnt exist
  if (!certificate) {
    res.status(404);
    throw new Error("Certificate not found");
  }
  res.status(200).json(certificate);
});

// Delete Certificate
const deleteCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);
  // if certificate doesnt exist
  if (!certificate) {
    res.status(404);
    throw new Error("Certificate not found");
  }
  // Match Certificate to its user
  if (certificate.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await certificate.remove();
  res.status(200).json({ message: "Certificate deleted." });
});

// Update certificate
const updateCertificate = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  const certificate = await Certificate.findById(id);

  // if certificate doesnt exist
  if (!certificate) {
    res.status(404);
    throw new Error("Certificate not found");
  }
  // Match certificate to its user
  if (certificate.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Handle Image upload
  let fileData = {};
  if (req.file) {
    // Save image to cloudinary
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: "Portfolio React",
        resource_type: "image",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }

    fileData = {
      fileName: req.file.originalname,
      filePath: uploadedFile.secure_url,
      fileType: req.file.mimetype,
      fileSize: fileSizeFormatter(req.file.size, 2),
    };
  }

  // Update certificate
  const updatedCertificate = await Certificate.findByIdAndUpdate(
    { _id: id },
    {
      name,
      image: Object.keys(fileData).length === 0 ? certificate?.image : fileData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json(updatedCertificate);
});

module.exports = {
  createCertificate,
  getCertificates,
  getCertificate,
  deleteCertificate,
  updateCertificate,
};

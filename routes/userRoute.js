const express = require("express");
const router = express.Router();
const {
  protect,
  adminOnly,
  authorOnly,
} = require("./authMiddleware");
const {
  registerUser,
  loginUser,
  logoutUser,
  getUser,
  updateUser,
  deleteUser,
  getUsers,
  loginStatus,
  upgradeUser,
  sendAutomatedEmail,
  sendVerificationEmail,
  verifyUser,
  forgotPassword,
  resetPassword,
  changePassword,
  sendLoginCode,
  loginWithCode,
  loginWithGoogle,
  loginWithFacebook,
  loginWithGithub,
  loginWithLinkedIn,
  setCookie,
  getCookie,
  removeCookie,
} = require("../controllers/userController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", logoutUser);
router.get("/getUser", protect, getUser);
router.patch("/updateUser", protect, updateUser);

router.delete("/:id", protect, adminOnly, deleteUser);
router.get("/getUsers", protect, authorOnly, getUsers);
router.get("/loginStatus", loginStatus);
router.post("/upgradeUser", protect, adminOnly, upgradeUser);
router.post("/sendAutomatedEmail", protect, sendAutomatedEmail);

router.post("/sendVerificationEmail", protect, sendVerificationEmail);
router.patch("/verifyUser/:verificationToken", verifyUser);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:resetToken", resetPassword);
router.patch("/changePassword", protect, changePassword);

router.post("/sendLoginCode/:email", sendLoginCode);
router.post("/loginWithCode/:email", loginWithCode);

router.post("/google/callback", loginWithGoogle);
router.post("/facebook/callback", loginWithFacebook);
// Route for GitHub login
router.post("/github/callback", loginWithGithub);
// Route for LinkedIn login
router.post("/linkedin/callback", loginWithLinkedIn);
router.post("/set-cookie", setCookie);
router.get("/get-cookie", getCookie);
router.post("/remove-cookie", removeCookie);


module.exports = router;

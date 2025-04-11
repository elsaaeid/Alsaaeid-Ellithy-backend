const express = require("express");
const { addChat } = require("../controllers/chatController");

const router = express.Router();


router.post("/", addChat);

module.exports = router;

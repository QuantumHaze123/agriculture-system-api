const express = require("express");
const Message = require("../models/Message");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { checkAuth } = require("../middleware/checkAuth");

// Fetch conversation between two users
router.get("/conversations", checkAuth, messageController.getUserConversations);
router.post("/send", checkAuth, messageController.sendMessage);
router.get("/usersLists", checkAuth, messageController.getUserToMessage);
router.get("/:user2", checkAuth, messageController.getConversationMessages);

module.exports = router;

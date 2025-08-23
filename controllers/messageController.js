const { Db } = require("mongodb");
const DB = require("../models");
const Message = require("../models/Message");
const { connectedUsers } = require("../socket/chatSocket");

exports.getConversationMessages = async (req, res) => {
  const { id_number } = req.user;
  const user = await DB.user.findOne({ id_number });
  const user1 = String(user._id);
  const { user2 } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const user2Details = await DB.user.findOne({ _id: user2 });
  const fullname = user2Details.firstname + " " + user2Details.lastname;

  try {
    const query = {
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    };

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments(query);

    res.status(200).json({
      success: "Ok",
      chatWith: fullname,
      messages: messages,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.log("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

exports.getUserConversations = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { id_number } = req.user;

  const user = await DB.user.findOne({ id_number });

  try {
    const userId = String(user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).sort({ timestamp: -1 });

    const conversations = {};
    messages.forEach((msg) => {
      const otherUser = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversations[otherUser]) {
        conversations[otherUser] = [];
      }
      if (
        conversations[otherUser].length === 0 ||
        msg.timestamp > conversations[otherUser][0].timestamp
      ) {
        conversations[otherUser][0] = msg;
      }
    });

    const allPartnerIds = Object.keys(conversations);
    const total = allPartnerIds.length;
    const paginatedPartnerIds = allPartnerIds.slice(skip, skip + limit);

    // Fetch partner info for each conversation
    const conversationList = await Promise.all(
      paginatedPartnerIds.map(async (partnerId) => {
        const partner = await DB.user
          .findOne({ _id: partnerId })
          .select("firstname lastname");
        return {
          otherUser: {
            id: partnerId,
            firstname: partner?.firstname || "",
            lastname: partner?.lastname || "",
          },
          messages: conversations[partnerId].sort(
            (a, b) => b.timestamp - a.timestamp
          ),
        };
      })
    );

    res.status(200).json({
      success: "Ok",
      conversations: conversationList,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

exports.sendMessage = async (req, res) => {
  const { id_number } = req.user;
  const receiverId = req.body.receiverId;
  const content = req.body.content;
  const user = await DB.user.findOne({ id_number });
  const io = req.app.get("io");

  try {
    const message = new Message({
      senderId: String(user?._id),
      receiverId,
      content,
    });
    await message.save();

    const receiverSocketId = connectedUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("refreshConversation", { refresh: true });
      console.log(`Notified ${receiverId} to refresh`);
    }

    res.status(200).json({
      success: "Ok",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

// for new message
exports.getUserToMessage = async (req, res) => {
  const { id_number } = req.user;
  const user = await DB.user.findOne({ id_number });
  const search = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const userId = String(user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build search query for users
    const searchQuery = {
      _id: { $ne: user._id },
    };
    if (search && search.trim() !== "") {
      searchQuery.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
      ];
    }

    const allUsers = await DB.user
      .find(searchQuery)
      .select("firstname lastname _id");
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).select("senderId receiverId");

    const conversedUserIds = new Set();
    messages.forEach((msg) => {
      if (msg.senderId.toString() !== userId)
        conversedUserIds.add(msg.senderId.toString());
      if (msg.receiverId.toString() !== userId)
        conversedUserIds.add(msg.receiverId.toString());
    });

    const usersWithoutConversation = allUsers.filter(
      (u) => !conversedUserIds.has(u._id.toString())
    );

    const total = usersWithoutConversation.length;
    const paginatedUsers = usersWithoutConversation.slice(skip, skip + limit);

    res.status(200).json({
      success: "Ok",
      users: paginatedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

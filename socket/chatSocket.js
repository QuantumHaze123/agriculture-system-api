const jwt = require("jsonwebtoken");
const admin = require("../firebase");
const DB = require("../models");
const connectedUsers = new Map();

function chatSocket(io) {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("register", async (token) => {
      try {
        // Decode and verify token
        const decodedHeader = jwt.decode(token, { complete: true })?.header;
        let id_number;
        if (decodedHeader?.kid && decodedHeader?.alg === "RS256") {
          const decodedToken = await admin.auth().verifyIdToken(token);
          id_number = decodedToken.id_number || decodedToken.uid;
        } else {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
          id_number = decoded.id_number || decoded._id;
        }

        // Find user in DB and register with _id
        const user = await DB.user.findOne({ id_number });
        if (user && user._id) {
          connectedUsers.set(String(user._id), socket.id);
          console.log(`Registered user ${user._id} with socket ${socket.id}`);
        } else {
          console.log("User not found for registration");
          socket.disconnect();
        }
      } catch (err) {
        console.log("Socket auth failed:", err.message);
        socket.disconnect();
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
    });
  });
}

module.exports = { chatSocket, connectedUsers };

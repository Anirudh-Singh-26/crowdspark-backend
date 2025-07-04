const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["info", "warning", "success", "error"],
    default: "info",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);

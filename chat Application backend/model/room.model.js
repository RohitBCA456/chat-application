import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  roomId: {
    type: String,
    required: true,
  },
});

export const Room = mongoose.model("Room", roomSchema);

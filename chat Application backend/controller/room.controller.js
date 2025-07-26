import { Room } from "../model/room.model.js";
import { User } from "../model/user.model.js";
import { Message } from "../model/message.model.js";

const deleteRoom = async (req, res) => {
  try {
    const userId = req.user?._id;
    console.log(userId);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    const user = await User.findById(userId);
    console.log(user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const room = await Room.findOne({ username: user.username });
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    // Delete all messages for this room
    await Message.deleteMany({ roomId: room.roomId });

    // Delete the room
    await Room.deleteOne({ _id: room._id });

    return res
      .status(200)
      .json({ message: "Room and messages deleted successfully." });
  } catch (error) {
    console.error("❌ Error deleting room:", error.message);
    return res.status(500).json({ message: "Error while deleting the room." });
  }
};

//get all rooms
const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find(); // Fetch all rooms from the database
    return res.status(200).json(rooms);
  } catch (error) {
    return res.status(500).json({ message: "Error while fetching rooms." });
  }
};

export { deleteRoom, getAllRooms };

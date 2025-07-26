import { Message } from "../model/message.model.js";

//fetch message history
export const fetchMessageHistory = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required." });
    }

    const messages = await Message.find({ roomId }).sort({ timestamp: 1 }); 
    console.log(messages)

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching message history:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export { editMessage, deleteMessage };

import { Message } from "../model/message.model.js";
const editMessage = async (req, res) => {
  try {
    const { id, newText } = req.body; // Get the ID and new text from the request body

    // Find the message by its ID, not by content
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Update the message content
    message.content = newText;

    // Save the updated message
    await message.save({ validateBeforeSave: false });

    return res.status(200).json({ message: "Message edited." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error while editing the message." });
  }
}

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.body; // Get the ID from the request body

    // Find the message by ID and delete it
    const message = await Message.findByIdAndDelete(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    return res.status(200).json({ message: "Message deleted." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error while deleting the message." });
  }
};

export { editMessage, deleteMessage };

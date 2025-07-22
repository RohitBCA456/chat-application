import { User } from "../model/user.model.js";
import { Room } from "../model/room.model.js";

const registerUser = async (req, res) => {
  try {
    const { username } = req.body;
    if ([username].some((fields) => fields.trim() === "")) {
      return res.status(404).json({ messge: "Missing credentials" });
    }
    const user = await User.findOne({ username: username });
    if (user) {
      return res
        .status(404)
        .json({ message: "user already exists with this username" });
    }
    const user_data = new User({
      username: username,
    });

    // const token = await user_data.generateToken(user_data._id);
    // user_data.token = token;
    user_data.save({ validateBeforeSave: false });
    // const options = {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "None",
    //   path: "/",
    // };
    return res
      .status(200)
      .json({ message: "user enter thr app in successfully.", user_data });
  } catch (error) {
    console.log("Error occured while registering user.", error);
    return res.status(500).json({ message: "user registration failed." });
  }
};

const login = async (req, res) => {
  const { username } = req.body;

  console.log(username);

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).json({
      message: "please enter the username.",
    });
  }

  user.token = await user.generateToken();
  await user.save({ validateBeforeSave: false });

  const token = user.token;

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  };

  return res.status(200).cookie("token", token, options).json({
    message: "User logged In successfully.",
  });
};


const createRoom = async (req, res) => {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "Missing user." });
    }

    const existingRoom = await Room.findOne({ creator: user._id });
    if (existingRoom) {
      return res
        .status(400)
        .json({ message: "This username has already created a room." });
    }

    const roomId = Math.floor(100000 + Math.random() * 900000);
    const room = new Room({
      roomId: roomId,
      creator: user._id,
      username: user.username,
    });
    await room.save();

    return res
      .status(201)
      .json({ message: "Room created", roomId, user: user.username });
  } catch (error) {
    console.error("Error in createRoom:", error);
    return res.status(500).json({ message: "Failed to create room." });
  }
};

const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: "Missing credentials" });
    }
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const userId = req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found for join room." });
    }

    const isOwner = String(room.creator) === String(userId); // compare IDs as strings
    return res
      .status(200)
      .json({ message: "Joined room", roomId, user: user.username, isOwner });
  } catch (error) {
    console.error("Error in joinRoom:", error);
    return res.status(500).json({ message: "Failed to join room." });
  }
};

export { registerUser, createRoom, joinRoom, login };

import { User } from "../model/user.model.js";
import JWT from "jsonwebtoken";
const authMiddleware = (async (req, res, next) => {
  const token =
    req.cookies.token || req.header("Authorization").replace("Bearer", "");
  if (!token) {
    return res.status(404).json({ message: "Token not found." });
  }
  const decodedToken = JWT.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decodedToken._id).select("-password");
  if (!user) {
    return res
      .status(404)
      .json({ message: "User not found with the particular token." });
  }
  req.user = user;
  next();
});

export { authMiddleware };

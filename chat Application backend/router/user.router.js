import { Router } from "express";
import {
  createRoom,
  joinRoom,
  login,
  registerUser,
} from "../controller/user.controller.js";
import { authMiddleware } from "../middleware/Auth.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/createroom").get(authMiddleware, createRoom);
router.route("/joinroom").post(authMiddleware, joinRoom);
router.route("/login").post(login);

export default router;

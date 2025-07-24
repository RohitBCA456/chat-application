import { Router } from "express";
import {
  createRoom,
  joinRoom,
  login,
  registerUser,
} from "../controller/user.controller.js";
import { authMiddleware } from "../middleware/Auth.js";

const router = Router();

router.route("/register").post(registerUser); // redirect to registerUser backend controller to register the user
router.route("/createroom").get(authMiddleware, createRoom); // redirect to createRoom backend controller and before that authenticate the user
router.route("/joinroom").post(authMiddleware, joinRoom); // redirect t joinRoom backend controller and before that authenticate the user
router.route("/login").post(login); // redirect to login backend controller 

// export the default router
export default router;

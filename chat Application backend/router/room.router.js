import Router from "express";
import {
  deleteRoom,
  getAllRooms,
  leaveRoom,
} from "../controller/room.controller.js";
import { authMiddleware } from "../middleware/Auth.js";

const router = Router();

router.route("/deleteroom").get(authMiddleware, deleteRoom);
router.route("/getallroom").get(getAllRooms);
router.route("/leaveroom").post(leaveRoom);

export default router;

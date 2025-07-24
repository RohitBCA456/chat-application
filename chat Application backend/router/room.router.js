import Router from "express";
import {
  deleteRoom,
  getAllRooms,
  leaveRoom,
} from "../controller/room.controller.js";
import { authMiddleware } from "../middleware/Auth.js";

const router = Router();

router.route("/deleteroom").get(authMiddleware, deleteRoom); // redirect to backend controller deleteRoom and before that authenticate the user
router.route("/getallroom").get(getAllRooms); // redirect to getAllRooms backend controller to fetch all the rooms 
router.route("/leaveroom").post(leaveRoom); // redirect to leaveRoom backend controller to leave the room

//export the default router
export default router;

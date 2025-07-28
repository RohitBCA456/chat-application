import Router from "express";
import {
  deleteRoom,
  getAllRooms,
} from "../controller/room.controller.js";
import { authMiddleware } from "../middleware/Auth.js";

const router = Router();

router.route("/deleteroom/:roomId").delete(authMiddleware, deleteRoom); // redirect to backend controller deleteRoom and before that authenticate the user
router.route("/getallroom").get(getAllRooms); // redirect to getAllRooms backend controller to fetch all the rooms 

//export the default router
export default router;

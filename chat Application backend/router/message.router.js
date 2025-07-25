import Router from "express";
import {
  deleteMessage,
  editMessage,
  fetchMessageHistory
} from "../controller/message.controller.js";

const router = Router();

router.route("/edit").post(editMessage); // redirect to editMessage backend controller function
router.route("/delete").post(deleteMessage); // redirect to deleteMessage backend controller function
router.get("/messages/:roomId", fetchMessageHistory); // redirect to fetchMessageHistory backend controller function


export default router; // export the default router

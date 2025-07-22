import Router from "express";
import {
  deleteMessage,
  editMessage,
} from "../controller/message.controller.js";

const router = Router();

router.route("/edit").post(editMessage);
router.route("/delete").post(deleteMessage);

export default router;

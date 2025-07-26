import Router from "express";
import { fetchMessageHistory } from "../controller/message.controller.js";

const router = Router();

router.get("/messages/:roomId", fetchMessageHistory); // redirect to fetchMessageHistory backend controller function

export default router; // export the default router

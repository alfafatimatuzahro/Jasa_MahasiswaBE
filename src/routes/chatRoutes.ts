import { Router } from "express";
import {
    getConversations,
    getMessages,
    sendMessage
} from "../controllers/chatController";

const router = Router();

router.get("/conversations/:userId", getConversations);
router.get("/messages/:userId/:counterpartId", getMessages);
router.post("/messages", sendMessage);

export default router;

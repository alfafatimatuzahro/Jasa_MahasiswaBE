import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { ChatModel } from "../models/chatModel";

export const getConversations = async (req: Request, res: Response) => {
    try {
        const userId = Array.isArray(req.params.userId)
            ? req.params.userId[0]
            : req.params.userId;
        const list = await ChatModel.getConversations(userId);
        res.status(200).json({
            message: "Berhasil mengambil daftar percakapan",
            data: list
        });
    } catch (error) {
        console.error("Error getConversations:", error);
        res.status(500).json({ message: "Gagal mengambil daftar percakapan" });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        const userId = Array.isArray(req.params.userId)
            ? req.params.userId[0]
            : req.params.userId;
        const counterpartId = Array.isArray(req.params.counterpartId)
            ? req.params.counterpartId[0]
            : req.params.counterpartId;

        const messages = await ChatModel.getMessagesBetween(userId, counterpartId);
        res.status(200).json({
            message: "Berhasil mengambil riwayat pesan",
            data: messages
        });
    } catch (error) {
        console.error("Error getMessages:", error);
        res.status(500).json({ message: "Gagal mengambil riwayat pesan" });
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const {
            order_id,
            sender_id,
            receiver_id,
            message,
            file_base64,
            file_name,
            file_size
        } = req.body;

        if (!sender_id || !receiver_id) {
            res.status(400).json({ message: "sender_id dan receiver_id wajib diisi" });
            return;
        }

        if ((!message || !String(message).trim()) && !file_base64) {
            res.status(400).json({ message: "Pesan atau file wajib diisi" });
            return;
        }

        let savedFileUrl: string | null = null;
        if (file_base64 && typeof file_base64 === "string") {
            const matches = file_base64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const rawExt = file_name
                    ? path.extname(String(file_name)).replace(".", "").toLowerCase()
                    : "";
                const ext = rawExt || "bin";
                const uploadDir = path.join(process.cwd(), "uploads");
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const uniqueName = `chat-${Date.now()}.${ext}`;
                fs.writeFileSync(
                    path.join(uploadDir, uniqueName),
                    Buffer.from(matches[2], "base64")
                );
                savedFileUrl = `/uploads/${uniqueName}`;
            }
        }

        const created = await ChatModel.sendMessage({
            order_id: order_id ? Number(order_id) : null,
            sender_id: Number(sender_id),
            receiver_id: Number(receiver_id),
            message: String(message || "").trim(),
            file_url: savedFileUrl,
            file_name: file_name ? String(file_name) : null,
            file_size: file_size ? String(file_size) : null
        });

        res.status(201).json({
            message: "Pesan terkirim",
            data: created
        });
    } catch (error) {
        console.error("Error sendMessage:", error);
        res.status(500).json({ message: "Gagal mengirim pesan" });
    }
};

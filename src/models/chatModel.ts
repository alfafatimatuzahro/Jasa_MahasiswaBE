import pool from "../config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const ChatModel = {
    getConversations: async (userId: string, role?: string) => {
        const isSeller = role === "penjual" || role === "seller";
        const orderRoleFilter = isSeller ? "o.seller_id = ?" : "o.buyer_id = ?";
        const orderCounterpartJoin = isSeller ? "u.id = o.buyer_id" : "u.id = o.seller_id";

        const query = `
            SELECT 
                u.id AS counterpart_id,
                u.nama AS counterpart_name,
                u.jurusan AS counterpart_department,
                (
                    SELECT o.id FROM orders o
                    WHERE (o.buyer_id = ? AND o.seller_id = u.id)
                       OR (o.seller_id = ? AND o.buyer_id = u.id)
                    ORDER BY o.created_at DESC LIMIT 1
                ) AS latest_order_id,
                (
                    SELECT o.order_code FROM orders o
                    WHERE (o.buyer_id = ? AND o.seller_id = u.id)
                       OR (o.seller_id = ? AND o.buyer_id = u.id)
                    ORDER BY o.created_at DESC LIMIT 1
                ) AS latest_order_code,
                (
                    SELECT s.judul FROM orders o
                    JOIN services s ON o.service_id = s.id
                    WHERE (o.buyer_id = ? AND o.seller_id = u.id)
                       OR (o.seller_id = ? AND o.buyer_id = u.id)
                    ORDER BY o.created_at DESC LIMIT 1
                ) AS latest_service_title,
                (
                    SELECT o.total_harga FROM orders o
                    WHERE (o.buyer_id = ? AND o.seller_id = u.id)
                       OR (o.seller_id = ? AND o.buyer_id = u.id)
                    ORDER BY o.created_at DESC LIMIT 1
                ) AS latest_order_total,
                (
                    SELECT o.status FROM orders o
                    WHERE (o.buyer_id = ? AND o.seller_id = u.id)
                       OR (o.seller_id = ? AND o.buyer_id = u.id)
                    ORDER BY o.created_at DESC LIMIT 1
                ) AS latest_order_status,
                (
                    SELECT IF(m.file_name IS NOT NULL AND m.file_name != '', CONCAT('[File] ', m.file_name), m.message)
                    FROM chat_messages m
                    WHERE (m.sender_id = ? AND m.receiver_id = u.id)
                       OR (m.sender_id = u.id AND m.receiver_id = ?)
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT m.created_at
                    FROM chat_messages m
                    WHERE (m.sender_id = ? AND m.receiver_id = u.id)
                       OR (m.sender_id = u.id AND m.receiver_id = ?)
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1
                ) AS last_message_at,
                (
                    SELECT COUNT(*)
                    FROM chat_messages m
                    WHERE m.sender_id = u.id AND m.receiver_id = ? AND m.is_read = 0
                ) AS unread_count
            FROM users u
            WHERE u.id IN (
                SELECT DISTINCT ${isSeller ? "o.buyer_id" : "o.seller_id"}
                FROM orders o
                WHERE ${orderRoleFilter}
                UNION
                SELECT DISTINCT m.receiver_id FROM chat_messages m WHERE m.sender_id = ?
                UNION
                SELECT DISTINCT m.sender_id FROM chat_messages m WHERE m.receiver_id = ?
            )
            ORDER BY COALESCE(last_message_at, NOW()) DESC
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [
            userId, userId,
            userId, userId,
            userId, userId,
            userId, userId,
            userId, userId,
            userId, userId,
            userId, userId,
            userId,
            userId,
            userId, userId
        ]);
        return rows;
    },

    getMessagesBetween: async (userId: string, counterpartId: string) => {
        await pool.query(
            "UPDATE chat_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
            [counterpartId, userId]
        );

        const query = `
            SELECT 
                m.*,
                u.nama AS sender_name
            FROM chat_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC, m.id ASC
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [
            userId,
            counterpartId,
            counterpartId,
            userId
        ]);
        return rows;
    },

    sendMessage: async (data: {
        order_id?: number | null;
        sender_id: number;
        receiver_id: number;
        message?: string;
        file_url?: string | null;
        file_name?: string | null;
        file_size?: string | null;
    }) => {
        const query = `
            INSERT INTO chat_messages 
            (order_id, sender_id, receiver_id, message, file_url, file_name, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query<ResultSetHeader>(query, [
            data.order_id || null,
            data.sender_id,
            data.receiver_id,
            data.message || "",
            data.file_url || null,
            data.file_name || null,
            data.file_size || null
        ]);

        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT m.*, u.nama AS sender_name FROM chat_messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?",
            [result.insertId]
        );
        return rows[0];
    }
};

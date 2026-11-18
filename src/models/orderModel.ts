import pool from "../config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface CreateOrderInput {
    service_id: number;
    buyer_id: number;
    catatan?: string;
    total_harga: number;
    metode_pembayaran?: string;
}

export const OrderModel = {
    createOrder: async (data: CreateOrderInput) => {
        const [serviceRows] = await pool.query<RowDataPacket[]>(
            "SELECT seller_id, harga FROM services WHERE id = ?",
            [data.service_id]
        );

        if (serviceRows.length === 0) {
            throw new Error("Jasa tidak ditemukan");
        }

        const sellerId = serviceRows[0].seller_id;
        const orderCode = `ORD-${Date.now()}`;

        const query = `
            INSERT INTO orders 
            (order_code, service_id, buyer_id, seller_id, catatan, total_harga, metode_pembayaran, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu_konfirmasi')
        `;

        const values = [
            orderCode,
            data.service_id,
            data.buyer_id,
            sellerId,
            data.catatan || "",
            data.total_harga,
            data.metode_pembayaran || "QRIS / Transfer"
        ];

        const [result] = await pool.query<ResultSetHeader>(query, values);
        return {
            id: result.insertId,
            order_code: orderCode,
            seller_id: sellerId
        };
    },

    getOrdersByBuyer: async (buyerId: string) => {
        const query = `
            SELECT 
                o.*,
                s.judul AS judul_jasa,
                s.nama_paket,
                s.waktu_pengerjaan,
                s.banner_url,
                u.nama AS nama_penjual
            FROM orders o
            JOIN services s ON o.service_id = s.id
            JOIN users u ON o.seller_id = u.id
            WHERE o.buyer_id = ?
            ORDER BY o.created_at DESC
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [buyerId]);
        return rows;
    },

    getOrdersBySeller: async (sellerId: string) => {
        const query = `
            SELECT 
                o.*,
                s.judul AS judul_jasa,
                s.nama_paket,
                s.waktu_pengerjaan,
                u.nama AS nama_pembeli,
                u.jurusan AS jurusan_pembeli
            FROM orders o
            JOIN services s ON o.service_id = s.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.seller_id = ?
            ORDER BY o.created_at DESC
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [sellerId]);
        return rows;
    },

    updateOrderStatus: async (orderId: string, status: string) => {
        const query = "UPDATE orders SET status = ? WHERE id = ?";
        const [result] = await pool.query<ResultSetHeader>(query, [status, orderId]);
        return result.affectedRows > 0;
    },

    deliverOrder: async (
        orderId: string,
        resultNote: string,
        resultFileUrl: string | null
    ) => {
        const query = `
            UPDATE orders 
            SET status = 'menunggu_review', 
                result_note = ?, 
                result_file_url = COALESCE(?, result_file_url)
            WHERE id = ?
        `;
        const [result] = await pool.query<ResultSetHeader>(query, [
            resultNote,
            resultFileUrl,
            orderId
        ]);
        return result.affectedRows > 0;
    }
};

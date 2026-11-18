import pool from "../config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const ReviewModel = {
    createReview: async (data: {
        order_id: number;
        service_id: number;
        buyer_id: number;
        seller_id: number;
        rating: number;
        comment?: string;
    }) => {
        const [existing] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM reviews WHERE order_id = ?",
            [data.order_id]
        );
        if (existing.length > 0) {
            throw new Error("Pesanan ini sudah pernah diberi ulasan.");
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO reviews (order_id, service_id, buyer_id, seller_id, rating, comment)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                data.order_id,
                data.service_id,
                data.buyer_id,
                data.seller_id,
                data.rating,
                data.comment || ""
            ]
        );

        // Hitung ulang rata-rata rating dan jumlah ulasan pada tabel services
        const [statsRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                ROUND(AVG(rating), 1) AS avg_rating,
                COUNT(*) AS total_reviews
             FROM reviews
             WHERE service_id = ?`,
            [data.service_id]
        );

        const avgRating = Number(statsRows[0]?.avg_rating || data.rating);
        const totalReviews = Number(statsRows[0]?.total_reviews || 1);

        await pool.query(
            "UPDATE services SET rating = ?, review_count = ? WHERE id = ?",
            [avgRating, totalReviews, data.service_id]
        );

        const [createdRows] = await pool.query<RowDataPacket[]>(
            `SELECT r.*, u.nama AS buyer_name, u.jurusan AS buyer_department
             FROM reviews r
             JOIN users u ON r.buyer_id = u.id
             WHERE r.id = ?`,
            [result.insertId]
        );
        return createdRows[0];
    },

    getByServiceId: async (serviceId: string) => {
        const query = `
            SELECT 
                r.*,
                u.nama AS buyer_name,
                u.jurusan AS buyer_department
            FROM reviews r
            JOIN users u ON r.buyer_id = u.id
            WHERE r.service_id = ?
            ORDER BY r.created_at DESC, r.id DESC
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [serviceId]);
        return rows;
    }
};

import pool from "../config/db";
import type { RowDataPacket } from "mysql2";

export const ServiceModel = {
    // Mengambil semua jasa yang statusnya aktif beserta nama penjualnya
    getAllActiveServices: async () => {
        const query = `
            SELECT 
                s.id, s.judul, s.harga, s.rating, s.review_count, s.banner_url,
                u.nama AS nama_penjual, u.jurusan AS jurusan_penjual
            FROM services s
            JOIN users u ON s.seller_id = u.id
            WHERE s.status = 'aktif'
        `;
        const [services] = await pool.query<RowDataPacket[]>(query);
        return services;
    }
};
import pool from "../config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface CreateServiceInput {
    seller_id: number;
    category_id: number;
    judul: string;
    deskripsi: string;
    harga: number;
    nama_paket: string;
    waktu_pengerjaan: number;
    jumlah_revisi: number;
    banner_url?: string | null;
    status?: string;
}

export interface UpdateServiceInput {
    category_id?: number;
    judul?: string;
    deskripsi?: string;
    harga?: number;
    nama_paket?: string;
    waktu_pengerjaan?: number;
    jumlah_revisi?: number;
    banner_url?: string | null;
    status?: string;
}

export const ServiceModel = {
    getPendingServices: async () => {
        const query = `
            SELECT 
                s.*,
                c.nama AS nama_kategori,
                u.nama AS nama_penjual,
                u.universitas AS universitas_penjual,
                u.jurusan AS jurusan_penjual,
                u.foto_url AS foto_penjual
            FROM services s
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.status = 'ditinjau'
            ORDER BY s.created_at DESC
        `;
        const [services] = await pool.query<RowDataPacket[]>(query);
        return services;
    },

    getModerationSummary: async () => {
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT
                SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) AS total_aktif,
                SUM(CASE WHEN status = 'ditinjau' THEN 1 ELSE 0 END) AS total_ditinjau,
                SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END) AS total_ditolak
            FROM services
        `);
        return rows[0] || { total_aktif: 0, total_ditinjau: 0, total_ditolak: 0 };
    },
    getAllActiveServices: async () => {
        const query = `
            SELECT 
                s.id, s.category_id, s.judul, s.harga, s.rating, s.review_count, s.banner_url,
                c.nama AS nama_kategori,
                u.nama AS nama_penjual, u.jurusan AS jurusan_penjual, u.foto_url AS foto_penjual
            FROM services s
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.status = 'aktif'
            ORDER BY s.created_at DESC
        `;
        const [services] = await pool.query<RowDataPacket[]>(query);
        return services;
    },

    getServicesBySellerId: async (sellerId: number) => {
        const query = `
            SELECT 
                s.*,
                c.nama AS nama_kategori,
                u.nama AS nama_penjual,
                u.jurusan AS jurusan_penjual,
                (SELECT COUNT(*) FROM orders o WHERE o.service_id = s.id AND o.status = 'selesai') AS sales_count
            FROM services s
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.seller_id = ?
            ORDER BY s.created_at DESC
        `;
        const [services] = await pool.query<RowDataPacket[]>(query, [sellerId]);
        return services;
    },

    getServiceById: async (id: string) => {
        const query = `
            SELECT 
                s.*,
                c.nama AS nama_kategori,
                u.nama AS nama_penjual,
                u.jurusan AS jurusan_penjual, u.foto_url AS foto_penjual
            FROM services s
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.id = ?
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [id]);
        return rows[0] || null;
    },

    createService: async (data: CreateServiceInput) => {
        const query = `
            INSERT INTO services 
            (seller_id, category_id, judul, deskripsi, harga, nama_paket, waktu_pengerjaan, jumlah_revisi, banner_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.seller_id,
            data.category_id,
            data.judul,
            data.deskripsi,
            data.harga,
            data.nama_paket,
            data.waktu_pengerjaan,
            data.jumlah_revisi,
            data.banner_url || null,
            data.status || "aktif"
        ];

        const [result] = await pool.query<ResultSetHeader>(query, values);
        return result.insertId;
    },

    updateService: async (id: string, data: UpdateServiceInput) => {
        const existing = await ServiceModel.getServiceById(id);
        if (!existing) return null;

        const categoryId = data.category_id !== undefined ? Number(data.category_id) : Number(existing.category_id || 1);
        const judul = data.judul !== undefined ? data.judul : existing.judul;
        const deskripsi = data.deskripsi !== undefined ? data.deskripsi : existing.deskripsi;
        const harga = data.harga !== undefined ? Number(data.harga) : Number(existing.harga);
        const namaPaket = data.nama_paket !== undefined ? data.nama_paket : existing.nama_paket;
        const waktuPengerjaan = data.waktu_pengerjaan !== undefined ? Number(data.waktu_pengerjaan) : Number(existing.waktu_pengerjaan || 1);
        const jumlahRevisi = data.jumlah_revisi !== undefined ? Number(data.jumlah_revisi) : Number(existing.jumlah_revisi || 1);
        const bannerUrl = data.banner_url !== undefined ? data.banner_url : existing.banner_url;
        const status = data.status !== undefined ? data.status : existing.status;

        await pool.query<ResultSetHeader>(
            `UPDATE services
             SET category_id = ?, judul = ?, deskripsi = ?, harga = ?, nama_paket = ?,
                 waktu_pengerjaan = ?, jumlah_revisi = ?, banner_url = ?, status = ?
             WHERE id = ?`,
            [categoryId, judul, deskripsi, harga, namaPaket, waktuPengerjaan, jumlahRevisi, bannerUrl, status, id]
        );

        return ServiceModel.getServiceById(id);
    },

    updateServiceStatus: async (id: string, status: string) => {
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE services SET status = ? WHERE id = ?",
            [status, id]
        );
        return result.affectedRows > 0;
    },

    deleteService: async (id: string) => {
        try {
            const [result] = await pool.query<ResultSetHeader>(
                "DELETE FROM services WHERE id = ?",
                [id]
            );
            return result.affectedRows > 0;
        } catch (err: any) {
            if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.errno === 1451) {
                throw new Error("HAS_ORDERS");
            }
            throw err;
        }
    }
};
import fs from "fs";
import path from "path";
import pool from "../config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const ensureUserProfileColumns = async () => {
    const requiredColumns: Record<string, string> = {
        no_hp: "VARCHAR(30) NULL",
        universitas: "VARCHAR(150) NULL",
        jurusan: "VARCHAR(150) NULL",
        nim: "VARCHAR(50) NULL",
        ipk: "VARCHAR(20) NULL",
        bio: "TEXT NULL",
        keahlian: "TEXT NULL",
        foto_url: "TEXT NULL",
        role: "VARCHAR(50) NOT NULL DEFAULT 'mahasiswa'",
        ktm_url: "TEXT NULL",
        status_verifikasi: "VARCHAR(30) NOT NULL DEFAULT 'pending'",
        catatan_verifikasi: "TEXT NULL",
        ktm_uploaded_at: "DATETIME NULL"
    };

    const [cols] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM users");
    const existing = new Set(cols.map((c) => c.Field));

    for (const [col, def] of Object.entries(requiredColumns)) {
        if (!existing.has(col)) {
            await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
        }
    }
};

const saveBase64File = (folder: string, prefix: string, base64Data?: string): string | null => {
    if (!base64Data || !base64Data.startsWith("data:")) return null;
    const matches = base64Data.match(/^data:(image\/([a-zA-Z0-9+]+)|application\/(pdf));base64,(.+)$/);
    if (!matches) return null;

    const rawExt = matches[2] || matches[3] || "jpg";
    const ext = rawExt === "jpeg" ? "jpg" : rawExt;
    const buffer = Buffer.from(matches[4], "base64");
    const uploadDir = path.join(process.cwd(), "uploads", folder);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `${prefix}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return `/uploads/${folder}/${fileName}`;
};

export const UserModel = {
    findByEmail: async (email: string) => {
        const [users] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );
        return users[0] || null;
    },

    getAllUsersForAdmin: async () => {
        await ensureUserProfileColumns();
        const [users] = await pool.query<RowDataPacket[]>(`
            SELECT
                u.id,
                u.nama,
                u.email,
                COALESCE(u.no_hp, '') AS no_hp,
                COALESCE(u.universitas, '') AS universitas,
                COALESCE(u.jurusan, '') AS jurusan,
                COALESCE(u.nim, '') AS nim,
                COALESCE(u.ipk, '') AS ipk,
                COALESCE(u.bio, '') AS bio,
                COALESCE(u.keahlian, '') AS keahlian,
                COALESCE(u.foto_url, '') AS foto_url,
                COALESCE(u.role, 'mahasiswa') AS role,
                COALESCE(u.ktm_url, '') AS ktm_url,
                COALESCE(u.status_verifikasi, 'pending') AS status_verifikasi,
                COALESCE(u.catatan_verifikasi, '') AS catatan_verifikasi,
                u.ktm_uploaded_at,
                (SELECT COUNT(*) FROM services s WHERE s.seller_id = u.id) AS total_services
            FROM users u
            ORDER BY u.id DESC
        `);

        const totalUsers = users.length;
        const verifiedUsers = users.filter((u) => u.status_verifikasi === "terverifikasi").length;
        const pendingKtmUsers = users.filter((u) => u.status_verifikasi === "pending").length;

        return {
            summary: {
                total_users: totalUsers,
                verified_users: verifiedUsers,
                pending_ktm_users: pendingKtmUsers
            },
            users
        };
    },

    getUserProfileById: async (userId: number) => {
        await ensureUserProfileColumns();
        const [users] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE id = ?",
            [userId]
        );
        const user = users[0];
        if (!user) return null;

        return {
            id: user.id,
            nama: user.nama || "",
            email: user.email || "",
            no_hp: user.no_hp || user.phone || user.telepon || "",
            universitas: user.universitas || user.kampus || "",
            jurusan: user.jurusan || "",
            nim: user.nim || "",
            ipk: user.ipk || "",
            bio: user.bio || user.deskripsi || "",
            keahlian: user.keahlian || user.skills || "",
            foto_url: user.foto_url || "",
            role: user.role || "mahasiswa",
            ktm_url: user.ktm_url || "",
            status_verifikasi: user.status_verifikasi || "pending",
            catatan_verifikasi: user.catatan_verifikasi || "",
            ktm_uploaded_at: user.ktm_uploaded_at || null
        };
    },

    updateUserProfile: async (
        userId: number,
        payload: {
            nama?: string;
            email?: string;
            no_hp?: string;
            universitas?: string;
            jurusan?: string;
            nim?: string;
            ipk?: string;
            bio?: string;
            keahlian?: string;
            foto_base64?: string;
            ktm_base64?: string;
            role?: string;
            status_verifikasi?: string;
            catatan_verifikasi?: string;
        }
    ) => {
        await ensureUserProfileColumns();

        const [existingRows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE id = ?",
            [userId]
        );
        const current = existingRows[0];
        if (!current) return null;

        const nama = payload.nama?.trim() || current.nama;
        const email = payload.email?.trim() || current.email;
        const noHp = payload.no_hp !== undefined ? payload.no_hp.trim() : (current.no_hp || "");
        const universitas = payload.universitas !== undefined ? payload.universitas.trim() : (current.universitas || "");
        const jurusan = payload.jurusan !== undefined ? payload.jurusan.trim() : (current.jurusan || "");
        const nim = payload.nim !== undefined ? payload.nim.trim() : (current.nim || "");
        const ipk = payload.ipk !== undefined ? payload.ipk.trim() : (current.ipk || "");
        const bio = payload.bio !== undefined ? payload.bio.trim() : (current.bio || "");
        const keahlian = payload.keahlian !== undefined ? payload.keahlian.trim() : (current.keahlian || "");
        const role = payload.role !== undefined ? payload.role.trim() : (current.role || "mahasiswa");

        const savedAvatarUrl = saveBase64File("avatars", `avatar_${userId}`, payload.foto_base64);
        const fotoUrl = savedAvatarUrl || current.foto_url || "";

        const savedKtmUrl = saveBase64File("ktm", `ktm_${userId}`, payload.ktm_base64);
        const ktmUrl = savedKtmUrl || current.ktm_url || "";
        const statusVerifikasi = payload.status_verifikasi !== undefined
            ? payload.status_verifikasi.trim()
            : (savedKtmUrl ? "pending" : (current.status_verifikasi || "pending"));
        const catatanVerifikasi = payload.catatan_verifikasi !== undefined
            ? payload.catatan_verifikasi.trim()
            : (current.catatan_verifikasi || "");
        const ktmUploadedAt = savedKtmUrl ? new Date() : (current.ktm_uploaded_at || null);

        await pool.query<ResultSetHeader>(
            `UPDATE users
             SET nama = ?, email = ?, no_hp = ?, universitas = ?, jurusan = ?, nim = ?, ipk = ?,
                 bio = ?, keahlian = ?, foto_url = ?, role = ?, ktm_url = ?,
                 status_verifikasi = ?, catatan_verifikasi = ?, ktm_uploaded_at = ?
             WHERE id = ?`,
            [
                nama, email, noHp, universitas, jurusan, nim, ipk,
                bio, keahlian, fotoUrl, role, ktmUrl,
                statusVerifikasi, catatanVerifikasi, ktmUploadedAt, userId
            ]
        );

        return UserModel.getUserProfileById(userId);
    },

    verifyUserKtm: async (
        userId: number,
        payload: {
            status_verifikasi: string;
            catatan_verifikasi?: string;
            role?: string;
            nama?: string;
            universitas?: string;
            jurusan?: string;
            no_hp?: string;
        }
    ) => {
        return UserModel.updateUserProfile(userId, payload);
    },

    getPublicSellerProfile: async (sellerId: number) => {
        await ensureUserProfileColumns();

        const [users] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE id = ?",
            [sellerId]
        );
        const user = users[0];
        if (!user) return null;

        const [services] = await pool.query<RowDataPacket[]>(
            `SELECT 
                s.id, s.seller_id, s.category_id, s.judul, s.deskripsi,
                s.harga, s.nama_paket, s.waktu_pengerjaan, s.jumlah_revisi,
                s.rating, s.review_count, s.banner_url, s.status,
                c.nama AS nama_kategori
             FROM services s
             LEFT JOIN categories c ON s.category_id = c.id
             WHERE s.seller_id = ? AND s.status = 'aktif'
             ORDER BY s.created_at DESC`,
            [sellerId]
        );

        return {
            seller: {
                id: user.id,
                nama: user.nama || "-",
                email: user.email || "",
                universitas: user.universitas || user.kampus || "-",
                jurusan: user.jurusan || "-",
                nim: user.nim || "-",
                ipk: user.ipk || "-",
                bio: user.bio || user.deskripsi || "-",
                keahlian: user.keahlian || user.skills || "",
                foto_url: user.foto_url || "",
                status_verifikasi: user.status_verifikasi || "pending"
            },
            services
        };
    },

    getPublicSellerProfileByServiceId: async (serviceId: string) => {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT seller_id FROM services WHERE id = ?",
            [serviceId]
        );
        if (!rows[0]?.seller_id) return null;
        return UserModel.getPublicSellerProfile(Number(rows[0].seller_id));
    }
};
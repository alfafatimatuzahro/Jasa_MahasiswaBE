import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { put } from '@vercel/blob';
import pool from '../config/db';
import fs from 'fs';
import path from 'path';

// 1. Statistik Dashboard (Mengambil jumlah order & user real-time)
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [users] = await pool.query('SELECT COUNT(*) as total_users FROM users WHERE role = "mahasiswa"');
        const [orders] = await pool.query('SELECT COUNT(*) as total_transactions FROM orders');
        const [pendingKtm] = await pool.query('SELECT COUNT(*) as pending_ktm FROM users WHERE ktm_status = "menunggu_verifikasi"');

        res.status(200).json({
            success: true,
            data: {
                totalUsers: (users as any)[0].total_users,
                totalTransactions: (orders as any)[0].total_transactions,
                pendingKtm: (pendingKtm as any)[0].pending_ktm
            }
        });
    } catch (error) {
        next(error);
    }
};

// 2. Fitur Verifikasi KTM
export const verifyKtm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, reject_reason } = req.body;

    try {
        if (status === 'disetujui') {
            await pool.query(
                'UPDATE users SET ktm_status = ?, is_verified = 1, is_seller = 1, ktm_reject_reason = NULL WHERE id = ?',
                ['disetujui', id]
            );
            res.status(200).json({ success: true, message: 'KTM disetujui. Akun ini sekarang adalah Penyedia Jasa.' });
        
        } else if (status === 'ditolak') {
            await pool.query(
                'UPDATE users SET ktm_status = ?, ktm_reject_reason = ?, is_verified = 0, is_seller = 0 WHERE id = ?',
                ['ditolak', reject_reason, id]
            );
            res.status(200).json({ success: true, message: 'KTM ditolak. Alasan telah dikirim ke pengguna.' });
        
        } else {
            res.status(400).json({ success: false, message: 'Status tidak valid.' });
        }
    } catch (error) {
        next(error);
    }
};

// 3. Fitur Verifikasi & Pemantauan Log AI
export const getAiLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [logs] = await pool.query(`
            SELECT a.id, a.query_pencarian, a.respon_ai, a.created_at, u.nama, u.email 
            FROM ai_search_logs a 
            LEFT JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC 
            LIMIT 50
        `);
        
        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        next(error);
    }
};

// 4. Menarik Data Mahasiswa untuk User Management
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE role = "mahasiswa"');
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

// 5. Mengambil Data Transaksi dari tabel 'orders'
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [orders] = await pool.query(`
            SELECT o.*, 
                   b.nama AS buyer_name, 
                   s.nama AS seller_name, 
                   srv.judul AS service_title,
                   srv.harga AS service_price
            FROM orders o
            LEFT JOIN users b ON o.buyer_id = b.id
            LEFT JOIN users s ON o.seller_id = s.id
            LEFT JOIN services srv ON o.service_id = srv.id
            ORDER BY o.id DESC
        `);
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        next(error);
    }
};

// 6. Mengambil Data Pengajuan Jasa untuk Moderasi (Gunakan status 'ditinjau')
export const getPendingServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [services] = await pool.query('SELECT * FROM services WHERE status = "ditinjau"');
        res.status(200).json({ success: true, data: services });
    } catch (error) {
        next(error);
    }
};

// 7. Mengambil Profil Admin, Pengaturan Platform & Log Aktivitas Admin
export const getSettingsAndLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [adminRows] = await pool.query('SELECT id, nama, email, no_hp, avatar_url, role FROM users WHERE role = "admin" LIMIT 1');
        const [settings] = await pool.query('SELECT * FROM platform_settings');
        const [logs] = await pool.query('SELECT * FROM admin_activity_logs ORDER BY created_at DESC LIMIT 10');
        
        res.status(200).json({
            success: true,
            data: { 
                admin: (adminRows as any)[0] || null,
                settings, 
                logs 
            }
        });
    } catch (error) {
        next(error);
    }
};

// 8. Menyimpan Pengaturan Platform
export const updatePlatformSettings = async (req: Request, res: Response, next: NextFunction) => {
    const { platform_fee, min_withdrawal } = req.body;
    try {
        if (platform_fee !== undefined) {
            await pool.query(
                'UPDATE platform_settings SET setting_value = ? WHERE setting_key = "platform_fee_percent"',
                [String(platform_fee)]
            );
        }
        if (min_withdrawal !== undefined) {
            await pool.query(
                'UPDATE platform_settings SET setting_value = ? WHERE setting_key = "min_withdrawal"',
                [String(min_withdrawal)]
            );
        }

        await pool.query(
            'INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, keterangan) VALUES (?, ?, ?, ?, ?)',
            [1, 'UPDATE_SETTINGS', 'platform_settings', 1, `Memperbarui pengaturan platform (Fee: ${platform_fee}%, Min Pencairan: Rp ${min_withdrawal})`]
        );

        res.status(200).json({ success: true, message: 'Pengaturan platform berhasil disimpan!' });
    } catch (error) {
        next(error);
    }
};

// 9. Edit Profil (termasuk no_hp & avatar_url) & Ubah Password Admin
export const updateAdminProfile = async (req: Request, res: Response, next: NextFunction) => {
    const { nama, email, no_hp, avatar_url, new_password } = req.body;
    const adminId = 1;

    try {
        if (new_password && new_password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(new_password, 10);
            await pool.query(
                'UPDATE users SET nama = ?, email = ?, no_hp = ?, avatar_url = COALESCE(?, avatar_url), password = ? WHERE id = ?',
                [nama, email, no_hp || null, avatar_url || null, hashedPassword, adminId]
            );
        } else {
            await pool.query(
                'UPDATE users SET nama = ?, email = ?, no_hp = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
                [nama, email, no_hp || null, avatar_url || null, adminId]
            );
        }

        await pool.query(
            'INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, keterangan) VALUES (?, ?, ?, ?, ?)',
            [adminId, 'UPDATE_PROFILE', 'users', adminId, 'Memperbarui profil / password akun Super Admin.']
        );

        res.status(200).json({ success: true, message: 'Profil admin berhasil diperbarui!' });
    } catch (error) {
        console.error('Detail Error Update Profile:', error);
        next(error);
    }
};

// 10. Upload Foto Profil Admin (Simpan ke folder lokal /uploads milik Backend Mobile)
export const uploadAdminAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File foto tidak ditemukan.' });
        }

        const safeName = req.file.originalname.replace(/\s+/g, '-');
        const filename = 'admin-' + Date.now() + '-' + safeName;

        // Pastikan folder uploads/ tersedia
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Simpan file gambar ke folder uploads/
        fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
        const finalAvatarUrl = 'http://localhost:3000/uploads/' + filename;

        // Update kolom avatar_url untuk akun admin di database
        await pool.query('UPDATE users SET avatar_url = ? WHERE role = "admin"', [finalAvatarUrl]);

        await pool.query(
            'INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, keterangan) VALUES (?, ?, ?, ?, ?)',
            [1, 'UPDATE_AVATAR', 'users', 1, 'Mengunggah foto profil baru admin.']
        );

        res.status(200).json({
            success: true,
            url: finalAvatarUrl,
            message: 'Foto profil berhasil diunggah!',
        });
    } catch (error) {
        console.error('Detail Error Upload Avatar:', error);
        next(error);
    }
};

// Mengambil SEMUA Data Jasa untuk Dashboard & Moderasi Jasa
export const getAllServicesAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [services] = await pool.query(`
            SELECT s.*, u.nama AS seller_name 
            FROM services s 
            LEFT JOIN users u ON s.seller_id = u.id 
            ORDER BY s.created_at DESC
        `);
        res.status(200).json({ success: true, data: services });
    } catch (error) {
        next(error);
    }
};

// 11. Eksekusi Setujui / Tolak Jasa ke Database
export const moderateService = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE services SET status = ? WHERE id = ?', [status, id]);
        res.status(200).json({ success: true, message: 'Status jasa diperbarui' });
    } catch (error) {
        next(error);
    }
};
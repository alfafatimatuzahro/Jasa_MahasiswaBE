import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db';

// 1. Fitur Analitik Dashboard
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [users] = await pool.query('SELECT COUNT(*) as total_users FROM users WHERE role = "mahasiswa"');
        const [transactions] = await pool.query('SELECT COUNT(*) as total_transactions FROM transactions');
        const [pendingKtm] = await pool.query('SELECT COUNT(*) as pending_ktm FROM users WHERE ktm_status = "menunggu_verifikasi"');

        res.status(200).json({
            success: true,
            data: {
                totalUsers: (users as any)[0].total_users,
                totalTransactions: (transactions as any)[0].total_transactions,
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

// 5. Mengambil Data Transaksi untuk Verifikasi Transaksi
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [transactions] = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
        res.status(200).json({ success: true, data: transactions });
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
        const [adminRows] = await pool.query('SELECT id, nama, email, no_hp, avatar_url, role FROM users WHERE id = 1');
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

// 8. Menyimpan Pengaturan Platform (Anti gagal jika key belum ada)
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
        // Susun query secara dinamis agar hanya mengupdate field yang dikirim
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
import pool from "../config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const ensureWithdrawalsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            seller_id INT NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            bank_or_ewallet VARCHAR(100) NOT NULL,
            account_number VARCHAR(100) NOT NULL,
            account_name VARCHAR(150) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [cols] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM withdrawals");
    const existingNames = new Set(cols.map((c) => c.Field));

    if (existingNames.has("user_id")) {
        try { await pool.query("ALTER TABLE withdrawals DROP FOREIGN KEY withdrawals_ibfk_1"); } catch (_) {}
        try { await pool.query("ALTER TABLE withdrawals DROP COLUMN user_id"); } catch (_) {}
    }

    if (existingNames.has("wd_code")) {
        try { await pool.query("ALTER TABLE withdrawals DROP INDEX wd_code"); } catch (_) {}
        try { await pool.query("ALTER TABLE withdrawals DROP COLUMN wd_code"); } catch (_) {}
    }

    const requiredColumns: Record<string, string> = {
        seller_id: "INT NOT NULL DEFAULT 0",
        amount: "DECIMAL(12,2) NOT NULL DEFAULT 0",
        bank_or_ewallet: "VARCHAR(100) NOT NULL DEFAULT ''",
        account_number: "VARCHAR(100) NOT NULL DEFAULT ''",
        account_name: "VARCHAR(150) NOT NULL DEFAULT ''",
        status: "VARCHAR(30) NOT NULL DEFAULT 'pending'"
    };

    for (const [colName, colDef] of Object.entries(requiredColumns)) {
        if (!existingNames.has(colName)) {
            await pool.query(`ALTER TABLE withdrawals ADD COLUMN ${colName} ${colDef}`);
        }
    }
};

export const WalletModel = {
    getAllWithdrawalsForAdmin: async () => {
        await ensureWithdrawalsTable();
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT
                w.id,
                CONCAT('#WD-', LPAD(w.id, 4, '0')) AS trx_code,
                w.seller_id,
                u.nama AS nama_penjual,
                u.email AS email_penjual,
                w.amount,
                w.bank_or_ewallet,
                w.account_number,
                w.account_name,
                CONCAT('Pencairan Saldo ', w.bank_or_ewallet, ' (a.n ', w.account_name, ')') AS description,
                w.status,
                w.created_at
            FROM withdrawals w
            LEFT JOIN users u ON w.seller_id = u.id
            ORDER BY w.id DESC
        `);
        return rows;
    },

    updateWithdrawalStatus: async (id: string, status: string) => {
        await ensureWithdrawalsTable();
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE withdrawals SET status = ? WHERE id = ?",
            [status, id]
        );
        return result.affectedRows > 0;
    },
    getSellerWalletSummary: async (sellerId: string) => {
        await ensureWithdrawalsTable();

        const [earningRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                COALESCE(SUM(total_harga), 0) AS total_earned,
                COUNT(*) AS completed_orders
             FROM orders
             WHERE seller_id = ? AND status = 'selesai'`,
            [sellerId]
        );

        const [pendingRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                COALESCE(SUM(total_harga), 0) AS pending_amount,
                COUNT(*) AS active_orders
             FROM orders
             WHERE seller_id = ? AND status IN ('menunggu', 'diproses', 'menunggu_review', 'revisi')`,
            [sellerId]
        );

        const [withdrawSumRows] = await pool.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(amount), 0) AS total_withdrawn
             FROM withdrawals
             WHERE seller_id = ? AND status != 'ditolak'`,
            [sellerId]
        );
        const totalWithdrawn = Number(withdrawSumRows[0]?.total_withdrawn || 0);

        const [withdrawHistory] = await pool.query<RowDataPacket[]>(
            `SELECT 
                w.id,
                CONCAT('WD-', LPAD(w.id, 5, '0')) AS reference_code,
                CONCAT('Penarikan ke ', w.bank_or_ewallet) AS title,
                CONCAT(w.account_number, ' a.n. ', w.account_name) AS counterpart_name,
                w.amount,
                w.created_at,
                'withdraw' AS type,
                w.status
             FROM withdrawals w
             WHERE w.seller_id = ?
             ORDER BY w.id DESC`,
            [sellerId]
        );

        const totalEarned = Number(earningRows[0]?.total_earned || 0);
        const availableBalance = Math.max(0, totalEarned - totalWithdrawn);
        const pendingBalance = Number(pendingRows[0]?.pending_amount || 0);

        const [incomeHistory] = await pool.query<RowDataPacket[]>(
            `SELECT 
                o.id,
                CONCAT('#ORD-', o.id) AS reference_code,
                COALESCE(s.judul, 'Pesanan Jasa') AS title,
                COALESCE(u.nama, 'Pembeli') AS counterpart_name,
                o.total_harga AS amount,
                o.created_at AS created_at,
                'income' AS type,
                'selesai' AS status
             FROM orders o
             LEFT JOIN services s ON o.service_id = s.id
             LEFT JOIN users u ON o.buyer_id = u.id
             WHERE o.seller_id = ? AND o.status = 'selesai'
             ORDER BY o.id DESC`,
            [sellerId]
        );

        const transactions = [...incomeHistory, ...withdrawHistory].sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        return {
            available_balance: availableBalance,
            pending_balance: pendingBalance,
            total_earned: totalEarned,
            total_withdrawn: totalWithdrawn,
            completed_orders: Number(earningRows[0]?.completed_orders || 0),
            active_orders: Number(pendingRows[0]?.active_orders || 0),
            transactions
        };
    },

    requestWithdraw: async (data: {
        seller_id: number;
        amount: number;
        bank_or_ewallet: string;
        account_number: string;
        account_name: string;
    }) => {
        await ensureWithdrawalsTable();

        const summary = await WalletModel.getSellerWalletSummary(String(data.seller_id));
        if (data.amount <= 0) {
            throw new Error("Nominal penarikan harus lebih dari Rp 0");
        }
        if (data.amount > summary.available_balance) {
            throw new Error("Saldo tersedia tidak mencukupi untuk penarikan ini");
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO withdrawals (seller_id, amount, bank_or_ewallet, account_number, account_name, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [
                data.seller_id,
                data.amount,
                data.bank_or_ewallet,
                data.account_number,
                data.account_name
            ]
        );

        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM withdrawals WHERE id = ?",
            [result.insertId]
        );
        return rows[0];
    }
};
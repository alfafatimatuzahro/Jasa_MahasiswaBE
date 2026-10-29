import pool from "../config/db";
import type { RowDataPacket } from "mysql2";

export const UserModel = {
    // Mencari user berdasarkan email untuk keperluan login
    findByEmail: async (email: string) => {
        const [users] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );
        return users[0] || null;
    }
};
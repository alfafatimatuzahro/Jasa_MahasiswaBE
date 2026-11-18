import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import { UserModel } from "../models/userModel";

const signUserToken = (user: any) => {
    const secret = process.env.JWT_SECRET || "jasa_mahasiswa_secret_key_2026";
    return jwt.sign(
        { id: user.id, role: user.role },
        secret,
        { expiresIn: "7d" }
    );
};

// Registrasi akun baru Mahasiswa
export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const nama = (req.body.nama || req.body.name || "").toString().trim();
        const email = (req.body.email || "").toString().trim().toLowerCase();
        const password = (req.body.password || "").toString();

        if (!nama || !email || !password) {
            return res.status(400).json({ message: "Nama, email, dan password wajib diisi" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password minimal 8 karakter" });
        }

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: "Email sudah terdaftar, silakan login" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result]: any = await pool.query(
            `INSERT INTO users (nama, email, password, role, status_verifikasi)
             VALUES (?, ?, ?, 'mahasiswa', 'pending')`,
            [nama, email, hashedPassword]
        );

        const newUserId = result.insertId;
        const newUser = {
            id: newUserId,
            nama,
            email,
            role: "mahasiswa",
            universitas: null,
            jurusan: null,
            foto_url: null
        };

        const token = signUserToken(newUser);

        return res.status(201).json({
            message: "Registrasi berhasil",
            token,
            user: newUser
        });
    } catch (error) {
        next(error);
    }
};

// Login umum (untuk aplikasi mobile Mahasiswa & Penyedia Jasa)
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        const token = signUserToken(user);

        return res.status(200).json({
            message: "Login berhasil",
            token,
            user: {
                id: user.id,
                nama: user.nama,
                email: user.email,
                role: user.role,
                universitas: user.universitas,
                jurusan: user.jurusan,
                foto_url: user.foto_url
            }
        });
    } catch (error) {
        next(error);
    }
};

// Login khusus Dashboard Admin
export const loginAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Akses ditolak! Hanya Admin yang diizinkan." });
        }

        const token = signUserToken(user);

        return res.status(200).json({
            message: "Login Admin berhasil",
            token,
            user: { id: user.id, nama: user.nama, email: user.email, role: user.role }
        });
    } catch (error) {
        next(error);
    }
};
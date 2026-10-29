import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/userModel";

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        // Cek user ada atau tidak
        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        // Cek kecocokan password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        // Buat Token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            message: "Login berhasil",
            token: token,
            user: { id: user.id, nama: user.nama, email: user.email, role: user.role }
        });
    } catch (error) {
        next(error);
    }
};
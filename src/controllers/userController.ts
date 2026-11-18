import { Request, Response } from "express";
import { UserModel } from "../models/userModel";

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const result = await UserModel.getAllUsersForAdmin();
        return res.status(200).json({
            message: "Berhasil mengambil daftar pengguna",
            summary: result.summary,
            data: result.users
        });
    } catch (error: any) {
        console.error("Error getAllUsers:", error);
        return res.status(500).json({ message: "Gagal mengambil daftar pengguna" });
    }
};

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) {
            return res.status(400).json({ message: "ID user tidak valid" });
        }
        const profile = await UserModel.getUserProfileById(userId);
        if (!profile) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }
        return res.status(200).json({ data: profile });
    } catch (error: any) {
        console.error("Error getUserProfile:", error);
        return res.status(500).json({ message: "Gagal mengambil profil user" });
    }
};

export const updateUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) {
            return res.status(400).json({ message: "ID user tidak valid" });
        }
        const updated = await UserModel.updateUserProfile(userId, req.body || {});
        if (!updated) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }
        return res.status(200).json({
            message: "Profil berhasil diperbarui",
            data: updated
        });
    } catch (error: any) {
        console.error("Error updateUserProfile:", error);
        return res.status(500).json({ message: "Gagal memperbarui profil user" });
    }
};

export const verifyUserKtm = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) {
            return res.status(400).json({ message: "ID user tidak valid" });
        }
        const { status_verifikasi, catatan_verifikasi, role, nama, universitas, jurusan, no_hp } = req.body || {};
        if (!status_verifikasi) {
            return res.status(400).json({ message: "Status verifikasi wajib diisi" });
        }
        const updated = await UserModel.verifyUserKtm(userId, {
            status_verifikasi,
            catatan_verifikasi,
            role,
            nama,
            universitas,
            jurusan,
            no_hp
        });
        if (!updated) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }
        return res.status(200).json({
            message: "Verifikasi dokumen pengguna berhasil diperbarui",
            data: updated
        });
    } catch (error: any) {
        console.error("Error verifyUserKtm:", error);
        return res.status(500).json({ message: "Gagal memverifikasi dokumen pengguna" });
    }
};

export const getPublicSellerProfile = async (req: Request, res: Response) => {
    try {
        const sellerId = Number(req.params.id);
        if (!sellerId) {
            return res.status(400).json({ message: "ID penjual tidak valid" });
        }
        const profile = await UserModel.getPublicSellerProfile(sellerId);
        if (!profile) {
            return res.status(404).json({ message: "Profil penjual tidak ditemukan" });
        }
        return res.status(200).json({ data: profile });
    } catch (error: any) {
        console.error("Error getPublicSellerProfile:", error);
        return res.status(500).json({ message: "Gagal mengambil profil penjual" });
    }
};

export const getPublicSellerProfileByService = async (req: Request, res: Response) => {
    try {
        const serviceId = String(req.params.serviceId || "");
        if (!serviceId) {
            return res.status(400).json({ message: "ID jasa tidak valid" });
        }
        const profile = await UserModel.getPublicSellerProfileByServiceId(serviceId);
        if (!profile) {
            return res.status(404).json({ message: "Profil penjual untuk jasa ini tidak ditemukan" });
        }
        return res.status(200).json({ data: profile });
    } catch (error: any) {
        console.error("Error getPublicSellerProfileByService:", error);
        return res.status(500).json({ message: "Gagal mengambil profil penjual" });
    }
};
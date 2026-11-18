import { Request, Response } from "express";
import { WalletModel } from "../models/walletModel";

export const getSellerWallet = async (req: Request, res: Response) => {
    try {
        const sellerId = Array.isArray(req.params.sellerId)
            ? req.params.sellerId[0]
            : req.params.sellerId;
        const summary = await WalletModel.getSellerWalletSummary(sellerId);
        res.status(200).json({
            message: "Berhasil mengambil data dompet penjual",
            data: summary
        });
    } catch (error) {
        console.error("Error getSellerWallet:", error);
        res.status(500).json({ message: "Gagal mengambil data dompet penjual" });
    }
};

export const withdrawFunds = async (req: Request, res: Response) => {
    try {
        const { seller_id, amount, bank_or_ewallet, account_number, account_name } = req.body;

        if (!seller_id || !amount || !bank_or_ewallet || !account_number || !account_name) {
            res.status(400).json({ message: "Semua data penarikan wajib diisi" });
            return;
        }

        const created = await WalletModel.requestWithdraw({
            seller_id: Number(seller_id),
            amount: Number(amount),
            bank_or_ewallet: String(bank_or_ewallet).trim(),
            account_number: String(account_number).trim(),
            account_name: String(account_name).trim()
        });

        res.status(201).json({
            message: "Pengajuan penarikan dana berhasil dikirim dan menunggu verifikasi Admin",
            data: created
        });
    } catch (error: any) {
        console.error("Error withdrawFunds:", error);
        res.status(400).json({ message: error?.message || "Gagal memproses penarikan dana" });
    }
};

export const getAllWithdrawals = async (req: Request, res: Response) => {
    try {
        const rows = await WalletModel.getAllWithdrawalsForAdmin();
        res.status(200).json({
            message: "Berhasil mengambil daftar pengajuan penarikan dana",
            data: rows
        });
    } catch (error) {
        console.error("Error getAllWithdrawals:", error);
        res.status(500).json({ message: "Gagal mengambil daftar penarikan dana" });
    }
};

export const updateWithdrawalStatus = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status } = req.body;
        if (!status) {
            res.status(400).json({ message: "Status wajib diisi" });
            return;
        }
        const ok = await WalletModel.updateWithdrawalStatus(id, status);
        if (!ok) {
            res.status(404).json({ message: "Data penarikan tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Status penarikan berhasil diperbarui" });
    } catch (error) {
        console.error("Error updateWithdrawalStatus:", error);
        res.status(500).json({ message: "Gagal memperbarui status penarikan" });
    }
};
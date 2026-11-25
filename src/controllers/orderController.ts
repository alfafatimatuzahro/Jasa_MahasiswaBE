import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { OrderModel } from "../models/orderModel";
// @ts-ignore
import midtransClient from "midtrans-client";

const ALLOWED_STATUSES = [
    "menunggu_konfirmasi",
    "diproses",
    "menunggu_review",
    "revisi",
    "selesai",
    "dibatalkan"
];

export const createOrder = async (req: Request, res: Response) => {
    try {
        const {
            service_id,
            buyer_id,
            catatan,
            total_harga,
            metode_pembayaran
        } = req.body;

        if (!service_id || !buyer_id || !total_harga) {
            res.status(400).json({
                message: "service_id, buyer_id, dan total_harga wajib diisi"
            });
            return;
        }

        const created: any = await OrderModel.createOrder({
            service_id: Number(service_id),
            buyer_id: Number(buyer_id),
            catatan: catatan || "",
            total_harga: Number(total_harga),
            metode_pembayaran: metode_pembayaran || "QRIS / Transfer"
        });

        let snapUrl: string | null = process.env.MIDTRANS_PAYMENT_LINK || null;
        let snapToken: string | null = null;
        const serverKey = (process.env.MIDTRANS_SERVER_KEY || "").trim();

        if (serverKey && !serverKey.includes("ISI_KEY_KAMU")) {
            try {
                const snap = new midtransClient.Snap({
                    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
                    serverKey
                });

                const orderIdStr = `ORDER-${created.id}-${Date.now()}`;
                const parameter = {
                    transaction_details: {
                        order_id: orderIdStr,
                        gross_amount: Math.max(1000, Math.round(Number(total_harga)))
                    },
                    credit_card: {
                        secure: true
                    }
                };

                const transaction = await snap.createTransaction(parameter);
                snapToken = transaction.token || null;
                snapUrl = transaction.redirect_url || snapUrl;
            } catch (midtransErr) {
                console.error("Midtrans Snap error:", midtransErr);
            }
        }

        res.status(201).json({
            message: "Pesanan berhasil dibuat",
            data: {
                ...created,
                snap_token: snapToken,
                snap_url: snapUrl
            }
        });
    } catch (error: any) {
        console.error("Error create order:", error);
        if (error.message === "Jasa tidak ditemukan") {
            res.status(404).json({ message: error.message });
            return;
        }
        res.status(500).json({
            message: "Internal server error saat membuat pesanan"
        });
    }
};

export const uploadPaymentProof = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { payment_proof_base64, payment_proof_name } = req.body;

        if (!payment_proof_base64 || typeof payment_proof_base64 !== "string") {
            res.status(400).json({
                message: "Screenshot bukti pembayaran wajib diunggah"
            });
            return;
        }

        const matches = payment_proof_base64.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            res.status(400).json({
                message: "Format gambar bukti pembayaran tidak valid"
            });
            return;
        }

        const rawExt = payment_proof_name
            ? path.extname(String(payment_proof_name)).replace(".", "").toLowerCase()
            : "";
        const ext = rawExt || "png";
        const base64Data = matches[2];
        const uploadDir = path.join(process.cwd(), "uploads");

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `payment-proof-${id}-${Date.now()}.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        const savedProofUrl = `/uploads/${fileName}`;

        const updated = await OrderModel.savePaymentProof(id, savedProofUrl);
        if (!updated) {
            res.status(404).json({ message: "Pesanan tidak ditemukan" });
            return;
        }

        res.status(200).json({
            message: "Bukti pembayaran berhasil dikirim ke Admin",
            data: {
                id: Number(id),
                bukti_pembayaran_url: savedProofUrl,
                status_pembayaran: "menunggu_verifikasi"
            }
        });
    } catch (error) {
        console.error("Error upload payment proof:", error);
        res.status(500).json({
            message: "Internal server error saat mengunggah bukti pembayaran"
        });
    }
};

export const getBuyerOrders = async (req: Request, res: Response) => {
    try {
        const buyerId = Array.isArray(req.params.buyerId)
            ? req.params.buyerId[0]
            : req.params.buyerId;
        const orders = await OrderModel.getOrdersByBuyer(buyerId);

        res.status(200).json({
            message: "Berhasil mengambil pesanan pembeli",
            data: orders
        });
    } catch (error) {
        console.error("Error get buyer orders:", error);
        res.status(500).json({
            message: "Internal server error saat mengambil pesanan pembeli"
        });
    }
};

export const getSellerOrders = async (req: Request, res: Response) => {
    try {
        const sellerId = Array.isArray(req.params.sellerId)
            ? req.params.sellerId[0]
            : req.params.sellerId;
        const orders = await OrderModel.getOrdersBySeller(sellerId);

        res.status(200).json({
            message: "Berhasil mengambil pesanan masuk penjual",
            data: orders
        });
    } catch (error) {
        console.error("Error get seller orders:", error);
        res.status(500).json({
            message: "Internal server error saat mengambil pesanan penjual"
        });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status } = req.body;

        if (!status || !ALLOWED_STATUSES.includes(status)) {
            res.status(400).json({
                message: `Status tidak valid. Pilihan: ${ALLOWED_STATUSES.join(", ")}`
            });
            return;
        }

        const updated = await OrderModel.updateOrderStatus(id, status);
        if (!updated) {
            res.status(404).json({ message: "Pesanan tidak ditemukan" });
            return;
        }

        res.status(200).json({
            message: "Status pesanan berhasil diperbarui",
            data: { id: Number(id), status }
        });
    } catch (error) {
        console.error("Error update order status:", error);
        res.status(500).json({
            message: "Internal server error saat memperbarui status pesanan"
        });
    }
};

export const deliverOrderResult = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { result_note, result_file_base64, result_file_name } = req.body;

        if ((!result_note || !String(result_note).trim()) && !result_file_base64) {
            res.status(400).json({
                message: "Catatan/link hasil atau file hasil kerja wajib diisi"
            });
            return;
        }

        let savedFileUrl: string | null = null;

        if (result_file_base64 && typeof result_file_base64 === "string") {
            const matches = result_file_base64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const rawExt = result_file_name
                    ? path.extname(String(result_file_name)).replace(".", "").toLowerCase()
                    : "";
                const ext = rawExt || "bin";
                const base64Data = matches[2];
                const uploadDir = path.join(process.cwd(), "uploads");

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const fileName = `result-${Date.now()}.${ext}`;
                const filePath = path.join(uploadDir, fileName);
                fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
                savedFileUrl = `/uploads/${fileName}`;
            }
        }

        const delivered = await OrderModel.deliverOrder(
            id,
            String(result_note || "").trim(),
            savedFileUrl
        );

        if (!delivered) {
            res.status(404).json({ message: "Pesanan tidak ditemukan" });
            return;
        }

        res.status(200).json({
            message: "Hasil pekerjaan berhasil dikirim ke pembeli",
            data: {
                id: Number(id),
                status: "menunggu_review",
                result_note: String(result_note || "").trim(),
                result_file_url: savedFileUrl
            }
        });
    } catch (error) {
        console.error("Error deliver order result:", error);
        res.status(500).json({
            message: "Internal server error saat mengirim hasil pekerjaan"
        });
    }
};
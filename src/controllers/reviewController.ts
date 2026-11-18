import { Request, Response } from "express";
import pool from "../config/db";
import type { RowDataPacket } from "mysql2";
import { ReviewModel } from "../models/reviewModel";

export const createReview = async (req: Request, res: Response) => {
    try {
        const { order_id, service_id, buyer_id, seller_id, rating, comment } = req.body;

        if (!order_id || !rating) {
            res.status(400).json({ message: "order_id dan rating wajib diisi" });
            return;
        }

        const numericRating = Number(rating);
        if (numericRating < 1 || numericRating > 5) {
            res.status(400).json({ message: "Rating harus antara 1 sampai 5" });
            return;
        }

        // Ambil detail order dari DB untuk memastikan service_id, buyer_id, dan seller_id valid
        const [orderRows] = await pool.query<RowDataPacket[]>(
            "SELECT id, service_id, buyer_id, seller_id, status FROM orders WHERE id = ?",
            [Number(order_id)]
        );

        if (orderRows.length === 0) {
            res.status(404).json({ message: "Pesanan tidak ditemukan" });
            return;
        }

        const order = orderRows[0];
        if (order.status !== "selesai") {
            res.status(400).json({ message: "Ulasan hanya dapat diberikan untuk pesanan yang sudah selesai" });
            return;
        }

        const created = await ReviewModel.createReview({
            order_id: Number(order.id),
            service_id: Number(service_id || order.service_id),
            buyer_id: Number(buyer_id || order.buyer_id),
            seller_id: Number(seller_id || order.seller_id),
            rating: numericRating,
            comment: comment ? String(comment).trim() : ""
        });

        res.status(201).json({
            message: "Ulasan berhasil dikirim",
            data: created
        });
    } catch (error: any) {
        console.error("Error createReview:", error);
        res.status(400).json({ message: error?.message || "Gagal menyimpan ulasan" });
    }
};

export const getServiceReviews = async (req: Request, res: Response) => {
    try {
        const serviceId = Array.isArray(req.params.serviceId)
            ? req.params.serviceId[0]
            : req.params.serviceId;
        const reviews = await ReviewModel.getByServiceId(serviceId);
        res.status(200).json({
            message: "Berhasil mengambil ulasan jasa",
            data: reviews
        });
    } catch (error) {
        console.error("Error getServiceReviews:", error);
        res.status(500).json({ message: "Gagal mengambil ulasan jasa" });
    }
};

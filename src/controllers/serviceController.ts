import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ServiceModel } from '../models/serviceModel';

const saveBannerFromBase64 = (bannerBase64?: string): string | null => {
    if (!bannerBase64 || typeof bannerBase64 !== 'string') return null;
    const matches = bannerBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const uploadDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `service-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return `/uploads/${fileName}`;
};

export const getPendingServices = async (req: Request, res: Response) => {
    try {
        const [services, summary] = await Promise.all([
            ServiceModel.getPendingServices(),
            ServiceModel.getModerationSummary()
        ]);
        res.status(200).json({
            message: "Berhasil mengambil daftar jasa yang menunggu moderasi",
            summary,
            data: services
        });
    } catch (error) {
        console.error("Error get pending services:", error);
        res.status(500).json({ message: "Gagal mengambil daftar moderasi jasa" });
    }
};
export const getServices = async (req: Request, res: Response) => {
    try {
        const services = await ServiceModel.getAllActiveServices();
        res.status(200).json({
            message: "Berhasil mengambil data jasa",
            data: services
        });
    } catch (error) {
        console.error("Error get services:", error);
        res.status(500).json({ message: "Internal server error saat mengambil jasa" });
    }
};

export const getServicesBySeller = async (req: Request, res: Response) => {
    try {
        const sellerId = Number(req.params.sellerId);
        if (!sellerId) {
            res.status(400).json({ message: "ID penjual tidak valid" });
            return;
        }
        const services = await ServiceModel.getServicesBySellerId(sellerId);
        res.status(200).json({
            message: "Berhasil mengambil daftar jasa penjual",
            data: services
        });
    } catch (error) {
        console.error("Error get services by seller:", error);
        res.status(500).json({ message: "Gagal mengambil daftar jasa penjual" });
    }
};

export const getServiceById = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const service = await ServiceModel.getServiceById(id);

        if (!service) {
            res.status(404).json({ message: "Jasa tidak ditemukan" });
            return;
        }

        res.status(200).json({
            message: "Berhasil mengambil detail jasa",
            data: service
        });
    } catch (error) {
        console.error("Error get service by id:", error);
        res.status(500).json({ message: "Internal server error saat mengambil detail jasa" });
    }
};

export const createService = async (req: Request, res: Response) => {
    try {
        const {
            seller_id,
            category_id,
            judul,
            deskripsi,
            harga,
            nama_paket,
            waktu_pengerjaan,
            jumlah_revisi,
            banner_base64,
            status
        } = req.body;

        if (!seller_id || !judul || !harga) {
            res.status(400).json({ message: "Data penjual, judul jasa, dan harga wajib diisi" });
            return;
        }

        const savedBannerUrl = saveBannerFromBase64(banner_base64);

        const newServiceId = await ServiceModel.createService({
            seller_id: Number(seller_id),
            category_id: Number(category_id) || 1,
            judul,
            deskripsi: deskripsi || '',
            harga: Number(harga),
            nama_paket: nama_paket || 'Paket Standar',
            waktu_pengerjaan: Number(waktu_pengerjaan) || 1,
            jumlah_revisi: Number(jumlah_revisi) || 1,
            banner_url: savedBannerUrl,
            status: status || 'ditinjau'
        });

        res.status(201).json({
            message: "Penawaran jasa berhasil dibuat dan menunggu moderasi admin",
            data: {
                id: newServiceId,
                judul,
                harga: Number(harga),
                banner_url: savedBannerUrl,
                status: status || 'ditinjau'
            }
        });

        res.status(201).json({
            message: "Penawaran jasa berhasil dibuat",
            data: {
                id: newServiceId,
                judul,
                harga: Number(harga),
                banner_url: savedBannerUrl,
                status: status || 'aktif'
            }
        });
    } catch (error) {
        console.error("Error create service:", error);
        res.status(500).json({ message: "Internal server error saat membuat jasa" });
    }
};

export const updateService = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const {
            category_id,
            judul,
            deskripsi,
            harga,
            nama_paket,
            waktu_pengerjaan,
            jumlah_revisi,
            banner_base64,
            status
        } = req.body;

        const savedBannerUrl = saveBannerFromBase64(banner_base64);

        const updated = await ServiceModel.updateService(id, {
            category_id: category_id !== undefined ? Number(category_id) : undefined,
            judul,
            deskripsi,
            harga: harga !== undefined ? Number(harga) : undefined,
            nama_paket,
            waktu_pengerjaan: waktu_pengerjaan !== undefined ? Number(waktu_pengerjaan) : undefined,
            jumlah_revisi: jumlah_revisi !== undefined ? Number(jumlah_revisi) : undefined,
            banner_url: savedBannerUrl !== null ? savedBannerUrl : undefined,
            status
        });

        if (!updated) {
            res.status(404).json({ message: "Jasa tidak ditemukan" });
            return;
        }

        res.status(200).json({
            message: "Jasa berhasil diperbarui",
            data: updated
        });
    } catch (error) {
        console.error("Error update service:", error);
        res.status(500).json({ message: "Gagal memperbarui jasa" });
    }
};

export const updateServiceStatus = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status } = req.body;
        if (!status) {
            res.status(400).json({ message: "Status wajib diisi" });
            return;
        }
        const ok = await ServiceModel.updateServiceStatus(id, status);
        if (!ok) {
            res.status(404).json({ message: "Jasa tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Status jasa berhasil diperbarui" });
    } catch (error) {
        console.error("Error update service status:", error);
        res.status(500).json({ message: "Gagal memperbarui status jasa" });
    }
};

export const deleteService = async (req: Request, res: Response) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const ok = await ServiceModel.deleteService(id);
        if (!ok) {
            res.status(404).json({ message: "Jasa tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Jasa berhasil dihapus" });
    } catch (error: any) {
        if (error?.message === "HAS_ORDERS") {
            res.status(400).json({
                message: "Jasa sudah memiliki riwayat pesanan sehingga tidak dapat dihapus permanen. Silakan nonaktifkan jasa ini."
            });
            return;
        }
        console.error("Error delete service:", error);
        res.status(500).json({ message: "Gagal menghapus jasa" });
    }
};
import { Request, Response } from 'express';
import { ServiceModel } from '../models/serviceModel';

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
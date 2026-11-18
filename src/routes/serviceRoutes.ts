import { Router } from 'express';
import {
    getServices,
    getPendingServices,
    getServicesBySeller,
    getServiceById,
    createService,
    updateService,
    updateServiceStatus,
    deleteService
} from '../controllers/serviceController';

export const serviceRouter = Router();

serviceRouter.get('/', getServices);
serviceRouter.get('/pending', getPendingServices);
serviceRouter.get('/seller/:sellerId', getServicesBySeller);
serviceRouter.get('/:id', getServiceById);
serviceRouter.post('/', createService);
serviceRouter.put('/:id', updateService);
serviceRouter.patch('/:id/status', updateServiceStatus);
serviceRouter.delete('/:id', deleteService);
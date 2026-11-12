import { Router } from 'express';
import { getServices } from '../controllers/serviceController';

export const serviceRouter = Router();

// Endpoint ini akan menjadi: GET /api/services/
serviceRouter.get('/', getServices);
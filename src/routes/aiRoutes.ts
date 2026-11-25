import { Router } from 'express';
import { chatWithAsistenJasa } from '../controllers/aiController';

const router = Router();
router.post('/chat', chatWithAsistenJasa);

export default router;
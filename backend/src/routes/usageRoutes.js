import { Router } from 'express';
import { getUsageMetrics } from '../controllers/usageController.js';

const router = Router();
router.get('/', getUsageMetrics);

export default router;


import { Router } from 'express';
import { getBillingRecords, getServicesList } from '../controllers/billingController.js';

const router = Router();
router.get('/', getBillingRecords);
router.get('/services', getServicesList);

export default router;


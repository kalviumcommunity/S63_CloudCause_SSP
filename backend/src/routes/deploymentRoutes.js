import { Router } from 'express';
import { getDeployments } from '../controllers/deploymentController.js';

const router = Router();
router.get('/', getDeployments);

export default router;


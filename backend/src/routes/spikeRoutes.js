import { Router } from 'express';
import { getAllSpikes, getSpikeDetails } from '../controllers/spikeController.js';

const router = Router();
router.get('/', getAllSpikes);
router.get('/:id', getSpikeDetails);

export default router;


import express from 'express';
import { getTargets, getStreamerTargets, saveTarget } from '../controllers/target.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTargets);
router.get('/:streamerId', getStreamerTargets);
router.post('/', saveTarget);

export default router;

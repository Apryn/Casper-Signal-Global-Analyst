import express from 'express';
import {
  getAllStreamers,
  createStreamer,
  updateStreamer,
  deleteStreamer,
} from '../controllers/streamer.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Read list (both roles)
router.get('/', getAllStreamers);

// Manage list (both roles)
router.post('/', createStreamer);
router.put('/:id', updateStreamer);
router.delete('/:id', deleteStreamer);

export default router;

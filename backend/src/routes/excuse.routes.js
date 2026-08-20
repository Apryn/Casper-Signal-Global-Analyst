import express from 'express';
import {
  getPublicStreamers,
  submitExcuseRequest,
  getExcuseRequests,
  approveExcuseRequest,
  rejectExcuseRequest
} from '../controllers/excuse.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes (for Streamer Google Form-style submission page)
router.get('/public-streamers', getPublicStreamers);
router.post('/submit', submitExcuseRequest);

// Protected routes (for Dashboard Admin / Finance approval)
router.get('/list', authenticateToken, getExcuseRequests);
router.post('/approve/:id', authenticateToken, approveExcuseRequest);
router.post('/reject/:id', authenticateToken, rejectExcuseRequest);

export default router;

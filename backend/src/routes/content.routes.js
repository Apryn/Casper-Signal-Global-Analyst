import express from 'express';
import {
  getContentList,
  getContentAnalytics,
  addContent,
  updateContent,
  deleteContent,
  syncAllContent
} from '../controllers/content.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getContentList);
router.get('/analytics', getContentAnalytics);
router.post('/', addContent);
router.post('/sync', syncAllContent);
router.put('/:id', updateContent);
router.delete('/:id', deleteContent);

export default router;

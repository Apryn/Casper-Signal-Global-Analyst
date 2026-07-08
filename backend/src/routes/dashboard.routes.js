import express from 'express';
import {
  getDashboardSummary,
  getChartData,
  getComparisonData,
  getLeaderboard
} from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth check
router.use(authenticateToken);

router.get('/summary', getDashboardSummary);
router.get('/charts', getChartData);
router.get('/comparison', getComparisonData);
router.get('/leaderboard', getLeaderboard);

export default router;

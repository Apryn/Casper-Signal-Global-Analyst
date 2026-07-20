import express from 'express';
import { 
  getStreamerPerformance, 
  getLeaderboardWithScores, 
  getAiAnalystReport,
  getMonthlyPenaltyReport,
  getViewerHistory
} from '../controllers/analytics.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/streamer/:streamerId', getStreamerPerformance);
router.get('/leaderboard', getLeaderboardWithScores);
router.get('/ai-report', getAiAnalystReport);
router.get('/monthly-penalty', getMonthlyPenaltyReport);
router.get('/viewer-history', getViewerHistory);

export default router;

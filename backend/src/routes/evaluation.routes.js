import express from 'express';
import { 
  getWeeklyEvaluation, 
  saveWeeklyEvaluation, 
  getWeeklyEvaluationHistory,
  chatWeeklyEvaluation
} from '../controllers/evaluation.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/evaluations/weekly -> aggregates and fetches weekly report slip
router.get('/weekly', getWeeklyEvaluation);

// POST /api/evaluations/save -> archives weekly evaluation slip
router.post('/save', saveWeeklyEvaluation);

// GET /api/evaluations/history -> lists archived evaluations for a streamer
router.get('/history', getWeeklyEvaluationHistory);

// POST /api/evaluations/chat -> chat with AI growth analyst about metrics
router.post('/chat', chatWeeklyEvaluation);

export default router;

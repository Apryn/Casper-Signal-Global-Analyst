import express from 'express';
import {
  getSchedules,
  addSchedule,
  updateSchedule,
  deleteSchedule
} from '../controllers/schedule.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSchedules);
router.post('/', addSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);

export default router;

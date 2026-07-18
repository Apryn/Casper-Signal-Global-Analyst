import express from 'express';
import {
  getReports,
  simulateReportParsing,
  updateReport,
  deleteReport,
  createReport,
  sendTelegramReminder
} from '../controllers/report.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Fetch reports
router.get('/', getReports);

// Create report manually
router.post('/', createReport);

// Simulate / parse report (both endpoints do the same thing)
router.post('/simulate', simulateReportParsing);
router.post('/parse', simulateReportParsing);
router.post('/telegram-reminder', sendTelegramReminder);

// Update details
router.put('/:id', updateReport);

// Delete report (both roles)
router.delete('/:id', deleteReport);

export default router;

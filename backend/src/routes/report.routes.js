import express from 'express';
import {
  getReports,
  simulateReportParsing,
  updateReport,
  deleteReport
} from '../controllers/report.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Fetch reports
router.get('/', getReports);

// Simulate report parsing (useful for copy-pasting reports manually)
router.post('/simulate', simulateReportParsing);

// Update details
router.put('/:id', updateReport);

// Delete report (both roles)
router.delete('/:id', deleteReport);

export default router;

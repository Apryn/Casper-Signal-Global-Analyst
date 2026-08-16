import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  verifyPin,
  changePin,
  getProfiles,
  upsertProfile,
  deleteProfile,
  syncStreamersToProfiles,
  getPeriods,
  getPeriodDetail,
  createPeriod,
  updateItem,
  bulkUpdateStatus,
  deletePeriod,
  getCashSummary,
  getTransactions,
  createTransaction,
  deleteTransaction
} from '../controllers/finance.controller.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// 1. PIN Security
router.post('/verify-pin', verifyPin);
router.post('/change-pin', changePin);

// 2. Payroll Profiles
router.get('/profiles', getProfiles);
router.post('/profiles', upsertProfile);
router.delete('/profiles/:id', deleteProfile);
router.post('/profiles/sync', syncStreamersToProfiles);

// 3. Payroll Periods & Items
router.get('/periods', getPeriods);
router.get('/periods/:id', getPeriodDetail);
router.post('/periods', createPeriod);
router.delete('/periods/:id', deletePeriod);
router.put('/items/:id', updateItem);
router.post('/periods/bulk-status', bulkUpdateStatus);

// 4. Cash Transactions & Expenses
router.get('/cash/summary', getCashSummary);
router.get('/cash/transactions', getTransactions);
router.post('/cash/transactions', createTransaction);
router.delete('/cash/transactions/:id', deleteTransaction);

export default router;

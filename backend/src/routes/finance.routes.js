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
  deleteTransaction,
  getPenaltyAudit,
  saveSalaryAdjustment,
  toggleDailyExcusedStatus,
  updateDailyLiveDuration,
  toggleStreamerVerification,
  getFinanceRules,
  updateFinanceRules,
  syncAuditToPeriod
} from '../controllers/finance.controller.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// 1. PIN Security
router.post('/verify-pin', verifyPin);
router.post('/change-pin', changePin);

// 2. Finance Rules & SOP Rates Settings
router.get('/rules', getFinanceRules);
router.post('/rules', updateFinanceRules);

// 2b. Automated Penalty & Salary Audit
router.get('/penalty-audit', getPenaltyAudit);
router.post('/penalty-audit/adjust', saveSalaryAdjustment);
router.post('/penalty-audit/toggle-excuse', toggleDailyExcusedStatus);
router.post('/penalty-audit/update-duration', updateDailyLiveDuration);
router.post('/penalty-audit/toggle-verify', toggleStreamerVerification);

// 3. Payroll Profiles
router.get('/profiles', getProfiles);
router.post('/profiles', upsertProfile);
router.delete('/profiles/:id', deleteProfile);
router.post('/profiles/sync', syncStreamersToProfiles);

// 4. Payroll Periods & Items
router.get('/periods', getPeriods);
router.get('/periods/:id', getPeriodDetail);
router.post('/periods', createPeriod);
router.post('/periods/:id/sync-audit', syncAuditToPeriod);
router.delete('/periods/:id', deletePeriod);
router.put('/items/:id', updateItem);
router.post('/periods/bulk-status', bulkUpdateStatus);

// 5. Cash Transactions & Expenses
router.get('/cash/summary', getCashSummary);
router.get('/cash/transactions', getTransactions);
router.post('/cash/transactions', createTransaction);
router.delete('/cash/transactions/:id', deleteTransaction);

export default router;

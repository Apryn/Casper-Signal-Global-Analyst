import express from 'express';
import { getAllAccounts, getStreamerAccounts, addAccount, updateAccount, deleteAccount } from '../controllers/account.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// Accounts management
router.get('/', getAllAccounts);
router.get('/streamers/:id/accounts', getStreamerAccounts);
router.post('/streamers/:id/accounts', addAccount);
router.put('/accounts/:accountId', updateAccount);
router.delete('/accounts/:accountId', deleteAccount);

export default router;

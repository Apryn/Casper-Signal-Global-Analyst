import express from 'express';
import { getStreamerAccounts, addAccount, deleteAccount } from '../controllers/account.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// Accounts management
router.get('/streamers/:id/accounts', getStreamerAccounts);
router.post('/streamers/:id/accounts', addAccount);
router.delete('/accounts/:accountId', deleteAccount);

export default router;

import express from 'express';
import { login, getMe } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public: login with activation code
router.post('/login', login);

// Protected: get current user info
router.get('/me', authenticateToken, getMe);

export default router;

import express from 'express';
import { login, register, getMe } from '../controllers/auth.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Admin-only route to register new accounts (or for creating additional users)
router.post('/register', authenticateToken, authorizeRoles('Admin'), register);

// Protected routes
router.get('/me', authenticateToken, getMe);

export default router;

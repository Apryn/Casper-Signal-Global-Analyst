import express from 'express';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getNotifications);

// Must come BEFORE /:id/read to prevent "all" being matched as an ID
router.put('/all/read', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);

export default router;

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from './notification.controller';

const router = Router();

// All notification endpoints require authentication
router.use(authenticate);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);

export default router;

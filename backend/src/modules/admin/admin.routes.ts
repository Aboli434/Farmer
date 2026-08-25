import { Router } from 'express';
import { AdminController } from './admin.controller';
import { AdminAuditController } from './admin.audit.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { getVerificationsQuerySchema, rejectVerificationSchema } from './admin.validation';
import { Role } from '@prisma/client';

const router = Router();

// All routes require ADMIN role
router.use(authenticate, requireRole([Role.ADMIN]));

router.get(
  '/verifications',
  validateRequest(getVerificationsQuerySchema),
  AdminController.getVerifications
);

router.get(
  '/verifications/:id',
  AdminController.getVerificationById
);

router.post(
  '/verifications/:id/approve',
  AdminController.approveVerification
);

router.post(
  '/verifications/:id/reject',
  validateRequest(rejectVerificationSchema),
  AdminController.rejectVerification
);

router.post(
  '/producers/:id/suspend',
  AdminController.suspendProducer
);

// Product Moderation
router.get('/products', AdminController.getProducts);
router.post('/products/:id/approve', AdminController.approveProduct);
router.post('/products/:id/reject', AdminController.rejectProduct);

import { AdminDashboardController } from './admin.dashboard.controller';

// Audit Logs (Read-only)
router.get('/audit-logs', AdminAuditController.getAuditLogs);

// Dashboard
router.get('/dashboard/summary', AdminDashboardController.getSummary);
router.get('/dashboard/alerts', AdminDashboardController.getAlerts);

import { AdminOrderController } from './admin.order.controller';

// Orders
router.get('/orders', AdminOrderController.getOrders);
router.post('/orders/:id/force-cancel', AdminOrderController.forceCancelOrder);

export default router;

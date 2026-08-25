import { Router } from 'express';
import { getCustomerOrders, getCustomerOrderDetails, cancelSellerOrder, getReviewableItems } from './order.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Base path: /api/orders
// All routes require authentication
router.use(authenticate);

// Get reviewable order items
router.get('/reviewable-items', requireRole([Role.CUSTOMER]), getReviewableItems);

// Get customer orders (List);
router.get('/', getCustomerOrders);
router.get('/:id', getCustomerOrderDetails);
router.post('/:id/seller-orders/:sellerOrderId/cancel', cancelSellerOrder);

export default router;

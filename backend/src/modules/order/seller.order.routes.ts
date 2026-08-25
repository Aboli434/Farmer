import { Router } from 'express';
import { authenticate, requireRole, requireActiveSeller } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { getSellerOrders, getSellerOrderDetails, updateSellerOrderStatus } from './seller.order.controller';
import { updateOrderStatusSchema } from './order.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRole([Role.SELLER]));

router.get('/', getSellerOrders);
router.get('/:id', getSellerOrderDetails);
router.patch('/:id/status', requireActiveSeller, validateRequest(updateOrderStatusSchema), updateSellerOrderStatus);

export default router;

import { Router } from 'express';
import { CartController } from './cart.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { upsertCartItemSchema } from './cart.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRole([Role.CUSTOMER]));

router.get('/', CartController.getCart);
router.post('/items', validateRequest(upsertCartItemSchema), CartController.upsertItem);
router.delete('/items/:variantId', CartController.removeItem);
router.delete('/', CartController.clearCart);

export default router;

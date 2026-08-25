import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { authenticate, requireActiveSeller } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { updateInventorySchema } from './inventory.validation';

const router = Router();

// Protected Routes (SELLER only)
router.use(authenticate, requireActiveSeller);

router.patch(
  '/:variantId',
  validateRequest(updateInventorySchema),
  InventoryController.updateInventory
);

router.get(
  '/:variantId/history',
  InventoryController.getInventoryHistory
);

export default router;

import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate, requireSeller } from '../../middleware/auth.middleware';

const router = Router();

// Dashboard routes are protected for SELLER only
router.use(authenticate, requireSeller);

router.get('/summary', DashboardController.getDashboardSummary);

export default router;

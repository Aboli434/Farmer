import { Router } from 'express';
import { AuthController } from './auth.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/send-otp', asyncHandler(AuthController.sendOtp));
router.post('/verify-otp', asyncHandler(AuthController.verifyOtp));
router.post('/logout', authenticate, asyncHandler(AuthController.logout));
router.post('/logout-all', authenticate, asyncHandler(AuthController.logoutAll));
router.get('/me', authenticate, asyncHandler(AuthController.getMe));

export default router;

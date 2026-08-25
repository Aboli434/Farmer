import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  sendOtpSchema,
  verifyOtpSchema,
} from './auth.validation';
import { otpSendLimiter, otpVerifyLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';

const router = Router();

router.post(
  '/send-otp',
  otpSendLimiter,
  validateRequest(sendOtpSchema),
  asyncHandler(AuthController.sendOtp)
);

router.post(
  '/verify-otp',
  otpVerifyLimiter,
  validateRequest(verifyOtpSchema),
  asyncHandler(AuthController.verifyOtp)
);

router.post('/logout', authenticate, asyncHandler(AuthController.logout));
router.post('/logout-all', authenticate, asyncHandler(AuthController.logoutAll));
router.get('/me', authenticate, asyncHandler(AuthController.getMe));

export default router;

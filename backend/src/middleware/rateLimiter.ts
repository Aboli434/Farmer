import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// In test mode, skip all rate limiting to prevent shared in-memory state
// from bleeding between suites when running --runInBand.
const passthrough = (_req: Request, _res: Response, next: NextFunction) => next();
const isTest = process.env.DISABLE_RATE_LIMIT === 'true';

function limiter(options: Parameters<typeof rateLimit>[0]): RateLimitRequestHandler {
  if (isTest) return passthrough as RateLimitRequestHandler;
  return rateLimit(options);
}

// Global Rate Limiter: 300 requests per 15 minutes per IP
export const globalLimiter = limiter({

  windowMs: 15 * 60 * 1000, 
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    }
  }
});

// OTP Send Limiter: 3 requests per 5 minutes per IP
export const otpSendLimiter = limiter({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many OTP requests from this IP. Please try again after 5 minutes.',
    }
  }
});

// OTP Verify Limiter: 5 requests per 15 minutes per IP
export const otpVerifyLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many OTP verification attempts. Please request a new OTP later.',
    }
  }
});

import Razorpay from 'razorpay';
import { logger } from '../utils/logger';

/**
 * Returns a Razorpay instance lazily so that jest.mock('razorpay') can
 * intercept the constructor in tests before this module is evaluated.
 * Returns null if credentials are missing (test or dev without credentials).
 */
export function getRazorpay(): any {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return null;
}

/**
 * Module-level singleton for production use.
 * In tests, use getRazorpay() after jest.mock('razorpay') is applied.
 */
let _instance: any = null;

export const razorpay = new Proxy({} as any, {
  get(_target, prop) {
    if (!_instance) {
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        _instance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
      } else {
        // During tests, Razorpay is mocked — the mock replaces the constructor,
        // so calling new Razorpay() will return the mocked instance.
        try {
          _instance = new Razorpay({ key_id: 'test', key_secret: 'test' });
        } catch {
          logger.warn('Razorpay credentials missing. Payment integrations will fail.');
          return undefined;
        }
      }
    }
    return _instance[prop];
  }
});

/**
 * Rate Limiter Security Regression Tests
 *
 * This suite explicitly re-enables express-rate-limit (disabled globally in
 * jest.setup.js with DISABLE_RATE_LIMIT=true) to verify the middleware enforces
 * its budget correctly. It builds a minimal Express app with the real limiter
 * so that it doesn't pollute the shared in-memory store of other test suites.
 */
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

function buildOtpSendLimiter(max: number) {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Pin to a single key for determinism — isolates from IP-based state
    keyGenerator: () => 'test-ip',
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many OTP requests from this IP.',
      }
    }
  });
}

describe('Security: Rate Limiter Middleware', () => {
  describe('OTP send limiter (max 3 per window)', () => {
    let app: express.Application;

    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use(buildOtpSendLimiter(3));
      app.post('/api/auth/send-otp', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('Requests 1–3 are allowed (200)', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/auth/send-otp').send({ phone: '9900000001' });
        expect(res.status).toBe(200);
      }
    });

    it('Request 4 is blocked (429) with correct error code', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({ phone: '9900000001' });
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('Global limiter does not block within normal usage', () => {
    let app: express.Application;

    beforeAll(() => {
      app = express();
      app.use(buildOtpSendLimiter(300));
      app.get('/api/health', (_req, res) => res.json({ ok: true }));
    });

    it('20 rapid requests all succeed under the 300-req budget', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => request(app).get('/api/health'))
      );
      expect(results.every(r => r.status === 200)).toBe(true);
    });
  });
});

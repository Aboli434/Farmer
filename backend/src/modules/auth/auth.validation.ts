import { z } from 'zod';

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
    name: z.string().min(2).max(100).optional(), // Used if the user needs to be created
  }),
});

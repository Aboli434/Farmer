import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { generateOtp, hashOtp, verifyOtpHash } from '../../utils/otp';
import { Role } from '@prisma/client';
import { env } from '../../config/env';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export class AuthService {
  static async sendOtp(phone: string) {
    // Check for cooldown
    const existingOtp = await prisma.otpVerification.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    if (existingOtp) {
      const secondsSinceLastOtp = (new Date().getTime() - existingOtp.createdAt.getTime()) / 1000;
      if (secondsSinceLastOtp < RESEND_COOLDOWN_SECONDS) {
        throw new ApiError(429, 'RATE_LIMIT', `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLastOtp)} seconds before requesting another OTP.`);
      }
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate old OTPs for this phone by deleting them (or we can just let them expire, but deleting is cleaner)
    await prisma.otpVerification.deleteMany({
      where: { phone }
    });

    await prisma.otpVerification.create({
      data: {
        phone,
        otpHash,
        expiresAt,
      },
    });

    // DEV ONLY: Log OTP to terminal
    if (env.NODE_ENV !== 'production') {
      console.log(`\n============================`);
      console.log(`🔑 DEV OTP for ${phone}: ${otp}`);
      console.log(`============================\n`);
    } else {
      // TODO: Integrate real SMS provider here (e.g. Twilio, AWS SNS, Msg91)
    }

    return { message: 'OTP sent successfully.' };
  }

  static async verifyOtp(phone: string, otp: string, name?: string) {
    const otpRecord = await prisma.otpVerification.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new ApiError(400, 'INVALID_OTP', 'No OTP request found for this number.');
    }

    if (otpRecord.verifiedAt) {
      throw new ApiError(400, 'INVALID_OTP', 'OTP has already been used.');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new ApiError(400, 'EXPIRED_OTP', 'OTP has expired. Please request a new one.');
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      throw new ApiError(429, 'MAX_ATTEMPTS', 'Maximum verification attempts reached. Please request a new OTP.');
    }

    const isValid = await verifyOtpHash(otp, otpRecord.otpHash);

    if (!isValid) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      throw new ApiError(400, 'INVALID_OTP', 'Incorrect OTP.');
    }

    // Mark OTP as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      if (!name) {
        throw new ApiError(400, 'NAME_REQUIRED', 'Name is required for new user registration.');
      }
      user = await prisma.user.create({
        data: {
          phone,
          name,
          role: Role.CUSTOMER,
        },
      });
    }

    // Create a new session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt,
      },
    });

    return { user, session };
  }

  static async logout(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  static async logoutAll(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    return user;
  }
}

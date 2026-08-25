import crypto from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Generates a 6-digit numeric OTP
 */
export const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hashes an OTP string
 */
export const hashOtp = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, SALT_ROUNDS);
};

/**
 * Verifies an OTP against a hash
 */
export const verifyOtpHash = async (otp: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(otp, hash);
};

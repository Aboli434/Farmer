import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  sessionId: string;
}

const JWT_SECRET = env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-prod';
const JWT_EXPIRES_IN = '7d';

/**
 * Signs a JWT with the user ID and session ID
 */
export const signJwt = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verifies a JWT and extracts the payload
 */
export const verifyJwt = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

/**
 * Sets the JWT as an HttpOnly cookie
 */
export const setSessionCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
};

/**
 * Clears the HttpOnly cookie
 */
export const clearSessionCookie = (res: Response) => {
  res.clearCookie('token');
};

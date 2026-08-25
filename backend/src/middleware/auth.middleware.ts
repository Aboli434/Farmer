import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/session';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
  };
  sessionId?: string;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication token is missing.'));
    }

    const payload = verifyJwt(token);

    // Verify session in DB
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Session is invalid or expired.'));
    }

    // Update last used at asynchronously
    prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    }).catch(err => console.error('Failed to update session lastUsedAt', err));

    req.user = {
      id: session.user.id,
      role: session.user.role,
    };
    req.sessionId = session.id;

    next();
  } catch (error) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token.'));
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    next();
  };
};

export const requireAdmin = requireRole([Role.ADMIN]);
export const requireSeller = requireRole([Role.SELLER]);

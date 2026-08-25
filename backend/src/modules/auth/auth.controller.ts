import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { sendOtpSchema, verifyOtpSchema } from './auth.validation';
import { signJwt, setSessionCookie, clearSessionCookie } from '../../utils/session';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { ApiError } from '../../utils/ApiError';

export class AuthController {
  static async sendOtp(req: Request, res: Response) {
    const { body } = sendOtpSchema.parse(req);
    const result = await AuthService.sendOtp(body.phone);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  static async verifyOtp(req: Request, res: Response) {
    const { body } = verifyOtpSchema.parse(req);
    const { user, session } = await AuthService.verifyOtp(body.phone, body.otp, body.name);

    // Create JWT containing userId and sessionId
    const token = signJwt({
      userId: user.id,
      sessionId: session.id,
    });

    // Set HttpOnly Cookie
    setSessionCookie(res, token);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
        },
      },
    });
  }

  static async logout(req: AuthenticatedRequest, res: Response) {
    if (req.sessionId) {
      await AuthService.logout(req.sessionId);
    }
    
    clearSessionCookie(res);
    
    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
  }

  static async logoutAll(req: AuthenticatedRequest, res: Response) {
    if (req.user?.id) {
      await AuthService.logoutAll(req.user.id);
    }
    
    clearSessionCookie(res);
    
    res.status(200).json({
      success: true,
      data: { message: 'Logged out from all devices successfully.' },
    });
  }

  static async getMe(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.id) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');
    }

    const user = await AuthService.getMe(req.user.id);
    
    res.status(200).json({
      success: true,
      data: { user },
    });
  }
}

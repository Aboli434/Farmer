import { Request, Response, NextFunction } from 'express';
import { ProducerService } from './producer.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class ProducerController {
  static async apply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = req.body;
      const result = await ProducerService.apply(userId, data);
      
      res.status(201).json({
        success: true,
        message: 'Producer application submitted successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await ProducerService.getProfile(userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = req.body;
      const result = await ProducerService.updateProfile(userId, data);
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async resubmitVerification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await ProducerService.resubmit(userId);
      
      res.status(200).json({
        success: true,
        message: 'Application resubmitted successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

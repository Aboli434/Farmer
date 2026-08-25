import { Request, Response, NextFunction } from 'express';
import { AddressService } from './address.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AddressController {
  static async createAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const address = await AddressService.createAddress(req.user!.id, req.body);
      res.status(201).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  static async getUserAddresses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const addresses = await AddressService.getUserAddresses(req.user!.id);
      res.status(200).json({ success: true, data: addresses });
    } catch (error) {
      next(error);
    }
  }

  static async updateAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const address = await AddressService.updateAddress(req.user!.id, req.params.id as string, req.body);
      res.status(200).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await AddressService.deleteAddress(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

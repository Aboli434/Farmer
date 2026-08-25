import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { SellerOrderService } from './seller.order.service';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { OrderStatus } from '@prisma/client';

// Helper to get producer profile
const getProducerId = async (userId: string) => {
  const profile = await prisma.producerProfile.findUnique({
    where: { userId }
  });
  if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found');
  return profile.id;
};

export const getSellerOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const producerId = await getProducerId(req.user!.id);
    const orders = await SellerOrderService.getSellerOrders(producerId);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

export const getSellerOrderDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const producerId = await getProducerId(req.user!.id);
    const order = await SellerOrderService.getSellerOrderDetails(req.params.id as string, producerId);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const updateSellerOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const producerId = await getProducerId(req.user!.id);
    const { status } = req.body;
    
    // Status should be one of OrderStatus, validated by schema route, but we double check here
    const updated = await SellerOrderService.updateSellerOrderStatus(req.params.id as string, producerId, status as OrderStatus);
    
    res.json({
      success: true,
      message: 'Status updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

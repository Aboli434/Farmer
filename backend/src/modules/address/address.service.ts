import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

export class AddressService {
  static async createAddress(userId: string, data: any) {
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const count = await prisma.address.count({ where: { userId } });
    if (count === 0 && data.isDefault !== false) {
      data.isDefault = true;
    }

    return await prisma.address.create({
      data: {
        userId,
        ...data
      }
    });
  }

  static async getUserAddresses(userId: string) {
    return await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  static async updateAddress(userId: string, addressId: string, data: any) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId }
    });

    if (!address) {
      throw new ApiError(404, 'NOT_FOUND', 'Address not found');
    }

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false }
      });
    }

    return await prisma.address.update({
      where: { id: addressId },
      data
    });
  }

  static async deleteAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId }
    });

    if (!address) {
      throw new ApiError(404, 'NOT_FOUND', 'Address not found');
    }

    await prisma.address.delete({
      where: { id: addressId }
    });

    if (address.isDefault) {
      const nextAddress = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (nextAddress) {
        await prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true }
        });
      }
    }

    return { success: true };
  }
}

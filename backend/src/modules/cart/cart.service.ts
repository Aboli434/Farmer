import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

export class CartService {
  static async getCart(userId: string) {
    const cart = await prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    producer: {
                      select: { id: true, farmName: true }
                    }
                  }
                },
                inventory: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!cart) {
      return { items: [], groupedByProducer: [] };
    }

    // Group by producer
    const grouped: any = {};
    for (const item of cart.items) {
      const producer = item.variant.product.producer;
      if (!grouped[producer.id]) {
        grouped[producer.id] = {
          producerId: producer.id,
          farmName: producer.farmName,
          items: []
        };
      }
      grouped[producer.id].items.push({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        label: item.variant.label,
        price: item.variant.price,
        unit: item.variant.unit,
        productName: item.variant.product.name,
        availableStock: item.variant.inventory?.availableQuantity || 0
      });
    }

    return {
      cartId: cart.id,
      items: cart.items,
      groupedByProducer: Object.values(grouped)
    };
  }

  static async upsertItem(userId: string, variantId: string, quantity: number) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId, deletedAt: null },
      include: { inventory: true, product: true }
    });

    if (!variant || variant.product.status !== 'ACTIVE' || variant.product.deletedAt) {
      throw new ApiError(404, 'NOT_FOUND', 'Product variant not available');
    }

    // Validate Unit rules (e.g. piece must be integer)
    if (variant.unit.toLowerCase() === 'piece' || variant.unit.toLowerCase() === 'pcs') {
      if (!Number.isInteger(quantity)) {
        throw new ApiError(400, 'BAD_REQUEST', `Quantity must be an integer for unit ${variant.unit}`);
      }
    }

    // Ensure stock is available
    if (Number(variant.inventory?.availableQuantity || 0) < quantity) {
      throw new ApiError(400, 'BAD_REQUEST', 'Requested quantity exceeds available stock');
    }

    // Find or create cart
    let cart = await prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId }
      });
    }

    // Upsert CartItem
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_variantId: { cartId: cart.id, variantId }
      }
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity
        }
      });
    }

    return await this.getCart(userId);
  }

  static async removeItem(userId: string, variantId: string) {
    const cart = await prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' }
    });

    if (!cart) return;

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, variantId }
    });

    return await this.getCart(userId);
  }

  static async clearCart(userId: string) {
    const cart = await prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' }
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      });
    }

    return { items: [], groupedByProducer: [] };
  }
}

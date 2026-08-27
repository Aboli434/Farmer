import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { InventoryService } from '../inventory/inventory.service';
import { razorpay } from '../../config/razorpay';
import { logger } from '../../utils/logger';

export class CheckoutService {
  static async initiateCheckout(userId: string, addressId: string, idempotencyKey: string) {
    // 1. Idempotency Check
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { order: true }
    });
    if (existingPayment) {
      return existingPayment;
    }

    // 2. Address Check
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId }
    });
    if (!address) throw new ApiError(404, 'NOT_FOUND', 'Address not found');

    // 3. Cart Validation
    const cart = await prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: {
        items: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new ApiError(400, 'BAD_REQUEST', 'Cart is empty');
    }

    // 4. Create Razorpay Order BEFORE starting the DB transaction
    //    (external API calls must never be inside a Prisma interactive transaction)
    let providerOrderId: string;
    let razorpayOrderAmount: number | undefined;
    let razorpayOrderCurrency: string | undefined;

    if (!razorpay) {
      throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Payment gateway is not configured');
    }

    // Pre-calculate total to create Razorpay order
    let preTotal = 0;
    for (const item of cart.items) {
      preTotal += Number(item.variant.price) * Number(item.quantity);
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(preTotal * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    providerOrderId = razorpayOrder.id;
    razorpayOrderAmount = razorpayOrder.amount;
    razorpayOrderCurrency = razorpayOrder.currency;

    // 5. TRANSACTIONAL CHECKOUT — DB only, no external calls
    // Wrapped in a retry loop: Serializable transactions can conflict under
    // concurrent load. On conflict (P2034), we retry the whole transaction.
    // On retry, the second checkout reads real stock (0kg) and gets a genuine
    // 400 from the stock check — proving the business invariant, not masking a DB error.
    const MAX_CHECKOUT_RETRIES = 3;
    let lastCheckoutErr: any;

    for (let attempt = 1; attempt <= MAX_CHECKOUT_RETRIES; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const groupedItems: any = {};
          let totalOrderAmount = 0;
          const reservationIds: string[] = [];

          for (const item of cart.items) {
            // Reserve inventory within the SAME transaction
            const reservation = await InventoryService.reserveInventory(item.variantId, userId, Number(item.quantity), tx);
            reservationIds.push(reservation.id);

            const producerId = item.variant.product.producerId;
            if (!groupedItems[producerId]) {
              groupedItems[producerId] = { subtotal: 0, items: [] };
            }

            const unitPrice = Number(item.variant.price);
            const quantity = Number(item.quantity);
            const totalPrice = unitPrice * quantity;

            groupedItems[producerId].subtotal += totalPrice;
            totalOrderAmount += totalPrice;

            groupedItems[producerId].items.push({
              variantId: item.variantId,
              quantity,
              unitPrice,
              totalPrice,
              productNameSnapshot: item.variant.product.name,
              variantLabelSnapshot: item.variant.label,
              unit: item.variant.unit
            });
          }

          // Create Master Order
          const order = await tx.order.create({
            data: {
              userId,
              shippingAddressSnapshot: address as any,
              totalAmount: totalOrderAmount
            }
          });

          // Create Seller Orders
          for (const [producerId, group] of Object.entries(groupedItems)) {
            const groupData = group as any;
            const producer = await tx.producerProfile.findUnique({ where: { id: producerId } });
            
            const sellerOrder = await tx.sellerOrder.create({
              data: {
                orderId: order.id,
                producerId,
                producerNameSnapshot: producer!.farmName,
                status: 'PENDING',
                subtotal: groupData.subtotal,
                deliveryFee: 0,
                totalAmount: groupData.subtotal
              }
            });

            for (const item of groupData.items) {
              await tx.orderItem.create({
                data: {
                  sellerOrderId: sellerOrder.id,
                  variantId: item.variantId,
                  productNameSnapshot: item.productNameSnapshot,
                  variantLabelSnapshot: item.variantLabelSnapshot,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice
                }
              });
            }
          }

          const payment = await tx.payment.create({
            data: {
              orderId: order.id,
              provider: 'RAZORPAY',
              providerOrderId,
              idempotencyKey,
              amount: totalOrderAmount,
              status: 'PENDING'
            }
          });

          return { payment, providerOrderId, razorpayOrderAmount, razorpayOrderCurrency };
        }, { timeout: 15000, isolationLevel: 'Serializable' });

      } catch (err: any) {
        // P2034 = serialization failure — safe to retry the whole checkout
        const isConflict = err?.code === 'P2034'
          || err?.message?.includes('write conflict')
          || err?.message?.includes('deadlock');

        if (isConflict && attempt < MAX_CHECKOUT_RETRIES) {
          lastCheckoutErr = err;
          await new Promise(r => setTimeout(r, attempt * 50));
          continue;
        }
        // Re-throw: genuine errors (stock exhausted as ApiError 400, or final conflict)
        throw err;
      }
    }
    throw lastCheckoutErr;
  }

  // Handle frontend callback specifically for payment verification (Optional/UI-only step, real work done by webhook)
  static async verifyPaymentSignature(providerOrderId: string, providerPaymentId: string, providerSignature: string) {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Payment gateway misconfigured');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(providerOrderId + '|' + providerPaymentId)
      .digest('hex');

    if (expectedSignature !== providerSignature) {
      throw new ApiError(400, 'BAD_REQUEST', 'Invalid payment signature');
    }

    // Don't update status to SUCCESS here! 
    // Razorpay best practices: Let the webhook handle internal state mutations for reliability.
    // We just store the signature details for auditing/verification.
    await prisma.payment.update({
      where: { providerOrderId },
      data: {
        providerPaymentId,
        providerSignature
      }
    });

    return true;
  }

  static async handleWebhook(providerOrderId: string, status: 'SUCCESS' | 'FAILURE') {
    const payment = await prisma.payment.findUnique({
      where: { providerOrderId },
      include: {
        order: {
          include: { sellerOrders: true }
        }
      }
    });

    if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
    if (payment.status !== 'PENDING') return payment; // Idempotency check

    return await prisma.$transaction(async (tx) => {
      if (status === 'SUCCESS') {
        const providerPaymentId = `MOCK_PAY_${Date.now()}`;
        
        // Update payment & order status
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', providerPaymentId }
        });

        for (const so of payment.order.sellerOrders) {
          await tx.sellerOrder.update({
            where: { id: so.id },
            data: { status: 'CONFIRMED' }
          });
        }

        // Get cart to identify variants reserved
        const cart = await tx.cart.findFirst({
          where: { userId: payment.order.userId, status: 'ACTIVE' },
          include: { items: true }
        });

        if (cart) {
          // Confirm reservations
          for (const item of cart.items) {
            // Find active reservation for this user and variant
            const reservation = await tx.inventoryReservation.findFirst({
              where: {
                userId: payment.order.userId,
                inventory: { variantId: item.variantId },
                status: 'RESERVED'
              },
              orderBy: { createdAt: 'desc' }
            });

            if (reservation) {
              await InventoryService.confirmInventory(reservation.id, tx);
            }
          }

          // Clear cart
          await tx.cart.update({
            where: { id: cart.id },
            data: { status: 'CONVERTED' }
          });
        }

        return updatedPayment;

      } else {
        // FAILURE
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' }
        });

        for (const so of payment.order.sellerOrders) {
          await tx.sellerOrder.update({
            where: { id: so.id },
            data: { status: 'CANCELLED' }
          });
        }

        // Get cart to identify variants reserved
        const cart = await tx.cart.findFirst({
          where: { userId: payment.order.userId, status: 'ACTIVE' },
          include: { items: true }
        });

        if (cart) {
          // Release reservations
          for (const item of cart.items) {
            const reservation = await tx.inventoryReservation.findFirst({
              where: {
                userId: payment.order.userId,
                inventory: { variantId: item.variantId },
                status: 'RESERVED'
              },
              orderBy: { createdAt: 'desc' }
            });

            if (reservation) {
              await InventoryService.releaseInventory(reservation.id, tx);
            }
          }
        }

        return updatedPayment;
      }
    });
  }
}

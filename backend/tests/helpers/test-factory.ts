import { prisma } from '../../src/config/prisma';
import bcrypt from 'bcrypt';
import { Role, ProductType, OrderStatus, PaymentStatus } from '@prisma/client';
import crypto from 'crypto';

export class TestFactory {
  /**
   * Generates a realistic 10-digit phone number.
   * Format: 99 + 8 random digits to avoid hitting duplicate constraints across suites.
   */
  static generatePhone(): string {
    const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
    return `99${random8}`;
  }

  static generateEmail(): string {
    return `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  }

  static generateSlug(base: string): string {
    return `test-${base}-${crypto.randomUUID().slice(0, 8)}`;
  }

  /**
   * Create a Customer User with OTP verified
   */
  static async createCustomer(overrides?: { phone?: string; name?: string }) {
    const phone = overrides?.phone || this.generatePhone();
    const user = await prisma.user.create({
      data: {
        name: overrides?.name || 'Test Customer',
        phone,
        role: Role.CUSTOMER,
      }
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000)
      }
    });

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        fullName: 'Test Customer',
        phone,
        address: '123 Main St',
        pincode: '411001',
        city: 'Pune',
        district: 'Pune',
        state: 'MH'
      }
    });

    return { user, session, address };
  }

  /**
   * Create an Admin User
   */
  static async createAdmin(overrides?: { phone?: string; name?: string }) {
    const phone = overrides?.phone || this.generatePhone();
    const user = await prisma.user.create({
      data: {
        name: overrides?.name || 'Test Admin',
        phone,
        role: Role.ADMIN,
      }
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000)
      }
    });

    return { user, session };
  }

  /**
   * Create a Verified Seller User with Profile
   */
  static async createSeller(overrides?: { phone?: string; email?: string; farmName?: string }) {
    const phone = overrides?.phone || this.generatePhone();
    const email = overrides?.email || this.generateEmail();
    const farmName = overrides?.farmName || `Test Farm ${crypto.randomUUID().slice(0, 4)}`;

    const user = await prisma.user.create({
      data: {
        name: 'Test Seller',
        phone,
        email,
        role: Role.SELLER,
      }
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000)
      }
    });

    const profile = await prisma.producerProfile.create({
      data: {
        userId: user.id,
        farmName,
        story: 'A great farm story',
        addressLine: '123 Farm Rd',
        city: 'Pune',
        district: 'Pune',
        state: 'MH',
        pincode: '411001'
      }
    });

    const verification = await prisma.producerVerification.create({
      data: {
        producerId: profile.id,
        status: 'APPROVED',
        documents: []
      }
    });

    return { user, session, profile, verification };
  }

  /**
   * Create a Category
   */
  static async createCategory(baseName: string) {
    const uniqueName = `${baseName} ${crypto.randomUUID().slice(0, 4)}`;
    return await prisma.category.create({
      data: {
        name: uniqueName,
        slug: this.generateSlug(baseName.toLowerCase().replace(/\s+/g, '-')),
      }
    });
  }

  /**
   * Create an Active Product with Variant and Inventory
   */
  static async createProduct(
    producerId: string, 
    categoryId: string, 
    overrides?: { name?: string; price?: number; quantity?: number; unit?: string }
  ) {
    const name = overrides?.name || 'Test Product';
    
    const product = await prisma.product.create({
      data: {
        producerId,
        categoryId,
        name,
        description: 'Description',
        slug: this.generateSlug(name.toLowerCase().replace(/\s+/g, '-')),
        productType: ProductType.PROCESSED_FOOD,
        status: 'ACTIVE'
      }
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        label: '1 kg',
        price: overrides?.price || 100,
        unit: overrides?.unit || 'kg',
        quantity: overrides?.quantity || 1
      }
    });

    const inventory = await prisma.inventory.create({
      data: {
        variantId: variant.id,
        availableQuantity: overrides?.quantity || 100,
        lowStockThreshold: 5
      }
    });

    return { product, variant, inventory };
  }

  /**
   * Create a basic Order setup for testing
   */
  static async createTestOrder(
    customerId: string,
    sellerId: string,
    variantId: string,
    overrides?: { quantity?: number; amount?: number }
  ) {
    const qty = overrides?.quantity || 1;
    const amount = overrides?.amount || 100;
    
    // First, reserve inventory
    await prisma.inventoryReservation.create({
      data: {
        inventoryId: (await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).id,
        userId: customerId,
        quantity: qty,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        status: 'CONFIRMED'
      }
    });

    // Create Master Order
    const order = await prisma.order.create({
      data: {
        userId: customerId,
        shippingAddressSnapshot: { address: 'Test 123' },
        totalAmount: amount
      }
    });

    // Create Seller Order
    const profile = await prisma.producerProfile.findUniqueOrThrow({ where: { userId: sellerId } });
    const sellerOrder = await prisma.sellerOrder.create({
      data: {
        orderId: order.id,
        producerId: profile.id,
        producerNameSnapshot: profile.farmName,
        status: OrderStatus.CONFIRMED,
        subtotal: amount,
        totalAmount: amount,
      }
    });

    // Create Order Item
    await prisma.orderItem.create({
      data: {
        sellerOrderId: sellerOrder.id,
        variantId,
        productNameSnapshot: 'Test Product',
        variantLabelSnapshot: '1 kg',
        quantity: qty,
        unit: 'kg',
        unitPrice: amount,
        totalPrice: amount,
      }
    });

    return { order, sellerOrder };
  }

  /**
   * Cleanup specific entities (to replace global deleteMany)
   */
  static async cleanupTestData() {
    // Delete in correct order to respect FK constraints
    const testUsers = await prisma.user.findMany({
      where: { phone: { startsWith: '99' } },
      select: { id: true }
    });
    
    const userIds = testUsers.map(u => u.id);
    if (userIds.length === 0) return;

    // 1. Get Profiles
    const profiles = await prisma.producerProfile.findMany({
      where: { userId: { in: userIds } },
      select: { id: true }
    });
    const profileIds = profiles.map(p => p.id);

    // 2. Get Products & Variants
    const products = profileIds.length > 0 ? await prisma.product.findMany({
      where: { producerId: { in: profileIds } },
      select: { id: true }
    }) : [];
    const productIds = products.map(p => p.id);

    const variants = productIds.length > 0 ? await prisma.productVariant.findMany({
      where: { productId: { in: productIds } },
      select: { id: true }
    }) : [];
    const variantIds = variants.map(v => v.id);

    // 3. Get Orders (as customer and as seller)
    const ordersAsCustomer = await prisma.order.findMany({
      where: { userId: { in: userIds } },
      select: { id: true }
    });
    const orderIds = ordersAsCustomer.map(o => o.id);

    const sellerOrders = await prisma.sellerOrder.findMany({
      where: {
        OR: [
          { orderId: { in: orderIds.length > 0 ? orderIds : ['-1'] } },
          { producerId: { in: profileIds.length > 0 ? profileIds : ['-1'] } }
        ]
      },
      select: { id: true, orderId: true }
    });
    
    const sellerOrderIds = sellerOrders.map(so => so.id);
    // Add master orders of these seller orders just in case
    sellerOrders.forEach(so => {
      if (!orderIds.includes(so.orderId)) orderIds.push(so.orderId);
    });

    // --- DELETION PHASE --- //

    // Notifications
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });

    // Inventory Reservations & Transactions
    await prisma.inventoryReservation.deleteMany({ where: { userId: { in: userIds } } });
    if (variantIds.length > 0) {
      await prisma.inventoryReservation.deleteMany({ where: { inventory: { variantId: { in: variantIds } } } });
      await prisma.inventoryTransaction.deleteMany({ where: { inventory: { variantId: { in: variantIds } } } });
      await prisma.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
    }

    // Orders Hierarchy
    if (sellerOrderIds.length > 0) {
      await prisma.refund.deleteMany({ where: { sellerOrderId: { in: sellerOrderIds } } });
      await prisma.orderItem.deleteMany({ where: { sellerOrderId: { in: sellerOrderIds } } });
      await prisma.sellerOrder.deleteMany({ where: { id: { in: sellerOrderIds } } });
    }

    if (orderIds.length > 0) {
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    // Product Hierarchy
    if (variantIds.length > 0) {
      await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    }
    if (productIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }

    // Profile Hierarchy
    if (profileIds.length > 0) {
      await prisma.producerVerification.deleteMany({ where: { producerId: { in: profileIds } } });
      await prisma.producerProfile.deleteMany({ where: { id: { in: profileIds } } });
    }

    // User dependencies
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.otpVerification.deleteMany({ where: { phone: { startsWith: '99' } } });
    
    // Finally Users
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // Clean up test categories
    await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  }
}

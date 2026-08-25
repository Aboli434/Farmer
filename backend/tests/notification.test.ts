import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import bcrypt from 'bcrypt';
import { Role, OrderStatus, NotificationType, PaymentStatus } from '@prisma/client';
import { Server } from 'http';
import { TestFactory } from './helpers/test-factory';
import { signJwt } from '../src/utils/session';

function getCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie[0].split(';')[0];
}

describe('Phase 12 - Notifications', () => {
  let testApp: Server;
  let customerCookie: string;
  let sellerCookie: string;
  let customerId: string;
  let sellerId: string;
  let sellerOrderId: string;

  beforeAll(async () => {
    testApp = app.listen(0);

    // 1. Setup Customer
    const { user: customer, session: customerSession } = await TestFactory.createCustomer();
    customerId = customer.id;
    customerCookie = `token=${signJwt({ userId: customerId, sessionId: customerSession.id })}; Path=/; HttpOnly`;

    // 2. Setup Seller
    const { user: seller, session: sellerSession, profile } = await TestFactory.createSeller();
    sellerId = seller.id;
    sellerCookie = `token=${signJwt({ userId: sellerId, sessionId: sellerSession.id })}; Path=/; HttpOnly`;
    const producerId = profile.id;

    // Create a CONFIRMED order
    const order = await prisma.order.create({
      data: {
        userId: customerId,
        shippingAddressSnapshot: {},
        totalAmount: 100,
        payments: {
          create: {
            amount: 100,
            provider: 'RAZORPAY',
            providerOrderId: `TEST-${Date.now()}`, // Ensure unique
            status: PaymentStatus.SUCCESS
          }
        },
        sellerOrders: {
          create: {
            producerId: producerId,
            producerNameSnapshot: "Seller",
            status: OrderStatus.CONFIRMED,
            subtotal: 100,
            totalAmount: 100,
          }
        }
      },
      include: { sellerOrders: true }
    });

    sellerOrderId = order.sellerOrders[0].id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
    testApp.close();
    await prisma.$disconnect();
  });

  describe('Notification Creation via State Machine', () => {
    it('should create an ORDER_ACCEPTED notification when seller accepts', async () => {
      // Seller accepts order
      const res = await request(testApp)
        .patch(`/api/seller/orders/${sellerOrderId}/status`)
        .set('Cookie', sellerCookie)
        .send({ status: OrderStatus.ACCEPTED });

      expect(res.status).toBe(200);

      // Verify notification in DB
      const notifications = await prisma.notification.findMany({
        where: { userId: customerId, type: NotificationType.ORDER_ACCEPTED }
      });

      expect(notifications.length).toBe(1);
      expect(notifications[0].entityType).toBe('ORDER');
      expect(notifications[0].isRead).toBe(false);
    });
  });

  describe('Notification API', () => {
    let notificationId: string;

    it('should fetch paginated notifications', async () => {
      const res = await request(testApp)
        .get('/api/notifications?page=1&limit=10')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.length).toBe(1);
      expect(res.body.data.pagination.total).toBe(1);
      
      notificationId = res.body.data.notifications[0].id;
    });

    it('should get unread count', async () => {
      const res = await request(testApp)
        .get('/api/notifications/unread-count')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(1);
    });

    it('should mark a notification as read', async () => {
      const res = await request(testApp)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.notification.isRead).toBe(true);
      expect(res.body.data.notification.readAt).not.toBeNull();
    });

    it('unread count should be zero after marking read', async () => {
      const res = await request(testApp)
        .get('/api/notifications/unread-count')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(0);
    });

    it('should securely prevent marking another users notification as read', async () => {
      const res = await request(testApp)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Cookie', sellerCookie);

      expect(res.status).toBe(403);
    });

    it('should mark all as read', async () => {
      // First create an unread notification manually
      await prisma.notification.create({
        data: { userId: customerId, type: NotificationType.ORDER_READY, title: 'Ready', message: 'Ready', isRead: false }
      });

      const res = await request(testApp)
        .post('/api/notifications/read-all')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);

      const countRes = await request(testApp)
        .get('/api/notifications/unread-count')
        .set('Cookie', customerCookie);

      expect(countRes.body.data.unreadCount).toBe(0);
    });
  });
});

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import authRoutes from './modules/auth/auth.routes';
import webhookRoutes from './modules/payment/payment.webhook.routes';
import producerRoutes from './modules/producer/producer.routes';
import producerDiscoveryRoutes from './modules/producer/producer-discovery.routes';
import adminRoutes from './modules/admin/admin.routes';
import productRoutes from './modules/product/product.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import addressRoutes from './modules/address/address.routes';
import cartRoutes from './modules/cart/cart.routes';
import checkoutRoutes from './modules/checkout/checkout.routes';
import orderRoutes from './modules/order/order.routes';
import sellerOrderRoutes from './modules/order/seller.order.routes';
import notificationRoutes from './modules/notification/notification.routes';
import reviewRoutes from './modules/review/review.routes';
import reviewDiscoveryRoutes from './modules/review/review-discovery.routes';
import adminReviewRoutes from './modules/admin/admin.review.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app: Application = express();

// Global Middlewares
app.use(requestIdMiddleware);
app.use(requestLogger);

// Security Headers (Baseline)
app.use(helmet({
  contentSecurityPolicy: false, // Wait until frontend integration to tighten
  hsts: process.env.NODE_ENV === 'production',
}));

// Global Rate Limiting
app.use(globalLimiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Webhooks (Must be placed before express.json() to get raw body)
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check Route (Liveness)
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Farmer Marketplace API is running',
      timestamp: new Date().toISOString(),
    },
  });
});

import { prisma } from './config/prisma';

// Readiness Check Route (Dependencies)
app.get('/api/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ success: true, message: 'Database is ready' });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database is unavailable' });
  }
});

// Modular Routes
app.use('/api/auth', authRoutes);
app.use('/api/producers', producerDiscoveryRoutes);
app.use('/api/producers', producerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller/orders', sellerOrderRoutes);
app.use('/api/seller/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Reviews
app.use('/api/reviews', reviewRoutes);
app.use('/api/products', reviewDiscoveryRoutes);
app.use('/api/admin/reviews', adminReviewRoutes);

// 404 Handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

export default app;

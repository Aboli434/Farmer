import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import authRoutes from './modules/auth/auth.routes';
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
app.use(helmet());
app.use(cors({
  origin: true, // Configurable later
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check Route
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Farmer Marketplace API is running',
      timestamp: new Date().toISOString(),
    },
  });
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

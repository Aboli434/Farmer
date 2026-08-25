import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate, requireSeller, requireActiveSeller } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { createProductSchema, updateProductSchema, queryProductsSchema } from './product.validation';

const router = Router();

// Public Routes
router.get(
  '/',
  validateRequest(queryProductsSchema),
  ProductController.getProducts
);

// Protected Routes (SELLER only)
router.get(
  '/me/catalog',
  authenticate,
  requireSeller, // They can view their catalog
  validateRequest(queryProductsSchema),
  ProductController.getSellerProducts
);

router.post(
  '/',
  authenticate,
  requireActiveSeller,
  validateRequest(createProductSchema),
  ProductController.createProduct
);

router.patch(
  '/:id',
  authenticate,
  requireActiveSeller,
  validateRequest(updateProductSchema),
  ProductController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  requireActiveSeller,
  ProductController.deleteProduct
);

// Slug route MUST be last to avoid catching `/me/catalog` as a slug
router.get(
  '/:slug',
  ProductController.getProductBySlug
);

export default router;

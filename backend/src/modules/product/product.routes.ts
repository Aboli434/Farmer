import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate, requireSeller } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { createProductSchema, updateProductSchema, queryProductsSchema } from './product.validation';

const router = Router();

// Public Routes
router.get(
  '/',
  validateRequest(queryProductsSchema),
  ProductController.getProducts
);

// We need to make sure this doesn't conflict with `/me/catalog`
// So we define `/me/catalog` BEFORE `/:slug`

// Protected Routes (SELLER only)
// Note: We use an inline router or put it before the slug route
router.get(
  '/me/catalog',
  authenticate,
  requireSeller,
  validateRequest(queryProductsSchema),
  ProductController.getSellerProducts
);

router.post(
  '/',
  authenticate,
  requireSeller,
  validateRequest(createProductSchema),
  ProductController.createProduct
);

router.patch(
  '/:id',
  authenticate,
  requireSeller,
  validateRequest(updateProductSchema),
  ProductController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  requireSeller,
  ProductController.deleteProduct
);

// Slug route MUST be last to avoid catching `/me/catalog` as a slug
router.get(
  '/:slug',
  ProductController.getProductBySlug
);

export default router;

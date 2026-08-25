import { z } from 'zod';
import { ProductType, ProductStatus, ProcessingLevel } from '@prisma/client';

const baseBodySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  productType: z.nativeEnum(ProductType),
  
  detail: z.object({
    isVegetarian: z.boolean().default(true),
    shelfLifeDays: z.number().int().positive().optional(),
    ingredients: z.string().optional(),
    processingLevel: z.nativeEnum(ProcessingLevel).optional(),
    processingDetails: z.string().optional(),
    allergenInfo: z.string().optional(),
    productionDate: z.string().datetime().optional(),
    harvestDate: z.string().datetime().optional(),
    bestBeforeDate: z.string().datetime().optional(),
    expiryDate: z.string().datetime().optional(),
    storageInstructions: z.string().optional(),
    packagingDetails: z.string().optional()
  }).refine((data) => {
    return true; 
  }, { message: "Invalid product details" }),

  variants: z.array(
    z.object({
      label: z.string().trim().min(1).max(50),
      quantity: z.number().positive(),
      unit: z.string().trim().min(1).max(20),
      price: z.number().positive(),
      initialStock: z.number().nonnegative().default(0)
    })
  ).min(1, 'At least one variant is required'),

  images: z.array(
    z.object({
      url: z.string().url(),
      sortOrder: z.number().int().default(0)
    })
  ).optional()
});

export const createProductSchema = z.object({
  body: baseBodySchema
}).refine((data) => {
  if (data.body.productType === ProductType.FRESH_PRODUCE) {
    if (!data.body.detail.harvestDate && !data.body.detail.shelfLifeDays) {
      return false;
    }
  } else if (data.body.productType === ProductType.PROCESSED_FOOD) {
    if (!data.body.detail.ingredients || !data.body.detail.productionDate) {
      return false;
    }
  }
  return true;
}, {
  message: "FRESH_PRODUCE requires harvestDate or shelfLifeDays. PROCESSED_FOOD requires ingredients and productionDate."
});

export const updateProductSchema = z.object({
  body: baseBodySchema.partial()
});

export const queryProductsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).optional().default('20').transform(val => Math.min(Number(val), 50)),
    categoryId: z.string().uuid().optional(),
    producerId: z.string().uuid().optional(),
    status: z.nativeEnum(ProductStatus).optional(),
    search: z.string().optional(),
    productType: z.nativeEnum(ProductType).optional(),
    minPrice: z.string().regex(/^\d+(\.\d+)?$/).optional().transform(Number),
    maxPrice: z.string().regex(/^\d+(\.\d+)?$/).optional().transform(Number),
    pincode: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    sort: z.enum(['RELEVANCE', 'PRICE_LOW_TO_HIGH', 'PRICE_HIGH_TO_LOW', 'NEWEST']).optional().default('RELEVANCE')
  })
});

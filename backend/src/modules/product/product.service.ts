import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { Prisma, ProductStatus, ProductType } from '@prisma/client';

export class ProductService {
  static async createProduct(userId: string, data: any) {
    // 1. Fetch Producer Profile
    const profile = await prisma.producerProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');
    }

    const { categoryId, name, description, productType, detail, variants, images } = data;

    // 2. Validate Category
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
    }

    // 3. Generate Slug
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

    // 4. Transactional Create
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          producerId: profile.id,
          categoryId,
          name,
          slug,
          description,
          productType,
          status: ProductStatus.PENDING,
          
          detail: {
            create: {
              isVegetarian: detail.isVegetarian,
              shelfLifeDays: detail.shelfLifeDays,
              ingredients: detail.ingredients,
              processingLevel: detail.processingLevel,
              processingDetails: detail.processingDetails,
              allergenInfo: detail.allergenInfo,
              productionDate: detail.productionDate ? new Date(detail.productionDate) : null,
              harvestDate: detail.harvestDate ? new Date(detail.harvestDate) : null,
              bestBeforeDate: detail.bestBeforeDate ? new Date(detail.bestBeforeDate) : null,
              expiryDate: detail.expiryDate ? new Date(detail.expiryDate) : null,
              storageInstructions: detail.storageInstructions,
              packagingDetails: detail.packagingDetails
            }
          },
          
          variants: {
            create: variants.map((v: any) => ({
              label: v.label,
              quantity: v.quantity,
              unit: v.unit,
              price: v.price,
              inventory: {
                create: {
                  availableQuantity: v.initialStock || 0,
                  transactions: {
                    create: {
                      type: 'INITIAL_STOCK',
                      quantityChanged: v.initialStock || 0,
                      notes: 'Initial stock on creation'
                    }
                  }
                }
              }
            }))
          },

          images: images?.length ? {
            create: images.map((img: any) => ({
              url: img.url,
              sortOrder: img.sortOrder
            }))
          } : undefined
        },
        include: {
          detail: true,
          variants: {
            include: { inventory: true }
          },
          images: true,
          category: { select: { id: true, name: true, slug: true } }
        }
      });

      return product;
    }, { maxWait: 15000, timeout: 30000 });
  }

  static async getProducts(page: number, limit: number, filters: any = {}) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    const whereClauses: Prisma.Sql[] = [
      Prisma.sql`p."status" = 'ACTIVE'`,
      Prisma.sql`p."deletedAt" IS NULL`,
      Prisma.sql`pp."deletedAt" IS NULL`,
      Prisma.sql`EXISTS (SELECT 1 FROM "ProducerVerification" pv WHERE pv."producerId" = pp."id" AND pv."status" = 'APPROVED')`,
      Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" var JOIN "Inventory" inv ON var."id" = inv."variantId" WHERE var."productId" = p."id" AND var."deletedAt" IS NULL AND inv."availableQuantity" > 0)`
    ];

    if (filters.categoryId) {
      whereClauses.push(Prisma.sql`p."categoryId" = ${filters.categoryId}::uuid`);
    }
    if (filters.producerId) {
      whereClauses.push(Prisma.sql`p."producerId" = ${filters.producerId}::uuid`);
    }
    if (filters.productType) {
      whereClauses.push(Prisma.sql`p."productType" = ${filters.productType}::"ProductType"`);
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      whereClauses.push(Prisma.sql`(p."name" ILIKE ${searchPattern} OR p."description" ILIKE ${searchPattern} OR EXISTS (SELECT 1 FROM "Category" c WHERE c."id" = p."categoryId" AND c."name" ILIKE ${searchPattern}))`);
    }
    if (filters.minPrice !== undefined) {
      whereClauses.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" var WHERE var."productId" = p."id" AND var."price" >= ${filters.minPrice})`);
    }
    if (filters.maxPrice !== undefined) {
      whereClauses.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" var WHERE var."productId" = p."id" AND var."price" <= ${filters.maxPrice})`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(whereClauses, ' AND ')}`;

    let orderBySql = Prisma.sql`ORDER BY p."createdAt" DESC`;
    if (filters.sort === 'RELEVANCE' && (filters.pincode || filters.city || filters.district)) {
      orderBySql = Prisma.sql`
        ORDER BY 
          CASE 
            WHEN pp."pincode" = ${filters.pincode || ''} THEN 1
            WHEN pp."city" = ${filters.city || ''} THEN 2
            WHEN pp."district" = ${filters.district || ''} THEN 3
            ELSE 4 
          END ASC,
          p."createdAt" DESC
      `;
    }

    const countQuery = Prisma.sql`
      SELECT COUNT(p."id")::int as total
      FROM "Product" p
      JOIN "ProducerProfile" pp ON p."producerId" = pp."id"
      ${whereSql}
    `;

    const idsQuery = Prisma.sql`
      SELECT p."id"
      FROM "Product" p
      JOIN "ProducerProfile" pp ON p."producerId" = pp."id"
      ${whereSql}
      ${orderBySql}
      LIMIT ${safeLimit} OFFSET ${skip}
    `;

    const [countResult, idsResult]: any = await Promise.all([
      prisma.$queryRaw(countQuery),
      prisma.$queryRaw(idsQuery)
    ]);

    const total = countResult[0]?.total || 0;
    const productIds = idsResult.map((row: any) => row.id);

    if (productIds.length === 0) {
      return {
        data: [],
        pagination: { page, limit: safeLimit, total, totalPages: 0 }
      };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: {
          where: { deletedAt: null, inventory: { availableQuantity: { gt: 0 } } },
          include: { inventory: true }
        },
        images: true,
        category: { select: { id: true, name: true, slug: true } },
        producer: { 
          select: { 
            id: true, farmName: true, city: true, district: true, producerType: true,
            verifications: { select: { status: true } }
          }
        }
      }
    });

    const sortedProducts = productIds.map((id: string) => products.find(p => p.id === id)).filter(Boolean);

    return {
      data: sortedProducts,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  static async getProductBySlug(slug: string) {
    const where: any = {
      slug,
      deletedAt: null,
      status: 'ACTIVE',
      producer: {
        verifications: {
          some: { status: 'APPROVED' }
        },
        deletedAt: null
      }
    };

    const product = await prisma.product.findFirst({
      where,
      include: {
        detail: true,
        variants: { where: { deletedAt: null } },
        images: true,
        category: { select: { id: true, name: true, slug: true } },
        producer: { select: { id: true, farmName: true, city: true, state: true, producerType: true } }
      }
    });

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    }

    return product;
  }

  static async getSellerProducts(userId: string, page: number, limit: number) {
    const profile = await prisma.producerProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');
    }

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const where = {
      producerId: profile.id,
      deletedAt: null
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          variants: { where: { deletedAt: null } },
          images: true,
          category: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  static async deleteProduct(id: string, userId: string) {
    const profile = await prisma.producerProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product || product.deletedAt) {
      throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    }

    if (product.producerId !== profile.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to delete this product.');
    }

    // Soft delete
    return await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.INACTIVE }
    });
  }

  // Soft update function
  static async updateProduct(id: string, userId: string, data: any) {
    const profile = await prisma.producerProfile.findUnique({
      where: { userId }
    });

    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product || product.deletedAt) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    if (product.producerId !== profile.id) throw new ApiError(403, 'FORBIDDEN', 'Permission denied.');

    // We can allow them to update basic fields. 
    // In a real app, altering price/variants might require PENDING state again.
    // We will just do a simple update for now, optionally resetting status to PENDING if needed.
    
    // Extracted for brevity. Real updates would handle variants diffing.
    const { name, description, categoryId } = data;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (categoryId) updateData.categoryId = categoryId;
    
    updateData.status = ProductStatus.PENDING; // Force re-moderation

    return await prisma.product.update({
      where: { id },
      data: updateData
    });
  }
}

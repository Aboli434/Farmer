import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { VerificationStatus, Role, ProductStatus } from '@prisma/client';

export class AdminService {
  static async getVerifications(page: number, limit: number, status?: VerificationStatus) {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    
    const where = status ? { status } : {};

    const [verifications, total] = await Promise.all([
      prisma.producerVerification.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { submittedAt: 'desc' },
        include: {
          producer: {
            select: {
              farmName: true,
              producerType: true,
              city: true,
              district: true,
              state: true
            }
          }
        }
      }),
      prisma.producerVerification.count({ where })
    ]);

    return {
      data: verifications,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  static async getVerificationById(id: string) {
    const verification = await prisma.producerVerification.findUnique({
      where: { id },
      include: {
        producer: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                role: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!verification) {
      throw new ApiError(404, 'NOT_FOUND', 'Verification not found.');
    }

    return verification;
  }

  static async approveVerification(id: string, adminId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch verification
      const verification = await tx.producerVerification.findUnique({
        where: { id }
      });

      if (!verification) {
        throw new ApiError(404, 'NOT_FOUND', 'Verification not found.');
      }

      // 2. Validate state transition (only PENDING -> APPROVED)
      if (verification.status !== VerificationStatus.PENDING) {
        throw new ApiError(400, 'BAD_REQUEST', `Cannot approve. Application is currently ${verification.status}, expected PENDING.`);
      }

      // 3. Update Verification
      const updatedVerification = await tx.producerVerification.update({
        where: { id },
        data: {
          status: VerificationStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
        include: {
          producer: true
        }
      });

      // 4. Update User role
      await tx.user.update({
        where: { id: updatedVerification.producer.userId },
        data: { role: Role.SELLER }
      });

      return updatedVerification;
    }, {
      maxWait: 15000,
      timeout: 30000
    });
  }

  static async rejectVerification(id: string, adminId: string, reason: string) {
    const verification = await prisma.producerVerification.findUnique({
      where: { id }
    });

    if (!verification) {
      throw new ApiError(404, 'NOT_FOUND', 'Verification not found.');
    }

    if (verification.status !== VerificationStatus.PENDING) {
      throw new ApiError(400, 'BAD_REQUEST', `Cannot reject. Application is currently ${verification.status}, expected PENDING.`);
    }

    const updatedVerification = await prisma.producerVerification.update({
      where: { id },
      data: {
        status: VerificationStatus.REJECTED,
        rejectionReason: reason,
        reviewedById: adminId,
        reviewedAt: new Date()
      }
    });

    return updatedVerification;
  }
  // =====================================
  // PRODUCT MODERATION
  // =====================================
  static async getProducts(page: number, limit: number, status?: ProductStatus) {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    
    const where = status ? { status } : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          producer: {
            select: { farmName: true, city: true, state: true }
          },
          category: { select: { name: true } }
        }
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

  static async approveProduct(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    if (product.status !== ProductStatus.PENDING) {
      throw new ApiError(400, 'BAD_REQUEST', `Cannot approve product in status: ${product.status}`);
    }

    return await prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ACTIVE }
    });
  }

  static async rejectProduct(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    if (product.status !== ProductStatus.PENDING) {
      throw new ApiError(400, 'BAD_REQUEST', `Cannot reject product in status: ${product.status}`);
    }

    return await prisma.product.update({
      where: { id },
      data: { status: ProductStatus.REJECTED }
    });
  }
}

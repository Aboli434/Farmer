import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

export class ProducerDiscoveryService {
  static async getProducers(page: number, limit: number, filters: any = {}) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    const where: any = {
      deletedAt: null,
      verifications: {
        some: { status: 'APPROVED' }
      }
    };

    if (filters.pincode) where.pincode = filters.pincode;
    else if (filters.city) where.city = filters.city;
    else if (filters.district) where.district = filters.district;

    const [producers, total] = await Promise.all([
      prisma.producerProfile.findMany({
        where,
        skip,
        take: safeLimit,
        select: {
          id: true,
          farmName: true,
          story: true,
          city: true,
          district: true,
          state: true,
          producerType: true,
          verifications: { select: { status: true } },
          _count: {
            select: {
              products: {
                where: { status: 'ACTIVE', deletedAt: null }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.producerProfile.count({ where })
    ]);

    return {
      data: producers,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  static async getProducerById(profileId: string) {
    const profile = await prisma.producerProfile.findUnique({
      where: { id: profileId },
      include: {
        products: {
          where: {
            status: 'ACTIVE',
            deletedAt: null
          },
          include: {
            variants: {
              include: { inventory: true }
            }
          }
        },
        user: { select: { createdAt: true } },
        verifications: {
          where: { status: 'APPROVED' }
        }
      }
    });

    if (!profile) return null;

    // Calculate aggregated review stats for this producer
    const reviewAgg = await prisma.review.aggregate({
      where: {
        product: { producerId: profileId },
        status: 'VISIBLE',
        deletedAt: null
      },
      _avg: { rating: true },
      _count: { rating: true }
    });

    const isVerified = profile.verifications.length > 0;
    
    // Remove sensitive fields
    const { addressLine, pincode, latitude, longitude, ...publicProfile } = profile;

    return {
      ...publicProfile,
      isVerified,
      trustMetrics: {
        averageRating: reviewAgg._avg.rating ? Number(reviewAgg._avg.rating.toFixed(2)) : 0,
        totalReviews: reviewAgg._count.rating
      }
    };
  }

  static async getNearbyProducers(filters: any = {}) {
    const limit = Math.min(Number(filters.limit) || 20, 50);
    
    const whereClauses: Prisma.Sql[] = [
      Prisma.sql`pp."deletedAt" IS NULL`,
      Prisma.sql`EXISTS (SELECT 1 FROM "ProducerVerification" pv WHERE pv."producerId" = pp."id" AND pv."status" = 'APPROVED')`
    ];

    const whereSql = Prisma.sql`WHERE ${Prisma.join(whereClauses, ' AND ')}`;

    let orderBySql = Prisma.sql`ORDER BY pp."createdAt" DESC`;
    if (filters.pincode || filters.city || filters.district) {
      orderBySql = Prisma.sql`
        ORDER BY 
          CASE 
            WHEN pp."pincode" = ${filters.pincode || ''} THEN 1
            WHEN pp."city" = ${filters.city || ''} THEN 2
            WHEN pp."district" = ${filters.district || ''} THEN 3
            ELSE 4 
          END ASC,
          pp."createdAt" DESC
      `;
    }

    const idsQuery = Prisma.sql`
      SELECT pp."id"
      FROM "ProducerProfile" pp
      ${whereSql}
      ${orderBySql}
      LIMIT ${limit}
    `;

    const idsResult: any = await prisma.$queryRaw(idsQuery);
    const producerIds = idsResult.map((row: any) => row.id);

    if (producerIds.length === 0) return [];

    const producers = await prisma.producerProfile.findMany({
      where: { id: { in: producerIds } },
      select: {
        id: true,
        farmName: true,
        city: true,
        district: true,
        producerType: true,
        verifications: { select: { status: true } },
        _count: {
          select: {
            products: {
              where: { status: 'ACTIVE', deletedAt: null }
            }
          }
        }
      }
    });

    return producerIds.map((id: string) => producers.find(p => p.id === id)).filter(Boolean);
  }
}

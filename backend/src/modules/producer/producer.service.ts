import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { VerificationStatus, ProducerType, Role } from '@prisma/client';

export class ProducerService {
  /**
   * Apply to become a producer
   */
  static async apply(userId: string, data: any) {
    // 1. Check if user is a CUSTOMER
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.CUSTOMER) {
      throw new ApiError(403, 'FORBIDDEN', 'Only customers can apply to become producers.');
    }

    // 2. Check if a profile already exists
    const existingProfile = await prisma.producerProfile.findUnique({
      where: { userId }
    });
    
    if (existingProfile) {
      throw new ApiError(400, 'BAD_REQUEST', 'You have already applied or registered as a producer.');
    }

    const { documents, ...profileData } = data;

    // 3. Create Profile and Verification in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.producerProfile.create({
        data: {
          userId,
          ...profileData
        }
      });

      const verification = await tx.producerVerification.create({
        data: {
          producerId: profile.id,
          documents: documents || [],
          status: VerificationStatus.PENDING
        }
      });

      return { profile, verification };
    });

    return result;
  }

  /**
   * Get own profile
   */
  static async getProfile(userId: string) {
    const profile = await prisma.producerProfile.findUnique({
      where: { userId },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');
    }

    const verification = profile.verifications[0];
    
    // Hide exact coordinates and addressLine if returning to public? 
    // This is the /me endpoint, so they can see their own data.
    return {
      ...profile,
      verification
    };
  }

  /**
   * Update profile
   */
  static async updateProfile(userId: string, data: any) {
    const profile = await prisma.producerProfile.findUnique({
      where: { userId },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');
    }

    const verification = profile.verifications[0];

    // If approved, restrict sensitive changes
    if (verification?.status === VerificationStatus.APPROVED) {
      const sensitiveFields = [
        'producerType', 'farmName', 'addressLine', 'city', 
        'district', 'state', 'pincode', 'latitude', 'longitude', 
        'fssaiNumber', 'documents'
      ];
      
      const attemptedSensitiveEdits = sensitiveFields.filter(field => field in data);
      
      if (attemptedSensitiveEdits.length > 0) {
        throw new ApiError(403, 'FORBIDDEN', `Cannot modify verified fields after approval: ${attemptedSensitiveEdits.join(', ')}. Contact support to request re-verification.`);
      }
    }

    const { documents, ...profileData } = data;

    const result = await prisma.$transaction(async (tx) => {
      let finalProfile = profile;
      
      if (Object.keys(profileData).length > 0) {
        const updated = await tx.producerProfile.update({
          where: { id: profile.id },
          data: profileData
        });
        finalProfile = { ...updated, verifications: profile.verifications } as any;
      }

      let updatedVerification = verification;
      if (documents && documents.length > 0) {
        if (verification) {
          updatedVerification = await tx.producerVerification.update({
            where: { id: verification.id },
            data: { documents }
          });
        }
      }

      return { profile: finalProfile, verification: updatedVerification };
    });

    return result;
  }

  /**
   * Resubmit after rejection
   */
  static async resubmit(userId: string) {
    const profile = await prisma.producerProfile.findUnique({
      where: { userId },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');
    }

    const verification = profile.verifications[0];

    if (!verification || verification.status !== VerificationStatus.REJECTED) {
      throw new ApiError(400, 'BAD_REQUEST', 'Only rejected applications can be resubmitted.');
    }

    const updatedVerification = await prisma.producerVerification.update({
      where: { id: verification.id },
      data: {
        status: VerificationStatus.PENDING,
        rejectionReason: null
      }
    });

    return { profile, verification: updatedVerification };
  }
}

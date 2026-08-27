import { VerificationStatus } from './auth';

export type ProducerType = 'FARMER' | 'HOME_PRODUCER' | 'ARTISAN_PRODUCER' | 'FARM_COOPERATIVE' | 'OTHER';

export interface ProducerProfile {
  id: string;
  userId: string;
  producerType: ProducerType;
  farmName: string;
  story: string;
  addressLine?: string;
  pincode: string;
  district: string;
  city: string;
  state: string;
  fssaiNumber?: string;
  latitude?: number;
  longitude?: number;
  serviceRadius: number; // km
  createdAt: string;
  updatedAt: string;
}

export interface ProducerVerification {
  id: string;
  producerId: string;
  status: VerificationStatus;
  documents: unknown;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

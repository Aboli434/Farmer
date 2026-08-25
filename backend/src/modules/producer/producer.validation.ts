import { z } from 'zod';
import { ProducerType } from '@prisma/client';

export const applyProducerSchema = z.object({
  body: z.object({
    farmName: z.string().min(2, 'Farm/Brand name must be at least 2 characters'),
    producerType: z.nativeEnum(ProducerType).default(ProducerType.FARMER),
    story: z.string().min(50, 'Please write a story of at least 50 characters to help customers know you.'),
    addressLine: z.string().optional(),
    city: z.string().min(2, 'City is required'),
    district: z.string().min(2, 'District is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian pincode'),
    fssaiNumber: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    documents: z.array(
      z.object({
        type: z.string().min(1, 'Document type is required'),
        url: z.string().url('Must be a valid URL')
      })
    ).min(1, 'At least one verification document is required')
  })
});

export const updateProducerSchema = z.object({
  body: z.object({
    farmName: z.string().min(2).optional(),
    producerType: z.nativeEnum(ProducerType).optional(),
    story: z.string().min(50).optional(),
    addressLine: z.string().optional(),
    city: z.string().min(2).optional(),
    district: z.string().min(2).optional(),
    state: z.string().min(2).optional(),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional(),
    fssaiNumber: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    documents: z.array(
      z.object({
        type: z.string().min(1),
        url: z.string().url()
      })
    ).optional()
  })
});

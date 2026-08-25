import { z } from 'zod';

export const createAddressSchema = z.object({
  body: z.object({
    isDefault: z.boolean().optional(),
    fullName: z.string().min(1),
    phone: z.string().min(10),
    pincode: z.string().min(6).max(6),
    city: z.string().min(1),
    district: z.string().min(1),
    state: z.string().min(1),
    address: z.string().min(1),
    landmark: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});

export const updateAddressSchema = z.object({
  body: createAddressSchema.shape.body.partial()
});

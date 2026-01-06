import { z } from 'zod';

class BusinessValidation {
  registerBusiness = {
    body: z.object({
      type: z.enum(['HOTEL', 'RESTAURANT', 'GUIDE', 'EXPERIENCE', 'SHOP']),
      tier: z.enum(['FREE', 'BOOSTED', 'PREMIUM']),
      locations:
    z.object({
        create: z.array(
            z.object({
                name: z.string().min(1),
                category: z.string().min(1),
                description: z.string().optional(),
                latitude: z.number(),
                longitude: z.number(),
                address: z.string().min(1),
                priceRange: z.string().optional(),
                verified: z.boolean().default(false),
            })
        ),
    })
    }),
  };
}

export default new BusinessValidation();

import z from 'zod';

const LocationCategory = [
  'HOTEL',
  'RESTAURANT',
  'ATTRACTION',
  'TREKKING',
  'VIEWPOINT',
  'SHOPPING',
  'OTHER',
] as const;

const floatSchema = z
  .union([
    z.number(),
    z
      .string()
      .refine((v) => !isNaN(Number(v)), 'Must be a valid number')
      .transform(Number),
  ])
  .refine((v) => v >= 0 && v <= 5, 'Rating must be between 0 and 5');

const latitudeSchema = z
  .union([
    z.number(),
    z
      .string()
      .refine((v) => !isNaN(Number(v)), 'Must be a valid number')
      .transform(Number),
  ])
  .refine((v) => v >= -90 && v <= 90, 'Latitude must be between -90 and 90');

const longitudeSchema = z
  .union([
    z.number(),
    z
      .string()
      .refine((v) => !isNaN(Number(v)), 'Must be a valid number')
      .transform(Number),
  ])
  .refine(
    (v) => v >= -180 && v <= 180,
    'Longitude must be between -180 and 180'
  );

class LocationValidation {
  addLocation = {
    body: z.object({
      name: z
        .string({ message: 'Location name is required' })
        .min(2, { message: 'Location name must contain at least 2 characters' })
        .max(150, { message: 'Location name must not exceed 150 characters' })
        .trim(),
      category: z.enum(LocationCategory, {
        message: 'Invalid Location category',
      }),
      description: z
        .string({ message: 'Location description must be a string' })
        .min(2, {
          message: 'Location description must contain at least 2 characters',
        })
        .max(500, {
          message: 'Location description must not exceed 500 characters',
        })
        .trim()
        .optional(),
      latitude: latitudeSchema,
      longitude: longitudeSchema,
      address: z
        .string()
        .min(5, 'Address must contain at least 5 characters')
        .max(200, 'Address must not exceed 200 characters')
        .trim()
        .optional(),
      priceRange: z
        .string()
        .min(1, 'Price range must contain at least 1 character')
        .max(50, 'Price range must not exceed 50 characters')
        .trim()
        .optional(),
      rating: floatSchema.optional(),
    }),
  };

  locationIdParam = {
    params: z.object({
      id: z
        .string({ message: 'Location ID is required' })
        .uuid({ message: 'Location ID must be a valid UUID' }),
    }),
  };

  nearbyQuery = {
    query: z.object({
      lat: z
        .string({ message: 'Latitude is required' })
        .refine((v) => !isNaN(Number(v)), 'Latitude must be a valid number')
        .transform(Number)
        .refine(
          (v) => v >= -90 && v <= 90,
          'Latitude must be between -90 and 90'
        ),
      lng: z
        .string({ message: 'Longitude is required' })
        .refine((v) => !isNaN(Number(v)), 'Longitude must be a valid number')
        .transform(Number)
        .refine(
          (v) => v >= -180 && v <= 180,
          'Longitude must be between -180 and 180'
        ),
      radius: z
        .string()
        .refine((v) => !isNaN(Number(v)), 'Radius must be a valid number')
        .transform(Number)
        .refine(
          (v) => v >= 0.1 && v <= 100,
          'Radius must be between 0.1 and 100 km'
        )
        .optional(),
    }),
  };

  // For search: GET /locations/search?q=hotel&category=HOTEL
  searchQuery = {
    query: z.object({
      q: z
        .string()
        .min(1, 'Search query must not be empty')
        .max(100, 'Search query must not exceed 100 characters')
        .trim()
        .optional(),
      category: z.enum(LocationCategory).optional(),
    }),
  };
}

export default new LocationValidation();

import { z } from 'zod';

class TripValidation {
  /**
   * Validation for generating a new trip
   * POST /trip/generate
   */
  generate = {
    body: z
      .object({
        source: z
          .string({ message: 'Source location is required' })
          .min(2, { message: 'Source must contain at least 2 characters' })
          .max(200, { message: 'Source must not exceed 200 characters' })
          .trim(),
        destination: z
          .string({ message: 'Destination is required' })
          .min(2, { message: 'Destination must contain at least 2 characters' })
          .max(200, { message: 'Destination must not exceed 200 characters' })
          .trim(),
        days: z
          .number({ message: 'Number of days is required' })
          .int({ message: 'Days must be a whole number' })
          .min(1, { message: 'Trip must be at least 1 day' })
          .max(90, { message: 'Trip cannot exceed 90 days' }),
        budgetMin: z
          .number({ message: 'Minimum budget must be a number' })
          .min(0, { message: 'Budget cannot be negative' })
          .optional(),
        budgetMax: z
          .number({ message: 'Maximum budget must be a number' })
          .min(0, { message: 'Budget cannot be negative' })
          .optional(),
        travelStyle: z
          .array(
            z.enum(
              ['ADVENTURE', 'RELAXED', 'CULTURAL', 'LUXURY', 'BACKPACKING'],
              {
                message: 'Invalid travel style',
              }
            )
          )
          .min(1, { message: 'At least one travel style is required' })
          .max(3, { message: 'Maximum 3 travel styles allowed' })
          .optional(),
        title: z
          .string()
          .min(3, { message: 'Title must contain at least 3 characters' })
          .max(200, { message: 'Title must not exceed 200 characters' })
          .trim()
          .optional(),
      })
      .refine(
        (data) => {
          // If both budgetMin and budgetMax are provided, budgetMax must be >= budgetMin
          if (data.budgetMin !== undefined && data.budgetMax !== undefined) {
            return data.budgetMax >= data.budgetMin;
          }
          return true;
        },
        {
          message:
            'Maximum budget must be greater than or equal to minimum budget',
          path: ['budgetMax'],
        }
      ),
  };

  /**
   * Validation for updating a trip
   * PUT /trip/:id
   */
  update = {
    params: z.object({
      id: z.string().uuid({ message: 'Invalid trip ID' }),
    }),
    body: z.object({
      title: z
        .string()
        .min(3, { message: 'Title must contain at least 3 characters' })
        .max(200, { message: 'Title must not exceed 200 characters' })
        .trim()
        .optional(),
      source: z
        .string()
        .min(2, { message: 'Source must contain at least 2 characters' })
        .max(200, { message: 'Source must not exceed 200 characters' })
        .trim()
        .optional(),
      destination: z
        .string()
        .min(2, { message: 'Destination must contain at least 2 characters' })
        .max(200, { message: 'Destination must not exceed 200 characters' })
        .trim()
        .optional(),
      days: z
        .number()
        .int({ message: 'Days must be a whole number' })
        .min(1, { message: 'Trip must be at least 1 day' })
        .max(90, { message: 'Trip cannot exceed 90 days' })
        .optional(),
      budgetMin: z
        .number()
        .min(0, { message: 'Budget cannot be negative' })
        .optional(),
      budgetMax: z
        .number()
        .min(0, { message: 'Budget cannot be negative' })
        .optional(),
      travelStyle: z
        .array(
          z.enum(['ADVENTURE', 'RELAXED', 'CULTURAL', 'LUXURY', 'BACKPACKING'])
        )
        .min(1, { message: 'At least one travel style is required' })
        .max(3, { message: 'Maximum 3 travel styles allowed' })
        .optional(),
      itinerary: z.record(z.string(), z.any()).optional(),
      costBreakdown: z.record(z.string(), z.any()).optional(),
    }),
  };

  /**
   * Validation for completing a trip
   * POST /trip/:id/complete
   */
  complete = {
    params: z.object({
      id: z.string().uuid({ message: 'Invalid trip ID' }),
    }),
  };

  /**
   * Validation for getting user's trips
   * GET /trip/my
   */
  myTrips = {
    query: z.object({
      status: z
        .enum(['GENERATED', 'SAVED', 'COMPLETED', 'CANCELLED'], {
          message: 'Invalid status filter',
        })
        .optional(),
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? Number.parseInt(val, 10) : 20))
        .refine((val) => val > 0 && val <= 100, {
          message: 'Limit must be between 1 and 100',
        }),
      cursor: z.string().uuid().optional(),
    }),
  };

  /**
   * Validation for getting a single trip
   * GET /trip/:id
   */
  getById = {
    params: z.object({
      id: z.string().uuid({ message: 'Invalid trip ID' }),
    }),
  };

  /**
   * Validation for saving a trip
   * POST /trip/:id/save
   */
  save = {
    params: z.object({
      id: z.string().uuid({ message: 'Invalid trip ID' }),
    }),
  };

  /**
   * Validation for cancelling a trip
   * POST /trip/:id/cancel
   */
  cancel = {
    params: z.object({
      id: z.string().uuid({ message: 'Invalid trip ID' }),
    }),
  };
}

export default new TripValidation();

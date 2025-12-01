import z from 'zod';

class AiValidation {
  suggestPlaces = {
    body: z.object({
      latitude: z
        .number({ message: 'Latitude must be a number' })
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90'),
      longitude: z
        .number({ message: 'Longitude must be a number' })
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180'),
      interests: z
        .array(z.string().min(1).max(50))
        .max(10, 'Maximum 10 interests allowed')
        .optional(),
      radius: z
        .number()
        .min(1, 'Radius must be at least 1 km')
        .max(100, 'Radius cannot exceed 100 km')
        .optional()
        .default(10),
    }),
  };
}

export default new AiValidation();

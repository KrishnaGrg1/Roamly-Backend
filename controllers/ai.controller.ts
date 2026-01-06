import type { Response } from 'express';
import { prisma } from '../config/db';
import type { PrismaClient } from '../generated/prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { HttpErrors, HttpSuccess } from '../helpers/standardResponse';
import OpenAIChat from '../helpers/ai.helper';

interface SuggestPlaceBody {
  latitude: number;
  longitude: number;
  interests?: string[];
  radius?: number; // in kilometers
}

class AiController {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Suggest places based on user location and interests
   * POST /ai/suggest
   */
  public suggestPlacesBasedOnLocation = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const {
        latitude,
        longitude,
        interests = [],
        radius = 10,
      } = req.body as SuggestPlaceBody;

      // Validate coordinates
      if (latitude === undefined || longitude === undefined) {
        HttpErrors.badRequest(res, 'Latitude and longitude are required');
        return;
      }

      // Build interests string
      const interestsStr =
        interests.length > 0 ? interests.join(', ') : 'general sightseeing';

      // Get user's completed trips for context (optional)
      const userTrips = await this.prisma.trip.findMany({
        where: { userId, status: 'COMPLETED' },
        take: 5,
        orderBy: { completedAt: 'desc' },
        select: {
          source: true,
          destination: true,
        },
      });

      const historyContext =
        userTrips.length > 0
          ? `User has previously traveled: ${userTrips.map((trip) => `${trip.source} → ${trip.destination}`).join(', ')}.`
          : '';

      const prompt = `You are a travel recommendation expert. Based on the following information, suggest exactly 5 places to visit.

User Location: Latitude ${latitude}, Longitude ${longitude}
Search Radius: ${radius} kilometers
User Interests: ${interestsStr}
${historyContext}

Please respond with a JSON array of exactly 5 places. Each place should have:
- "name": string (place name)
- "category": string (e.g., "Restaurant", "Temple", "Park", "Museum", etc.)
- "description": string (brief description, 1-2 sentences)
- "matchReason": string (why this matches user interests)
- "estimatedRating": number (1-5)
- "bestTimeToVisit": string (e.g., "Morning", "Evening", "Anytime")
- "estimatedDistance": string (approximate distance from user location)

Respond ONLY with the JSON array, no additional text.`;

      const aiResponse = await OpenAIChat({ prompt });

      if (!aiResponse?.content) {
        HttpErrors.serverError(
          res,
          new Error('No response from AI'),
          'AI suggestion'
        );
        return;
      }

      // Try to parse AI response as JSON
      let suggestions;
      try {
        // Clean the response (remove markdown code blocks if present)
        let content = aiResponse.content.trim();
        if (content.startsWith('```json')) {
          content = content.slice(7);
        }
        if (content.startsWith('```')) {
          content = content.slice(3);
        }
        if (content.endsWith('```')) {
          content = content.slice(0, -3);
        }
        suggestions = JSON.parse(content.trim());
      } catch {
        // If parsing fails, return raw content
        suggestions = aiResponse.content;
      }

      HttpSuccess.ok(
        res,
        {
          suggestions,
          meta: {
            userLocation: { latitude, longitude },
            radius,
            interests: interestsStr,
          },
        },
        'Places suggested successfully'
      );
    } catch (e) {
      HttpErrors.serverError(res, e, 'Suggest places');
    }
  };
}

export default new AiController(prisma);

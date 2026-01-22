import type { Response } from 'express';
import type {
  PrismaClient,
  TripStatus,
  TravelStyle,
} from '../generated/prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware';
import {
  makeSuccessResponse,
  HttpErrors,
  HttpSuccess,
} from '../helpers/standardResponse';
import {
  parsePaginationParams,
  buildCursorQuery,
  buildPaginationResponse,
} from '../helpers/pagination';
import { prisma } from '../config/db';
import OpenAIChat from '../helpers/ai.helper';
import env from '../config/env';

interface GenerateTripBody {
  source: string;
  destination: string;
  days: number;
  budgetMin?: number;
  budgetMax?: number;
  travelStyle?: TravelStyle[];
  title?: string;
}

interface UpdateTripBody {
  title?: string;
  source?: string;
  destination?: string;
  days?: number;
  budgetMin?: number;
  budgetMax?: number;
  travelStyle?: TravelStyle[];
  itinerary?: Record<string, any>;
  costBreakdown?: Record<string, any>;
}

class TripController {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate a new trip itinerary using AI
   * POST /trip/generate
   */
  public getDistance = (
    p1: { lat: number; lng: number },
    p2: { lat: number; lng: number }
  ): number => {
    const R = 6371; // km
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  public generateTrip = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) return HttpErrors.unauthorized(res);

      const {
        source,
        destination,
        days,
        budgetMin,
        budgetMax,
        travelStyle = ['CULTURAL'],
        title,
      } = req.body as GenerateTripBody;

      // // -----------------------------
      // // 1️⃣ Feasibility Validation
      // // -----------------------------
      // const minDaysForDestination: Record<string, number> = {
      //   'Annapurna Base Camp': 5,
      //   'Everest Base Camp': 10,
      //   Mustang: 4,
      //   'Kathmandu-Pokhara': 2,
      // };

      // const minDays = minDaysForDestination[destination];
      // if (minDays && days < minDays) {
      //   // Suggest alternatives automatically
      //   const alternatives = [
      //     {
      //       type: 'extend_days',
      //       message: `Increase your trip to at least ${minDays} days for ${destination}.`,
      //       suggestedDays: minDays,
      //     },
      //     {
      //       type: 'alternative_destination',
      //       message: 'Shorter trips nearby are possible.',
      //       suggestedDestinations: ['Ghorepani Poon Hill', 'Sarangkot'],
      //     },
      //   ];

      //   return HttpSuccess.ok(res, {
      //     error: true,
      //     message: `The trip to ${destination} in ${days} days is not feasible.`,
      //     alternatives,
      //   });
      // }

      // 1. Extract coordinates FIRST
      const coordPrompt = `
        Extract latitude and longitude for these Nepal locations ONLY. Return JSON format.

        Source: "${source}"
        Destination: "${destination}"

        Use these known Nepal coordinates when possible:
        - Pokhara: 28.2096, 83.9856  
        - Kathmandu: 27.7172, 85.3240
        - Annapurna Base Camp: 28.5398, 83.8554
        - Nayapul: 28.4417, 83.8042

        Return ONLY valid JSON:
        {
          "source": {
            "name": "${source}",
            "lat": 28.2096,
            "lng": 83.9856,
            "confidence": "high/medium/low"
          },
          "destination": {
            "name": "${destination}", 
            "lat": 28.5398,
            "lng": 83.8554,
            "confidence": "high/medium/low"
          }
        }
      `;

      const coordResponse = await OpenAIChat({ prompt: coordPrompt });
      let coordinates: any;
      if (!coordResponse?.content) {
        HttpErrors.serverError(
          res,
          new Error('AI response empty'),
          'Failed to generate itinerary'
        );
        return;
      }
      try {
        coordinates = JSON.parse(coordResponse.content);
      } catch (e) {
        // Fallback to hardcoded
        coordinates = {
          source: { lat: 28.2096, lng: 83.9856, confidence: 'high' }, // Pokhara default
          destination: { lat: 28.5398, lng: 83.8554, confidence: 'low' },
        };
      }
      const distanceKm = this.getDistance(
        { lat: coordinates.source.lat, lng: coordinates.source.lng },
        { lat: coordinates.destination.lat, lng: coordinates.destination.lng }
      );
      // -----------------------------
      // 1️⃣ DYNAMIC FEASIBILITY CHECK (NEW)
      // -----------------------------
      const travelHoursOneWay = distanceKm / 50; // 50km/hr Nepal average (roads/flights)
      const totalTravelHours = travelHoursOneWay * 2; // Round trip
      const availableActivityHours = days * 12; // 12 usable hours/day
      console.log('travel hours', totalTravelHours);
      console.log('availableActivity hours', availableActivityHours * 0.8);
      // Block impossible trips
      if (totalTravelHours > availableActivityHours * 0.8) {
        // 80% travel = too much
        const partialPlans = [
          {
            type: 'partial_journey',
            name: `${destination} Preview Day`,
            description: `Distance ${distanceKm.toFixed(0)}km requires ${(totalTravelHours / 24).toFixed(1)} days minimum travel. Try closer viewpoint.`,
            requiredDays: Math.ceil(totalTravelHours / 12),
            estimatedCost: 100,
            feasibility: 'Impossible',
            alternatives: ['Scenic flight', 'Nearby viewpoint'],
          },
        ];

        return HttpSuccess.ok(res, {
          error: true,
          message: `Impossible: ${source}→${destination} (${distanceKm.toFixed(0)}km) needs ${(totalTravelHours / 24).toFixed(1)} travel days minimum`,
          distanceKm: distanceKm.toFixed(1),
          travelHours: totalTravelHours.toFixed(1),
          feasiblePlans: partialPlans,
        });
      }

      // -----------------------------
      // 2️⃣ Build AI Prompt
      // -----------------------------
      const budgetInfo =
        budgetMin && budgetMax
          ? `Budget: $${budgetMin} - $${budgetMax}`
          : budgetMin
            ? `Minimum budget: $${budgetMin}`
            : budgetMax
              ? `Maximum budget: $${budgetMax}`
              : 'Flexible budget';

      const prompt = `Generate a detailed ${days}-day travel itinerary from ${source} to ${destination}.
        Travel style: ${travelStyle.join(', ')}
        Rs{budgetInfo}

        Provide structured JSON only in this format:
        {
          "overview": "Brief trip overview",
          "days": [
            {
              "day": 1,
              "title": "Day title",
              "activities": [
                {
                  "time": "09:00 AM",
                  "activity": "Activity name",
                  "location": "Location name",
                  "description": "Brief description",
                  "estimatedCost": 50,
                  "duration": "2 hours",
                  "trustLevel": "Unverified"
                }
              ],
              "accommodation": {
                "name": "Hotel name",
                "estimatedCost": 100,
                "location": "Location"
                  },
              "meals": [
                {
                  "type": "breakfast/lunch/dinner",
                  "suggestion": "Restaurant name or type",
                  "estimatedCost": 20
                }
              ]
            }
          ],
          "transportation": {
            "toDestination": "How to get there",
            "withinDestination": "How to get around",
            "estimatedCost": 200
          },
          "tips": ["Travel tip 1", "Travel tip 2"],
          "totalEstimatedCost": 1500
        }`;

      // -----------------------------
      // 3️⃣ Call AI
      // -----------------------------
      const aiResponse = await OpenAIChat({ prompt });
      if (!aiResponse?.content)
        return HttpErrors.serverError(
          res,
          new Error('AI response empty'),
          'Failed to generate itinerary'
        );

      // -----------------------------
      // 4️⃣ Parse AI JSON
      // -----------------------------
      let itinerary: Record<string, any>;
      try {
        const content = aiResponse.content;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
          content.match(/```\n([\s\S]*?)\n```/) || [null, content];
        const jsonString = jsonMatch[1] || content;
        itinerary = JSON.parse(jsonString.trim());
      } catch {
        itinerary = {
          type: 'text',
          content: aiResponse.content,
          generatedAt: new Date().toISOString(),
        };
      }

      // -----------------------------
      // 5️⃣ Assign Trust Levels
      // -----------------------------
      // By default, AI-generated activities are Unverified
      itinerary.days?.forEach((day: any) => {
        day.activities?.forEach((activity: any) => {
          activity.trustLevel = 'Unverified';
        });
      });

      // -----------------------------
      // 6️⃣ Compute Cost Breakdown
      // -----------------------------
      const costBreakdown = itinerary.totalEstimatedCost
        ? {
            accommodation: itinerary.days?.reduce(
              (sum: number, day: any) =>
                sum + (day.accommodation?.estimatedCost || 0),
              0
            ),
            activities: itinerary.days?.reduce(
              (sum: number, day: any) =>
                sum +
                  day.activities?.reduce(
                    (daySum: number, act: any) =>
                      daySum + (act.estimatedCost || 0),
                    0
                  ) || 0,
              0
            ),
            meals: itinerary.days?.reduce(
              (sum: number, day: any) =>
                sum +
                  day.meals?.reduce(
                    (mealSum: number, meal: any) =>
                      mealSum + (meal.estimatedCost || 0),
                    0
                  ) || 0,
              0
            ),
            transportation: itinerary.transportation?.estimatedCost || 0,
            total: itinerary.totalEstimatedCost || 0,
          }
        : null;

      // -----------------------------
      // 7️⃣ Save Trip in Database
      // -----------------------------
      const trip = await this.prisma.trip.create({
        data: {
          userId,
          source,
          destination,
          days,
          budgetMin,
          budgetMax,
          travelStyle,
          title: title || `${source} → ${destination} - ${days} days`,
          itinerary,
          costBreakdown: costBreakdown || undefined,
          status: 'GENERATED',
          aiModel: env.OPENAI_MODEL as string,
          aiVersion: (env.AI_MODEL_VERSION as string) || '1.0.0',
        },
      });

      // -----------------------------
      // 8️⃣ Log AI Interaction
      // -----------------------------
      await this.prisma.aiInteraction.create({
        data: {
          userId,
          purpose: 'generate_itinerary',
          prompt,
          response: { content: aiResponse.content, role: aiResponse.role },
          model: env.OPENAI_MODEL as string,
          tokens: null,
        },
      });

      HttpSuccess.created(
        res,
        makeSuccessResponse(trip, 'Trip itinerary generated successfully')
      );
    } catch (error) {
      console.error('Error generating trip:', error);
      HttpErrors.serverError(res, error, 'Failed to generate trip itinerary');
    }
  };

  /**
   * Update trip details
   * PUT /trip/:id
   */
  public updateTrip = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const updateData = req.body as UpdateTripBody;

      // Check if trip exists and belongs to user
      const existingTrip = await this.prisma.trip.findUnique({
        where: { id },
      });

      if (!existingTrip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      if (existingTrip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You do not have permission to update this trip'
        );
        return;
      }

      // Don't allow updating completed trips
      if (existingTrip.status === 'COMPLETED') {
        HttpErrors.badRequest(res, 'Cannot update a completed trip');
        return;
      }

      // Update trip
      const updatedTrip = await this.prisma.trip.update({
        where: { id },
        data: updateData,
      });

      HttpSuccess.ok(
        res,
        makeSuccessResponse(updatedTrip, 'Trip updated successfully')
      );
    } catch (error) {
      console.error('Error updating trip:', error);
      HttpErrors.serverError(res, error, 'Failed to update trip');
    }
  };

  /**
   * Mark trip as completed
   * POST /trip/:id/complete
   */
  public completeTrip = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      // Check if trip exists and belongs to user
      const trip = await this.prisma.trip.findUnique({
        where: { id },
      });

      if (!trip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      if (trip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You do not have permission to complete this trip'
        );
        return;
      }

      if (trip.status === 'COMPLETED') {
        HttpErrors.badRequest(res, 'Trip is already completed');
        return;
      }

      // Update trip status to completed
      const completedTrip = await this.prisma.trip.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      HttpSuccess.ok(
        res,
        makeSuccessResponse(
          completedTrip,
          'Trip marked as completed. You can now create a post from this trip!'
        )
      );
    } catch (error) {
      console.error('Error completing trip:', error);
      HttpErrors.serverError(res, error, 'Failed to complete trip');
    }
  };

  /**
   * Save trip (change status to SAVED)
   * POST /trip/:id/save
   */
  public saveTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      // Check if trip exists and belongs to user
      const trip = await this.prisma.trip.findUnique({
        where: { id },
      });

      if (!trip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      if (trip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You do not have permission to save this trip'
        );
        return;
      }

      if (trip.status === 'SAVED') {
        HttpErrors.badRequest(res, 'Trip is already saved');
        return;
      }

      // Update trip status to saved
      const savedTrip = await this.prisma.trip.update({
        where: { id },
        data: {
          status: 'SAVED',
        },
      });

      HttpSuccess.ok(
        res,
        makeSuccessResponse(savedTrip, 'Trip saved successfully')
      );
    } catch (error) {
      console.error('Error saving trip:', error);
      HttpErrors.serverError(res, error, 'Failed to save trip');
    }
  };

  /**
   * Cancel trip
   * POST /trip/:id/cancel
   */
  public cancelTrip = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      // Check if trip exists and belongs to user
      const trip = await this.prisma.trip.findUnique({
        where: { id },
      });

      if (!trip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      if (trip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You do not have permission to cancel this trip'
        );
        return;
      }

      if (trip.status === 'COMPLETED') {
        HttpErrors.badRequest(res, 'Cannot cancel a completed trip');
        return;
      }

      if (trip.status === 'CANCELLED') {
        HttpErrors.badRequest(res, 'Trip is already cancelled');
        return;
      }

      // Update trip status to cancelled
      const cancelledTrip = await this.prisma.trip.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      HttpSuccess.ok(
        res,
        makeSuccessResponse(cancelledTrip, 'Trip cancelled successfully')
      );
    } catch (error) {
      console.error('Error cancelling trip:', error);
      HttpErrors.serverError(res, error, 'Failed to cancel trip');
    }
  };

  /**
   * Get user's trips
   * GET /trip/my
   */
  public getMyTrips = async (
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
        status,
        limit = 20,
        cursor,
      } = req.query as {
        status?: TripStatus;
        limit?: number;
        cursor?: string;
      };

      // Build where clause
      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      // Get trips with pagination
      const trips = await this.prisma.trip.findMany({
        where,
        take: Number(limit) + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          post: {
            select: {
              id: true,
              caption: true,
              createdAt: true,
            },
          },
        },
      });

      // Build pagination response
      const hasNextPage = trips.length > Number(limit);
      const items = hasNextPage ? trips.slice(0, -1) : trips;
      const nextCursor =
        hasNextPage && items.length > 0 ? items[items.length - 1]!.id : null;

      HttpSuccess.ok(
        res,
        makeSuccessResponse(
          {
            items,
            pagination: {
              nextCursor,
              hasNextPage,
              count: items.length,
            },
          },
          'Trips fetched successfully'
        )
      );
    } catch (error) {
      console.error('Error fetching trips:', error);
      HttpErrors.serverError(res, error, 'Failed to fetch trips');
    }
  };

  /**
   * Get single trip by ID
   * GET /trip/:id
   */
  public getTripById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      // Get trip with full details
      const trip = await this.prisma.trip.findUnique({
        where: { id },
        include: {
          post: {
            include: {
              likes: true,
              comments: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },
              bookmarks: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true,
            },
          },
        },
      });

      if (!trip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      // Check if user has permission to view this trip
      // Public trips (with posts) can be viewed by anyone
      // Private trips can only be viewed by the owner
      if (!trip.post && trip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You do not have permission to view this trip'
        );
        return;
      }

      HttpSuccess.ok(
        res,
        makeSuccessResponse(trip, 'Trip fetched successfully')
      );
    } catch (error) {
      console.error('Error fetching trip:', error);
      HttpErrors.serverError(res, error, 'Failed to fetch trip');
    }
  };

  /**
   * Delete a trip
   * DELETE /trip/:id
   */
  public deleteTrip = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      // Check if trip exists and belongs to user
      const trip = await this.prisma.trip.findUnique({
        where: { id },
        include: {
          post: true,
        },
      });

      if (!trip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      if (trip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You do not have permission to delete this trip'
        );
        return;
      }

      // Don't allow deleting trips that have posts
      if (trip.post) {
        HttpErrors.badRequest(
          res,
          'Cannot delete a trip that has been posted. Delete the post first.'
        );
        return;
      }

      // Delete trip
      await this.prisma.trip.delete({
        where: { id },
      });

      HttpSuccess.ok(
        res,
        makeSuccessResponse(null, 'Trip deleted successfully')
      );
    } catch (error) {
      console.error('Error deleting trip:', error);
      HttpErrors.serverError(res, error, 'Failed to delete trip');
    }
  };
}

export default new TripController(prisma);

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
  public generateTrip = async (
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
        source,
        destination,
        days,
        budgetMin,
        budgetMax,
        travelStyle = ['CULTURAL'],
        title,
      } = req.body as GenerateTripBody;

      // Build AI prompt for itinerary generation
      const budgetInfo =
        budgetMin && budgetMax
          ? `Budget: $${budgetMin} - $${budgetMax}`
          : budgetMin
            ? `Minimum budget: $${budgetMin}`
            : budgetMax
              ? `Maximum budget: $${budgetMax}`
              : 'Flexible budget';

      const prompt = `Create a detailed ${days}-day travel itinerary from ${source} to ${destination}.
Travel style: ${travelStyle.join(', ')}
${budgetInfo}

Please provide a structured JSON response with the following format:
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
          "duration": "2 hours"
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

      // Call AI to generate itinerary
      const aiResponse = await OpenAIChat({ prompt });

      if (!aiResponse || !aiResponse.content) {
        HttpErrors.serverError(
          res,
          new Error('AI response empty'),
          'Failed to generate itinerary'
        );
        return;
      }

      // Parse AI response
      let itinerary: Record<string, any>;
      try {
        // Try to parse as JSON
        const content = aiResponse.content;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
          content.match(/```\n([\s\S]*?)\n```/) || [null, content];
        const jsonString = jsonMatch[1] || content;
        itinerary = JSON.parse(jsonString.trim());
      } catch (error) {
        // If parsing fails, store as text with basic structure
        itinerary = {
          type: 'text',
          content: aiResponse.content,
          generatedAt: new Date().toISOString(),
        };
      }

      // Extract cost breakdown if available
      const costBreakdown = itinerary.totalEstimatedCost
        ? {
            accommodation:
              itinerary.days?.reduce(
                (sum: number, day: any) =>
                  sum + (day.accommodation?.estimatedCost || 0),
                0
              ) || 0,
            activities:
              itinerary.days?.reduce(
                (sum: number, day: any) =>
                  sum +
                    day.activities?.reduce(
                      (daySum: number, activity: any) =>
                        daySum + (activity.estimatedCost || 0),
                      0
                    ) || 0,
                0
              ) || 0,
            meals:
              itinerary.days?.reduce(
                (sum: number, day: any) =>
                  sum +
                    day.meals?.reduce(
                      (mealSum: number, meal: any) =>
                        mealSum + (meal.estimatedCost || 0),
                      0
                    ) || 0,
                0
              ) || 0,
            transportation: itinerary.transportation?.estimatedCost || 0,
            total: itinerary.totalEstimatedCost || 0,
          }
        : null;

      // Create trip in database
      const trip = await this.prisma.trip.create({
        data: {
          userId,
          source,
          destination,
          days,
          budgetMin,
          budgetMax,
          travelStyle,
          title: title || `${source} to ${destination} - ${days} days`,
          itinerary,
          costBreakdown: costBreakdown || undefined,
          status: 'GENERATED',
          aiModel: env.OPENAI_MODEL as string,
          aiVersion: (env.AI_MODEL_VERSION as string) || '1.0.0',
        },
      });

      // Log AI interaction
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

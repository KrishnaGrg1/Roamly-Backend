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
  startDate: Date;
  endDate: Date;
  budgetMin?: number;
  budgetMax?: number;
  travelStyle?: TravelStyle[];
  title?: string;
  travelType?: 'nepali' | 'saarc' | 'foreigner';
  healthIssue?: string;
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
  // Helper function to determine season from month
  private getSeason = (month: number): string => {
    // Spring: March (2), April (3), May (4)
    if (month >= 2 && month <= 4) return 'Spring';
    // Summer: June (5), July (6), August (7)
    if (month >= 5 && month <= 7) return 'Summer';
    // Autumn: September (8), October (9), November (10)
    if (month >= 8 && month <= 10) return 'Autumn';
    // Winter: December (11), January (0), February (1)
    return 'Winter';
  };

  // Helper function to calculate days between dates
  private calculateDays = (startDate: Date, endDate: Date): number => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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

  // Destination to Protected Area mapping
  private DESTINATION_TO_PROTECTED_AREA: Record<string, string> = {
    // Annapurna Region
    'Annapurna Base Camp': 'Annapurna Conservation Area (ACAP)',
    ABC: 'Annapurna Conservation Area (ACAP)',
    'Annapurna Circuit': 'Annapurna Conservation Area (ACAP)',
    'Poon Hill': 'Annapurna Conservation Area (ACAP)',
    Ghorepani: 'Annapurna Conservation Area (ACAP)',
    'Mardi Himal': 'Annapurna Conservation Area (ACAP)',

    // Everest Region
    'Everest Base Camp': 'Sagarmatha National Park',
    EBC: 'Sagarmatha National Park',
    'Kala Patthar': 'Sagarmatha National Park',
    'Gokyo Lakes': 'Sagarmatha National Park',
    'Island Peak': 'Sagarmatha National Park',

    // Langtang Region
    'Langtang Valley': 'Langtang National Park',
    Langtang: 'Langtang National Park',
    Gosaikunda: 'Langtang National Park',
    Helambu: 'Langtang National Park',

    // Manaslu Region
    'Manaslu Circuit': 'Manaslu Conservation Area (MCAP)',
    'Manaslu Base Camp': 'Manaslu Conservation Area (MCAP)',

    // Upper Mustang
    'Upper Mustang': 'Annapurna Conservation Area (ACAP)',
    'Lo Manthang': 'Annapurna Conservation Area (ACAP)',

    // Chitwan
    Chitwan: 'Chitwan National Park',
    Sauraha: 'Chitwan National Park',

    // Bardia
    Bardia: 'Bardia National Park',

    // Kanchenjunga
    'Kanchenjunga Base Camp': 'Kanchenjunga Conservation Area (KCAP)',
    Kanchenjunga: 'Kanchenjunga Conservation Area (KCAP)',

    // Rara
    'Rara Lake': 'Rara National Park',
    Rara: 'Rara National Park',

    // Makalu
    'Makalu Base Camp': 'Makalu-Barun National Park',

    // Dolpo
    'Phoksundo Lake': 'Shey-Phoksundo National Park',
    'Upper Dolpo': 'Shey-Phoksundo National Park',
  };

  // Destination rules for Nepal trekking destinations
  private DESTINATION_RULES: Record<
    string,
    { minDays: number; minBudget: number }
  > = {
    'Annapurna Base Camp': { minDays: 5, minBudget: 15000 },
    'Everest Base Camp': { minDays: 12, minBudget: 80000 },
    'Langtang Valley': { minDays: 7, minBudget: 20000 },
    'Manaslu Circuit': { minDays: 14, minBudget: 50000 },
    'Upper Mustang': { minDays: 10, minBudget: 60000 },
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
        startDate,
        endDate,
        budgetMin,
        budgetMax,
        travelStyle = ['CULTURAL'],
        title,
        travelType = 'nepali',
        healthIssue,
      } = req.body as GenerateTripBody;

      // Calculate days from date range
      const days = this.calculateDays(new Date(startDate), new Date(endDate));

      // Determine season from start date
      const startMonth = new Date(startDate).getMonth();
      const season = this.getSeason(startMonth);

      // Debug logs
      console.log('📍 Request travelType:', travelType);
      console.log('📍 Destination:', destination);
      console.log('📅 Start Date:', startDate);
      console.log('📅 End Date:', endDate);
      console.log('📆 Total Days:', days);
      console.log('🍂 Season:', season);
      if (healthIssue) {
        console.log('🏥 Health Issue:', healthIssue);
      }

      let allowedTransportModes: string[] = [];

      // Determine transport modes based on budget
      if (!budgetMax || budgetMax < 30000) {
        allowedTransportModes = ['BUS', 'JEEP', 'TREK'];
      } else if (budgetMax < 80000) {
        allowedTransportModes = ['BUS', 'JEEP', 'TREK', 'FLIGHT'];
      } else {
        allowedTransportModes = ['BUS', 'JEEP', 'TREK', 'FLIGHT', 'HELICOPTER'];
      }

      // -----------------------------
      // 1️⃣ Extract coordinates using AI
      // -----------------------------
      const coordPrompt = `
      Extract latitude and longitude for these Nepal locations ONLY. Return JSON format.

      Source: "${source}"
      Destination: "${destination}"

      Use these known Nepal coordinates when possible:
      - Pokhara: 28.2096, 83.9856  
      - Kathmandu: 27.7172, 85.3240
      - Annapurna Base Camp: 28.5398, 83.8554
      - Nayapul: 28.4417, 83.8042
      - Everest Base Camp: 28.0026, 86.8528
      - Langtang: 28.2167, 85.5333

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
        // Fallback to hardcoded Pokhara coordinates
        coordinates = {
          source: { lat: 28.2096, lng: 83.9856, confidence: 'high' },
          destination: { lat: 28.5398, lng: 83.8554, confidence: 'low' },
        };
      }

      const distanceKm = this.getDistance(
        { lat: coordinates.source.lat, lng: coordinates.source.lng },
        { lat: coordinates.destination.lat, lng: coordinates.destination.lng }
      );

      // -----------------------------
      // 2️⃣ DYNAMIC FEASIBILITY CHECK
      // -----------------------------
      const travelHoursOneWay = distanceKm / 50; // 50km/hr Nepal average
      const totalTravelHours = travelHoursOneWay * 2; // Round trip
      const availableActivityHours = days * 12; // 12 usable hours/day

      console.log('Travel hours:', totalTravelHours);
      console.log('Available activity hours:', availableActivityHours * 0.8);

      // Block impossible trips (80% travel time = too much)
      if (totalTravelHours > availableActivityHours * 0.8) {
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
      // 3️⃣ NEPAL DESTINATION FEASIBILITY CHECK
      // -----------------------------
      const destRule = this.DESTINATION_RULES[destination];

      if (destRule) {
        // Days check
        if (days < destRule.minDays) {
          return HttpSuccess.ok(res, {
            error: true,
            reason: 'INSUFFICIENT_DAYS',
            message: `${destination} requires at least ${destRule.minDays} days.`,
            required: {
              minDays: destRule.minDays,
              minBudget: destRule.minBudget,
            },
            alternatives: [
              'Ghorepani Poon Hill',
              'Australian Camp',
              'Sarangkot',
            ],
          });
        }

        // Budget check
        if (budgetMax && budgetMax < destRule.minBudget) {
          return HttpSuccess.ok(res, {
            error: true,
            reason: 'INSUFFICIENT_BUDGET',
            message: `${destination} cannot be done under Rs${budgetMax}. Minimum required: Rs${destRule.minBudget}`,
            requiredBudget: destRule.minBudget,
          });
        }
      }

      // -----------------------------
      // 4️⃣ FETCH ENTRY FEES FROM DATABASE
      // -----------------------------
      let entryFeeInfo = '';
      let applicableEntryFee = 0;

      const protectedArea = await this.prisma.protectedArea.findFirst({
        where: {
          OR: [
            { name: { contains: destination, mode: 'insensitive' } },
            { name: { equals: destination } },
          ],
        },
      });

      if (protectedArea) {
        const fees = protectedArea.feesNPR as any;

        // Determine applicable fee based on nationality
        if (travelType === 'nepali') {
          applicableEntryFee = fees.nepali || 0;
        } else if (travelType === 'saarc') {
          applicableEntryFee = fees.saarc || 0;
        } else {
          applicableEntryFee = fees.foreigner || 0;
        }

        const nationalityLabel =
          travelType === 'nepali'
            ? 'Nepali'
            : travelType === 'saarc'
              ? 'SAARC'
              : 'Foreigner';

        entryFeeInfo = `
IMPORTANT - Entry Fees for ${protectedArea.name}:
- Category: ${protectedArea.category}
- User Nationality: ${nationalityLabel}
- Applicable Entry Fee: NPR ${applicableEntryFee}
- Fee Breakdown (All categories):
  * Nepali: NPR ${fees.nepali || 0}
  * SAARC: NPR ${fees.saarc || 0}
  * Foreigner: NPR ${fees.foreigner || 0}
- Child Policy: ${protectedArea.childPolicy}
- Payment Location: ${JSON.stringify(protectedArea.paymentLocation)}

YOU MUST include NPR ${applicableEntryFee} as the entry fee in your cost calculations.
DO NOT use any other entry fee amount.
`;
      }

      // -----------------------------
      // 5️⃣ BUILD AI PROMPT
      // -----------------------------
      const budgetInfo =
        budgetMin && budgetMax
          ? `Budget: NPR ${budgetMin} - ${budgetMax}`
          : budgetMin
            ? `Minimum budget: NPR ${budgetMin}`
            : budgetMax
              ? `Maximum budget: NPR ${budgetMax}`
              : 'Flexible budget';

      // Health considerations
      const healthInfo = healthIssue
        ? `
CRITICAL HEALTH INFORMATION:
The traveler has the following health condition: ${healthIssue}

YOU MUST:
- Adjust activity intensity and difficulty levels accordingly
- Recommend appropriate altitude limits (if applicable)
- Suggest gradual acclimatization schedules
- Include rest days if needed
- Avoid strenuous activities that may aggravate the condition
- Recommend accessible alternatives for challenging activities
- Include health and safety precautions in tips
- Suggest nearby medical facilities in the itinerary
- Consider evacuation accessibility
`
        : '';

      const prompt = `Generate a detailed realistic ${days}-day travel itinerary from ${source} to ${destination} in Nepal.
      Travel Dates: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}
      Season: ${season}
      Travel style: ${travelStyle.join(', ')}
      ${budgetInfo}
${entryFeeInfo}
${healthInfo}
STRICT RULES (MUST FOLLOW):
- Allowed transport modes: ${allowedTransportModes.join(', ')}
- Helicopters are FORBIDDEN unless explicitly allowed
- Stay within total budget (NPR)
- Trekking destinations require walking days (no road access)
- Accommodation must match budget (budget lodges if low budget)
- If entry fees are provided above, MUST include the exact amount (NPR ${applicableEntryFee}) in the itinerary cost breakdown
- Use realistic Nepal prices for meals, accommodation, and transport
- Consider ${season} season weather and conditions in your recommendations
- Mention season-specific tips (e.g., "Spring: Rhododendrons in bloom", "Monsoon: Carry rain gear")
${healthIssue ? '- PRIORITIZE traveler safety given their health condition - adjust difficulty and include health precautions' : ''}
      Provide structured JSON only in this format:
      {
        "overview": "Brief trip overview",
        "season": "${season}",
        "seasonalInfo": "Season-specific notes and weather conditions",
        ${healthIssue ? '"healthConsiderations": "Important health and safety notes for the traveler\'s condition",' : ''}
        "transportation": {
          "mode": "BUS | JEEP | TREK | FLIGHT | HELICOPTER",
          "estimatedCost": 0,
          "toDestination": "How to get there",
          "withinDestination": "How to get around"
        },
        "days": [
          {
            "day": 1,
            "date": "${new Date(startDate).toISOString().split('T')[0]}",
            "title": "Day title",
            "activities": [
              {
                "time": "09:00 AM",
                "activity": "Activity name",
                "location": "Location name",
                "description": "Brief description",
                "estimatedCost": 50,
                "duration": "2 hours",
                ${healthIssue ? '"difficultyLevel": "Easy/Moderate/Challenging",' : ''}
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
        "entryFees": {
          "name": "Protected area name (if applicable)",
          "cost": ${applicableEntryFee},
          "description": "Entry fee details"
        },
        ${healthIssue ? '"safetyPrecautions": ["Health-specific safety tip 1", "Nearest medical facility info", "Emergency contact info"],' : ''}
        "tips": ["Travel tip 1", "Season-specific tip", ${healthIssue ? '"Health-related precaution",' : ''} "Travel tip 3"],
        "totalEstimatedCost": 1500
      }`;

      // -----------------------------
      // 6️⃣ CALL AI
      // -----------------------------
      const aiResponse = await OpenAIChat({ prompt });

      if (!aiResponse?.content) {
        return HttpErrors.serverError(
          res,
          new Error('AI response empty'),
          'Failed to generate itinerary'
        );
      }

      // -----------------------------
      // 7️⃣ PARSE AI JSON RESPONSE
      // -----------------------------
      let itinerary: Record<string, any>;

      try {
        const content = aiResponse.content;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
          content.match(/```\n([\s\S]*?)\n```/) || [null, content];
        const jsonString = jsonMatch[1] || content;
        itinerary = JSON.parse(jsonString.trim());
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        itinerary = {
          type: 'text',
          content: aiResponse.content,
          generatedAt: new Date().toISOString(),
        };
      }

      // -----------------------------
      // 8️⃣ BUDGET VALIDATION
      // -----------------------------
      if (
        budgetMax &&
        itinerary.totalEstimatedCost &&
        itinerary.totalEstimatedCost > budgetMax * 1.1
      ) {
        return HttpSuccess.ok(res, {
          error: true,
          reason: 'BUDGET_EXCEEDED',
          message: 'Generated itinerary exceeds your budget by more than 10%.',
          budgetMax,
          generatedCost: itinerary.totalEstimatedCost,
          suggestion: `Consider increasing budget to NPR ${Math.ceil(itinerary.totalEstimatedCost / 1000) * 1000} or reducing days.`,
        });
      }

      // -----------------------------
      // 9️⃣ ASSIGN TRUST LEVELS
      // -----------------------------
      itinerary.days?.forEach((day: any) => {
        day.activities?.forEach((activity: any) => {
          activity.trustLevel = activity.trustLevel || 'Unverified';
        });
      });

      // -----------------------------
      // 🔟 COMPUTE COST BREAKDOWN
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
                (day.activities?.reduce(
                  (daySum: number, act: any) =>
                    daySum + (act.estimatedCost || 0),
                  0
                ) || 0),
              0
            ),
            meals: itinerary.days?.reduce(
              (sum: number, day: any) =>
                sum +
                (day.meals?.reduce(
                  (mealSum: number, meal: any) =>
                    mealSum + (meal.estimatedCost || 0),
                  0
                ) || 0),
              0
            ),
            transportation: itinerary.transportation?.estimatedCost || 0,
            entryFees: itinerary.entryFees?.cost || applicableEntryFee || 0,
            total: itinerary.totalEstimatedCost || 0,
          }
        : null;

      // -----------------------------
      // 1️⃣1️⃣ SAVE TRIP TO DATABASE
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
          itinerary: {
            ...itinerary,
            protectedAreaInfo: protectedArea
              ? {
                  name: protectedArea.name,
                  category: protectedArea.category,
                  applicableEntryFee,
                  userNationality: travelType,
                }
              : null,
          },
          costBreakdown: costBreakdown || undefined,
          status: 'GENERATED',
          aiModel: env.OPENAI_MODEL as string,
          aiVersion: (env.AI_MODEL_VERSION as string) || '1.0.0',
        },
      });

      // -----------------------------
      // 1️⃣2️⃣ LOG AI INTERACTION
      // -----------------------------
      await this.prisma.aiInteraction.create({
        data: {
          userId,
          tripId: trip.id,
          purpose: 'generate_itinerary',
          prompt,
          response: { content: aiResponse.content, role: aiResponse.role },
          model: env.OPENAI_MODEL as string,
          tokens: null,
        },
      });

      // -----------------------------
      // 1️⃣3️⃣ RETURN SUCCESS RESPONSE
      // -----------------------------
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
   * Get user's save trips
   * GET /trip/save
   */
  public getsaveTrips = async (
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
        where: {
          status: 'SAVED',
        },
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

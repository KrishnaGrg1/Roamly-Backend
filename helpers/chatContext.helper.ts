import { TripStatus } from '../generated/prisma/client';
import { prisma } from '../config/db';
/**
 * AI Chat Context Builder
 *
 * CRITICAL: This is where most AI systems fail.
 * We strictly limit context to prevent hallucinations and control costs.
 */

export interface ChatContext {
  userTrips: {
    completed: any[];
    saved: any[];
    generated: any[];
  };
  similarTrips: any[];
  relevantPosts: any[];
  relevantLocations: any[];
  constraints: {
    budget?: { min: number; max: number };
    days?: number;
    travelStyles?: string[];
  };
}

export interface ContextOptions {
  userId: string;
  message: string;
  intent?: 'PLAN' | 'MODIFY' | 'COMPARE' | 'RECALL' | 'EXPLORE' | 'GENERAL';
  destination?: string;
}

/**
 * Build context for AI chat
 *
 * HARD LIMITS (non-negotiable):
 * - Max 3 completed trips
 * - Max 3 saved trips
 * - Max 5 AI-generated itineraries
 * - Max 5 similar trips
 * - Max 5 relevant posts
 * - Max 5 locations
 */
export async function buildChatContext(
  options: ContextOptions
): Promise<ChatContext> {
  const { userId, message, intent, destination } = options;

  // 1. Load user context (with hard limits)
  const [completedTrips, savedTrips, generatedTrips] = await Promise.all([
    // Last 3 completed trips
    prisma.trip.findMany({
      where: { userId, status: TripStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      take: 3,
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            _count: {
              select: {
                bookmarks: true,
                comments: true,
                likes: true,
              },
            },
          },
        },
      },
    }),

    // Last 3 saved trips
    prisma.trip.findMany({
      where: { userId, status: TripStatus.SAVED },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),

    // Last 5 AI-generated itineraries
    prisma.trip.findMany({
      where: { userId, status: TripStatus.GENERATED },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // 2. Load global context (based on destination or similarity)
  let similarTrips: any[] = [];
  let relevantPosts: any[] = [];
  let relevantLocations: any[] = [];

  if (destination) {
    // Find trips to same destination
    similarTrips = await prisma.trip.findMany({
      where: {
        destination: {
          contains: destination,
          mode: 'insensitive',
        },
        status: TripStatus.COMPLETED,
        userId: { not: userId }, // Others' trips only
      },
      take: 5,
      orderBy: { completedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        post: {
          select: {
            id: true,
            caption: true,
            _count: {
              select: {
                bookmarks: true,
                comments: true,
              },
            },
          },
        },
      },
    });

    // Find posts about this destination
    relevantPosts = await prisma.post.findMany({
      where: {
        trip: {
          destination: {
            contains: destination,
            mode: 'insensitive',
          },
        },
      },
      take: 5,
      orderBy: [{ bookmarks: { _count: 'desc' } }, { createdAt: 'desc' }],
      include: {
        trip: {
          select: {
            destination: true,
            days: true,
            budgetMin: true,
            budgetMax: true,
            itinerary: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            bookmarks: true,
            comments: true,
            likes: true,
          },
        },
      },
    });

    // Find locations in/near this destination
    relevantLocations = await prisma.location.findMany({
      where: {
        OR: [
          { name: { contains: destination, mode: 'insensitive' } },
          { address: { contains: destination, mode: 'insensitive' } },
        ],
      },
      take: 5,
      orderBy: { avgRating: 'desc' },
      include: {
        reviews: {
          take: 2,
          orderBy: { createdAt: 'desc' },
          select: {
            rating: true,
            comment: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  // 3. Extract user constraints from their preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const preferences = user?.preferences as any;
  const constraints: ChatContext['constraints'] = {};

  if (preferences?.budgetRange) {
    constraints.budget = {
      min: preferences.budgetRange.min,
      max: preferences.budgetRange.max,
    };
  }

  if (preferences?.travelStyles) {
    constraints.travelStyles = preferences.travelStyles;
  }

  // 4. Return structured context
  return {
    userTrips: {
      completed: completedTrips,
      saved: savedTrips,
      generated: generatedTrips,
    },
    similarTrips,
    relevantPosts,
    relevantLocations,
    constraints,
  };
}

/**
 * Check if context is sufficient for answering
 */
export function hasEnoughContext(context: ChatContext): boolean {
  const totalTrips =
    context.userTrips.completed.length +
    context.userTrips.saved.length +
    context.similarTrips.length;

  const totalContent =
    totalTrips +
    context.relevantPosts.length +
    context.relevantLocations.length;

  // Need at least some data to reason about
  return totalContent > 0;
}

/**
 * Extract destination from user message
 * Simple keyword extraction - no ML needed
 */
export function extractDestination(message: string): string | undefined {
  const lowerMessage = message.toLowerCase();

  // Common Nepal destinations
  const destinations = [
    'kathmandu',
    'pokhara',
    'chitwan',
    'lumbini',
    'nagarkot',
    'patan',
    'bhaktapur',
    'annapurna',
    'everest',
    'abc',
    'ebc',
    'langtang',
    'mustang',
  ];

  for (const dest of destinations) {
    if (lowerMessage.includes(dest)) {
      return dest.charAt(0).toUpperCase() + dest.slice(1);
    }
  }

  return undefined;
}

/**
 * Detect intent from user message
 * Lightweight classification using rules
 */
export function detectIntent(
  message: string
): 'PLAN' | 'MODIFY' | 'COMPARE' | 'RECALL' | 'EXPLORE' | 'GENERAL' {
  const lower = message.toLowerCase();

  // PLAN: Creating new itinerary
  if (
    lower.includes('plan') ||
    lower.includes('create') ||
    lower.includes('itinerary') ||
    lower.includes('trip to') ||
    lower.includes('visit')
  ) {
    return 'PLAN';
  }

  // MODIFY: Changing existing plan
  if (
    lower.includes('cheaper') ||
    lower.includes('shorter') ||
    lower.includes('longer') ||
    lower.includes('change') ||
    lower.includes('modify') ||
    lower.includes('instead')
  ) {
    return 'MODIFY';
  }

  // COMPARE: Comparing options
  if (
    lower.includes('compare') ||
    lower.includes('vs') ||
    lower.includes('versus') ||
    lower.includes('difference') ||
    lower.includes('better')
  ) {
    return 'COMPARE';
  }

  // RECALL: Remembering past trips
  if (
    lower.includes('last time') ||
    lower.includes('previous') ||
    lower.includes('did i') ||
    lower.includes('where did') ||
    lower.includes('remember')
  ) {
    return 'RECALL';
  }

  // EXPLORE: Finding similar trips
  if (
    lower.includes('similar') ||
    lower.includes('like this') ||
    lower.includes('others') ||
    lower.includes('also')
  ) {
    return 'EXPLORE';
  }

  return 'GENERAL';
}

export default {
  buildChatContext,
  hasEnoughContext,
  extractDestination,
  detectIntent,
};

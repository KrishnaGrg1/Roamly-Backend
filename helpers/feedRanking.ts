/**
 * Feed Ranking Algorithm for Roamly
 *
 * Ranking Weights:
 * - Trip Quality: 40%
 * - Engagement Quality: 20%
 * - Relevance to Viewer: 20%
 * - Trust & Credibility: 10%
 * - Freshness: 10%
 */

import type { TravelStyle } from '../generated/prisma/client';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Simple lat/lng lookup for major Nepal destinations
 * TODO: Store in database for production
 */
const NEPAL_DESTINATIONS: Record<string, { lat: number; lng: number }> = {
  Kathmandu: { lat: 27.7172, lng: 85.324 },
  Pokhara: { lat: 28.2096, lng: 83.9856 },
  Chitwan: { lat: 27.5291, lng: 84.3542 },
  Lumbini: { lat: 27.4833, lng: 83.2764 },
  Nagarkot: { lat: 27.7172, lng: 85.5201 },
  Bhaktapur: { lat: 27.6728, lng: 85.4298 },
  Patan: { lat: 27.6684, lng: 85.3247 },
};

export type FeedMode = 'balanced' | 'nearby' | 'trek' | 'budget';

export interface TripData {
  id: string;
  source: string;
  destination: string;
  days: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  travelStyle: TravelStyle[];
  itinerary: any;
  costBreakdown?: any;
  completedAt?: Date | null;
  userId: string;
}

export interface EngagementData {
  likes: number;
  comments: number;
  bookmarks: number;
}

export interface UserContext {
  userId?: string;
  latitude?: number;
  longitude?: number;
  preferredBudgetMin?: number;
  preferredBudgetMax?: number;
  preferredStyles?: TravelStyle[];
  completedTripsCount?: number;
}

export interface PostWithScore {
  post: any;
  score: number;
  breakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  tripQuality: number;
  engagement: number;
  relevance: number;
  trust: number;
  freshness: number;
  total: number;
}

/**
 * 1️⃣ Calculate Trip Quality Score (0-100)
 * Weight: 40% of final score
 *
 * Measures completeness and detail of trip planning
 */
export function calculateTripQualityScore(trip: TripData): number {
  let score = 0;
  const itinerary = trip.itinerary || {};
  const costBreakdown = trip.costBreakdown || {};

  // Base score for having a trip
  score += 10;

  // Days planned properly (0-15 points)
  if (trip.days > 0) {
    if (trip.days >= 1 && trip.days <= 3) score += 10;
    else if (trip.days >= 4 && trip.days <= 7) score += 15;
    else if (trip.days >= 8) score += 12;
  }

  // Itinerary detail (0-20 points)
  if (
    itinerary.days &&
    Array.isArray(itinerary.days) &&
    itinerary.days.length > 0
  ) {
    const dayCount = itinerary.days.length;
    if (dayCount >= trip.days) score += 10; // Has all days

    // Check for activity details (handle undefined gracefully)
    const hasActivities = itinerary.days.some(
      (day: any) =>
        day?.activities &&
        Array.isArray(day.activities) &&
        day.activities.length > 0
    );
    if (hasActivities) score += 10;
  }

  // Budget realism (0-15 points)
  if (trip.budgetMin != null && trip.budgetMax != null) {
    if (trip.budgetMin > 0 && trip.budgetMax > trip.budgetMin) {
      score += 10;
      // Bonus for cost breakdown
      if (costBreakdown.total) score += 5;
    }
  }

  // Accommodation planning (0-10 points)
  const hasAccommodation = itinerary.days?.some(
    (day: any) => day.accommodation?.name
  );
  if (hasAccommodation) score += 10;

  // Meals planning (0-10 points)
  const hasMeals = itinerary.days?.some(
    (day: any) => day.meals && day.meals.length > 0
  );
  if (hasMeals) score += 10;

  // Transportation details (0-10 points)
  if (itinerary.transportation) {
    if (itinerary.transportation.toDestination) score += 5;
    if (itinerary.transportation.withinDestination) score += 5;
  }

  // Tips and overview (0-10 points)
  if (itinerary.tips && itinerary.tips.length > 0) score += 5;
  if (itinerary.overview) score += 5;

  return Math.min(score, 100);
}

/**
 * 2️⃣ Calculate Engagement Quality Score (0-100)
 * Weight: 20% of final score
 *
 * Weighted engagement to avoid vanity metrics
 * Save = 5, Bookmark = 4, Comment = 3, Like = 1
 */
export function calculateEngagementScore(engagement: EngagementData): number {
  const WEIGHTS = {
    save: 5, // Highest intent
    bookmark: 4, // Strong intent
    comment: 3, // Medium engagement
    like: 1, // Weak signal
  };

  // Note: saves and bookmarks might be same in current schema
  const weightedScore =
    engagement.bookmarks * WEIGHTS.save +
    engagement.comments * WEIGHTS.comment +
    engagement.likes * WEIGHTS.like;

  // Normalize to 0-100 using logarithmic scale
  // This prevents viral posts from dominating
  const normalized = Math.log(weightedScore + 1) * 15;

  return Math.min(normalized, 100);
}

/**
 * 3️⃣ Calculate Relevance Score (0-100)
 * Weight: 20% of final score
 *
 * Personalization based on user preferences and location
 */
export function calculateRelevanceScore(
  trip: TripData,
  userContext: UserContext
): number {
  let score = 50; // Start at neutral

  if (!userContext.userId) {
    return score; // Non-logged users get neutral relevance
  }

  // Travel style match (0-25 points)
  if (userContext.preferredStyles && userContext.preferredStyles.length > 0) {
    const matchingStyles = trip.travelStyle.filter((style) =>
      userContext.preferredStyles!.includes(style)
    );
    score += (matchingStyles.length / trip.travelStyle.length) * 25;
  }

  // Budget similarity (0-25 points)
  if (userContext.preferredBudgetMin && userContext.preferredBudgetMax) {
    const tripBudgetAvg =
      trip.budgetMin && trip.budgetMax
        ? (trip.budgetMin + trip.budgetMax) / 2
        : null;

    const userBudgetAvg =
      (userContext.preferredBudgetMin + userContext.preferredBudgetMax) / 2;

    if (tripBudgetAvg) {
      const budgetDiff = Math.abs(tripBudgetAvg - userBudgetAvg);
      const maxDiff = userBudgetAvg * 2; // Allow 200% difference
      const similarity = Math.max(0, 1 - budgetDiff / maxDiff);
      score += similarity * 25;
    }
  }

  // Location proximity (0-20 points)
  if (userContext.latitude && userContext.longitude) {
    // Try to get destination coordinates
    const destinationCoords = NEPAL_DESTINATIONS[trip.destination];

    if (destinationCoords) {
      const distance = calculateDistance(
        userContext.latitude,
        userContext.longitude,
        destinationCoords.lat,
        destinationCoords.lng
      );

      // Score based on distance (closer = better)
      // 0-50km: 20 points, 50-150km: 10 points, >150km: 0 points
      if (distance <= 50) {
        score += 20;
      } else if (distance <= 150) {
        score += 10 * (1 - (distance - 50) / 100);
      }
    }
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * 4️⃣ Calculate Trust & Credibility Score (0-100)
 * Weight: 10% of final score
 *
 * Measures believability and user reputation
 */
export function calculateTrustScore(
  trip: TripData,
  userCompletedTripsCount: number = 0
): number {
  let score = 30; // Base trust score

  // User has completed multiple trips (0-40 points)
  if (userCompletedTripsCount >= 1) score += 10;
  if (userCompletedTripsCount >= 3) score += 15;
  if (userCompletedTripsCount >= 5) score += 15;

  // Trip was actually completed (0-40 points)
  // NOTE: Review detection removed - Trip model doesn't have reviews relation
  // Reviews are linked to Location, not Trip directly
  if (trip.completedAt) score += 40; // Increased from 20 to compensate for removed review points

  return Math.min(score, 100);
}

/**
 * 5️⃣ Calculate Freshness Score (0-100)/**
 * 5️⃣ Calculate Freshness Score (0-100)
 * Weight: 10% of final score
 *
 * Time decay function - new content surfaces but doesn't dominate
 */
export function calculateFreshnessScore(
  completedAt: Date | null,
  isTrek: boolean = false
): number {
  if (!completedAt) return 50; // Neutral for incomplete trips

  const now = new Date();
  const ageInDays =
    (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Trek posts decay slower (evergreen content)
  const decayRate = isTrek ? 0.5 : 1;

  let score: number;

  if (ageInDays <= 7) {
    // Fresh content - strong boost
    score = 100;
  } else if (ageInDays <= 30) {
    // Recent content - moderate boost
    score = 100 - (ageInDays - 7) * 2 * decayRate;
  } else if (ageInDays <= 90) {
    // Aging content - slow decay
    score = 54 - (ageInDays - 30) * 0.5 * decayRate;
  } else {
    // Old content - minimal visibility
    score = 24 - (ageInDays - 90) * 0.1 * decayRate;
  }

  return Math.max(Math.min(score, 100), 0);
}

/**
 * Calculate final feed score
 *
 * Formula:
 * score = (tripQuality * 0.40) + (engagement * 0.20) +
 *         (relevance * 0.20) + (trust * 0.10) + (freshness * 0.10)
 */
export function calculateFeedScore(
  trip: TripData,
  engagement: EngagementData,
  userContext: UserContext,
  userCompletedTripsCount: number = 0,
  mode: FeedMode = 'balanced'
): { score: number; breakdown: ScoreBreakdown } {
  const tripQuality = calculateTripQualityScore(trip);
  const engagementScore = calculateEngagementScore(engagement);
  const relevance = calculateRelevanceScore(trip, userContext);
  const trust = calculateTrustScore(trip, userCompletedTripsCount);
  const isTrek =
    trip.travelStyle.includes('ADVENTURE') ||
    trip.destination.toLowerCase().includes('trek');
  const freshness = calculateFreshnessScore(trip.completedAt || null, isTrek);

  // Adjust weights based on feed mode
  let weights = {
    tripQuality: 0.4,
    engagement: 0.2,
    relevance: 0.2,
    trust: 0.1,
    freshness: 0.1,
  };

  switch (mode) {
    case 'nearby':
      weights = {
        tripQuality: 0.3,
        engagement: 0.15,
        relevance: 0.4, // Boost relevance
        trust: 0.05,
        freshness: 0.1,
      };
      break;
    case 'trek':
      weights = {
        tripQuality: 0.45, // Boost quality for treks
        engagement: 0.15,
        relevance: 0.15,
        trust: 0.2, // Boost trust for treks
        freshness: 0.05, // Lower freshness (evergreen)
      };
      break;
    case 'budget':
      weights = {
        tripQuality: 0.35,
        engagement: 0.2,
        relevance: 0.3, // Boost relevance (budget matching)
        trust: 0.1,
        freshness: 0.05,
      };
      break;
  }

  const finalScore =
    tripQuality * weights.tripQuality +
    engagementScore * weights.engagement +
    relevance * weights.relevance +
    trust * weights.trust +
    freshness * weights.freshness;

  return {
    score: finalScore,
    breakdown: {
      tripQuality,
      engagement: engagementScore,
      relevance,
      trust,
      freshness,
      total: finalScore,
    },
  };
}

/**
 * Sort posts by calculated feed score
 */
export function rankPosts(
  posts: any[],
  userContext: UserContext,
  mode: FeedMode = 'balanced',
  userCompletedTripsMap?: Map<string, number>
): PostWithScore[] {
  const rankedPosts = posts.map((post) => {
    const trip = post.trip;

    // Safety check for null trip
    if (!trip) {
      return {
        post,
        score: 0,
        breakdown: {
          tripQuality: 0,
          engagement: 0,
          relevance: 0,
          trust: 0,
          freshness: 0,
          total: 0,
        },
      };
    }

    const engagement = {
      likes: post._count?.likes || 0,
      comments: post._count?.comments || 0,
      bookmarks: post._count?.bookmarks || 0,
    };

    // Get user's completed trips count from the map
    const userCompletedTripsCount =
      userCompletedTripsMap?.get(trip.userId) || 0;

    const { score, breakdown } = calculateFeedScore(
      trip,
      engagement,
      userContext,
      userCompletedTripsCount,
      mode
    );

    return {
      post,
      score,
      breakdown,
    };
  });

  // Sort by score descending
  return rankedPosts.sort((a, b) => b.score - a.score);
}

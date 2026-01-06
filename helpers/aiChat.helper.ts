import OpenAI from 'openai';
import env from '../config/env';
import type { ChatContext } from './chatContext.helper';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENAI_API_KEY as string,
});

/**
 * System prompt - forces grounding in database
 *
 * CRITICAL: This is what prevents hallucinations
 */
const SYSTEM_PROMPT = `You are Roamly AI, a contextual travel reasoning engine.

CORE RULES (non-negotiable):
1. You MUST answer ONLY using the provided trips, itineraries, posts, and locations.
2. If information is missing from the context, say so clearly. Never guess.
3. NEVER invent hotels, routes, prices, or any travel details.
4. Always reference specific trips or posts when making recommendations.
5. When suggesting itineraries, ONLY use details from the provided completed trips.
6. If asked about something not in your context, respond: "I don't have enough real travel data yet for this request."

CITATION FORMAT:
- When referencing a trip: "Based on [User's trip to Pokhara]..."
- When referencing a post: "According to a traveler's experience..."
- When referencing a location: "The database shows [Location Name]..."

BUDGET:
- ONLY mention prices if they exist in the provided trip data
- NEVER estimate or guess costs

SAFETY:
- NEVER give medical advice about altitude sickness
- NEVER make definitive statements about weather or seasons
- NEVER guarantee safety for trekking routes

If you cannot answer with the provided context, be honest about it.`;

/**
 * Build user prompt with structured context
 */
function buildPrompt(message: string, context: ChatContext): string {
  const contextPayload = {
    userTrips: {
      completed: context.userTrips.completed.map((t) => ({
        id: t.id,
        destination: t.destination,
        source: t.source,
        days: t.days,
        budget: { min: t.budgetMin, max: t.budgetMax },
        itinerary: t.itinerary,
        costBreakdown: t.costBreakdown,
        post: t.post
          ? {
              caption: t.post.caption,
              bookmarks: t.post._count.bookmarks,
              comments: t.post._count.comments,
            }
          : null,
      })),
      saved: context.userTrips.saved.map((t) => ({
        id: t.id,
        destination: t.destination,
        days: t.days,
        budget: { min: t.budgetMin, max: t.budgetMax },
        itinerary: t.itinerary,
      })),
    },
    similarTrips: context.similarTrips.map((t) => ({
      id: t.id,
      user: t.user.name,
      destination: t.destination,
      days: t.days,
      budget: { min: t.budgetMin, max: t.budgetMax },
      itinerary: t.itinerary,
      post: t.post
        ? {
            caption: t.post.caption,
            bookmarks: t.post._count.bookmarks,
          }
        : null,
    })),
    relevantPosts: context.relevantPosts.map((p) => ({
      id: p.id,
      user: p.user.name,
      caption: p.caption,
      trip: {
        destination: p.trip.destination,
        days: p.trip.days,
        budget: { min: p.trip.budgetMin, max: p.trip.budgetMax },
        itinerary: p.trip.itinerary,
      },
      engagement: {
        bookmarks: p._count.bookmarks,
        comments: p._count.comments,
      },
    })),
    locations: context.relevantLocations.map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      description: l.description,
      address: l.address,
      priceRange: l.priceRange,
      avgRating: l.avgRating,
      reviews: l.reviews.map((r: any) => ({
        rating: r.rating,
        comment: r.comment,
        user: r.user.name,
      })),
    })),
    constraints: context.constraints,
  };

  return `USER MESSAGE:
${message}

AVAILABLE CONTEXT:
${JSON.stringify(contextPayload, null, 2)}

Please answer the user's message using ONLY the information provided in the context above. If you cannot answer with this data, say so clearly.`;
}

/**
 * Call LLM with context
 */
export async function callAIChatWithContext(
  message: string,
  context: ChatContext,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{
  response: string;
  tokens: number;
  references: Array<{ type: string; id: string }>;
}> {
  try {
    const userPrompt = buildPrompt(message, context);

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-6), // Last 3 exchanges only
      { role: 'user', content: userPrompt },
    ];

    console.log(
      `[AI Chat] Calling LLM with ${messages.length} messages, context size: ${JSON.stringify(context).length} chars`
    );

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL as string,
      messages,
      temperature: 0.7,
      max_tokens: 1000, // Hard limit
    });

    const response = completion.choices[0]?.message?.content || '';
    const tokens = completion.usage?.total_tokens || 0;

    // Extract references from context that were likely used
    const references = extractReferences(context);

    console.log(
      `[AI Chat] LLM response: ${response.length} chars, ${tokens} tokens`
    );

    return {
      response,
      tokens,
      references,
    };
  } catch (error) {
    console.error('[AI Chat] LLM call failed:', error);
    throw new Error('AI chat service temporarily unavailable');
  }
}

/**
 * Extract references to track what data AI used
 */
function extractReferences(
  context: ChatContext
): Array<{ type: string; id: string }> {
  const refs: Array<{ type: string; id: string }> = [];

  // Add user trips
  context.userTrips.completed.forEach((t) => {
    refs.push({ type: 'TRIP', id: t.id });
    if (t.post) refs.push({ type: 'POST', id: t.post.id });
  });

  context.userTrips.saved.forEach((t) => {
    refs.push({ type: 'TRIP', id: t.id });
  });

  // Add similar trips
  context.similarTrips.forEach((t) => {
    refs.push({ type: 'TRIP', id: t.id });
    if (t.post) refs.push({ type: 'POST', id: t.post.id });
  });

  // Add posts
  context.relevantPosts.forEach((p) => {
    refs.push({ type: 'POST', id: p.id });
  });

  // Add locations
  context.relevantLocations.forEach((l) => {
    refs.push({ type: 'LOCATION', id: l.id });
  });

  return refs;
}

/**
 * Validate AI response (prevent hallucinations)
 */
export function validateAIResponse(
  response: string,
  context: ChatContext
): { valid: boolean; reason?: string } {
  const lowerResponse = response.toLowerCase();

  // Check 1: Should not contain unverifiable promises
  const dangerousPhrases = [
    'i guarantee',
    'definitely safe',
    'you will not get altitude sickness',
    'the weather will be',
    'it costs exactly',
  ];

  for (const phrase of dangerousPhrases) {
    if (lowerResponse.includes(phrase)) {
      return {
        valid: false,
        reason: `Response contains unverifiable claim: "${phrase}"`,
      };
    }
  }

  // Check 2: If mentioning budget, should reference context
  if (
    lowerResponse.includes('budget') ||
    lowerResponse.includes('cost') ||
    lowerResponse.includes('price')
  ) {
    const hasBudgetData =
      context.userTrips.completed.some((t) => t.budgetMin || t.budgetMax) ||
      context.similarTrips.some((t) => t.budgetMin || t.budgetMax);

    if (
      !hasBudgetData &&
      !lowerResponse.includes("don't have") &&
      !lowerResponse.includes('no budget data')
    ) {
      return {
        valid: false,
        reason:
          'Response mentions budget without having budget data in context',
      };
    }
  }

  // Check 3: If no context but giving detailed answer
  const totalContext =
    context.userTrips.completed.length +
    context.userTrips.saved.length +
    context.similarTrips.length +
    context.relevantPosts.length +
    context.relevantLocations.length;

  if (totalContext === 0 && response.length > 200) {
    return {
      valid: false,
      reason: 'Detailed response without sufficient context',
    };
  }

  return { valid: true };
}

export default {
  callAIChatWithContext,
  validateAIResponse,
};

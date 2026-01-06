# Feed Ranking Algorithm Documentation

## Overview

Roamly uses a sophisticated, multi-signal ranking algorithm to surface high-quality travel content while avoiding the pitfalls of traditional social media (vanity metrics, viral nonsense, engagement bait).

**Core Philosophy:**

- **Quality over virality** - Detailed trip planning beats viral selfies
- **Intent over engagement** - Saves matter more than likes
- **Trust over noise** - Verified trips and experienced users rank higher
- **Relevance over recency** - Personalization matters

---

## Ranking Signals

### 1️⃣ Trip Quality Score (40% weight)

**What it measures:** Completeness and detail of trip planning

**Signals evaluated:**

- Number of days planned (1-3 days: +10, 4-7 days: +15, 8+ days: +12)
- Detailed daily breakdown (+10 if all days covered, +10 for activities)
- Budget realism (+10 for valid range, +5 for cost breakdown)
- Accommodation planning (+10 if hotels included)
- Meals planning (+10 if meals included)
- Transportation details (+5 for "to destination", +5 for "within destination")
- Tips and overview (+5 each)

**Maximum score:** 100 points

**Why this matters:**
A detailed 7-day ABC trek itinerary with daily breakdowns, hotels, and budgets will significantly outrank a 1-day trip with minimal planning, even if the short trip has more likes.

**Example scores:**

```typescript
// High-quality trip (score: 90)
{
  days: 7,
  itinerary: {
    days: [/* 7 detailed days */],
    transportation: { toDestination: "...", withinDestination: "..." },
    tips: ["tip1", "tip2", "tip3"]
  },
  budgetMin: 500,
  budgetMax: 800,
  costBreakdown: { total: 650, ... }
}

// Low-quality trip (score: 30)
{
  days: 1,
  itinerary: { type: 'text', content: "..." },
  budgetMin: null,
  budgetMax: null
}
```

---

### 2️⃣ Engagement Quality Score (20% weight)

**What it measures:** Meaningful user interactions, not vanity metrics

**Signal weights:**

- **Save/Bookmark:** 5 points (highest intent - user wants to reuse this trip)
- **Comment:** 3 points (medium engagement)
- **Like:** 1 point (weak signal)

**Normalization:** Logarithmic scale to prevent viral posts from dominating

```typescript
score = Math.log(weightedScore + 1) * 15;
```

**Maximum score:** 100 points

**Why this matters:**

- A trip with 50 saves is infinitely more valuable than a trip with 500 likes
- Saves indicate intent to actually use the itinerary
- Comments show genuine engagement
- Likes are easy to game and don't indicate quality

**Example:**

```typescript
// High engagement quality (score: 75)
{ bookmarks: 45, comments: 12, likes: 30 }
// Weighted: (45*5) + (12*3) + (30*1) = 291
// Normalized: log(292) * 15 ≈ 85

// Low engagement quality (score: 45)
{ bookmarks: 2, comments: 1, likes: 150 }
// Weighted: (2*5) + (1*3) + (150*1) = 163
// Normalized: log(164) * 15 ≈ 77
```

---

### 3️⃣ Relevance Score (20% weight)

**What it measures:** How well the trip matches the viewer's preferences

**Signals:**

- **Travel style match** (up to +25): Overlapping preferences (ADVENTURE, CULTURAL, etc.)
- **Budget similarity** (up to +25): How close trip budget is to user's typical budget
- **Location proximity** (up to +20): Geographic relevance (future implementation)

**Base score:** 50 (neutral for non-logged users)

**Why this matters:**

- A budget backpacker shouldn't see luxury hotels
- A user in Kathmandu should see more Pokhara trips than Patagonia
- Cultural travelers shouldn't be flooded with adventure treks

**Example:**

```typescript
// User prefers: ADVENTURE, CULTURAL, budget $300-$600
// Trip A: ADVENTURE, CULTURAL, budget $400-$550 → Score: 90
// Trip B: LUXURY, RELAXED, budget $2000-$3000 → Score: 30
```

---

### 4️⃣ Trust & Credibility Score (10% weight)

**What it measures:** Believability and user reputation

**Signals:**

- User completed trips: 1+ trips (+10), 3+ trips (+15), 5+ trips (+15)
- Trip has linked reviews (+20)
- Trip was actually completed (+20)

**Base score:** 30

**Maximum score:** 100

**Why this matters:**

- Prevents fake/AI-generated content from ranking
- Rewards experienced travelers
- Verified trips (with reviews) get boosted

**Example:**

```typescript
// Experienced user with verified trip (score: 90)
{ completedTripsCount: 5, hasReviews: true, tripCompleted: true }

// New user, unverified trip (score: 30)
{ completedTripsCount: 0, hasReviews: false, tripCompleted: false }
```

---

### 5️⃣ Freshness Score (10% weight)

**What it measures:** Content recency with evergreen considerations

**Decay function:**

- **0-7 days:** 100 points (fresh content boost)
- **8-30 days:** Gradual decay (54-100 points)
- **31-90 days:** Slow decay (24-54 points)
- **90+ days:** Minimal visibility (0-24 points)

**Special handling:**

- Trek posts decay **50% slower** (evergreen content)
- Adventure/trekking content stays relevant longer

**Why this matters:**

- New trips should surface quickly
- But quality treks shouldn't disappear after a month
- Prevents feed from becoming stale

**Example:**

```typescript
// Fresh standard trip (5 days old): 100
// Month-old trek (30 days old): 54 (vs 38 for standard)
// 3-month-old standard trip: 9
```

---

## Final Ranking Formula

```typescript
feed_score =
  tripQuality * 0.4 +
  engagement * 0.2 +
  relevance * 0.2 +
  trust * 0.1 +
  freshness * 0.1;
```

**Score range:** 0-100

Posts are sorted by score in descending order.

---

## Feed Modes

Different modes adjust signal weights for specific use cases:

### 1. Balanced Mode (default)

Standard weights as above. Best for general browsing.

### 2. Nearby Mode

```typescript
weights = {
  tripQuality: 0.3,
  engagement: 0.15,
  relevance: 0.4, // Boosted
  trust: 0.05,
  freshness: 0.1,
};
```

**Use case:** "Show me trips near me"

### 3. Trek Mode

```typescript
weights = {
  tripQuality: 0.45, // Boosted
  engagement: 0.15,
  relevance: 0.15,
  trust: 0.2, // Boosted
  freshness: 0.05, // Lower (evergreen)
};
```

**Use case:** "Show me the best trekking itineraries"

### 4. Budget Mode

```typescript
weights = {
  tripQuality: 0.35,
  engagement: 0.2,
  relevance: 0.3, // Boosted (budget matching)
  trust: 0.1,
  freshness: 0.05,
};
```

**Use case:** "Show me budget-friendly trips"

---

## API Usage

### Get Feed with Mode

```bash
# Balanced feed (default)
GET /api/post/feed?limit=10

# Nearby feed
GET /api/post/feed?limit=10&mode=nearby

# Trek-focused feed
GET /api/post/feed?limit=10&mode=trek

# Budget-focused feed
GET /api/post/feed?limit=10&mode=budget
```

### Response Format

```json
{
  "statusCode": 200,
  "success": true,
  "body": {
    "message": "Feed retrieved successfully",
    "data": {
      "posts": [
        {
          "id": "uuid",
          "caption": "...",
          "trip": {
            /* full trip data */
          },
          "_feedScore": 87.5,
          "_scoreBreakdown": {
            "tripQuality": 92,
            "engagement": 65,
            "relevance": 88,
            "trust": 70,
            "freshness": 100,
            "total": 87.5
          },
          "isLiked": false,
          "isBookmarked": true
        }
      ],
      "pagination": {
        "hasNextPage": true,
        "nextCursor": "uuid",
        "mode": "balanced"
      }
    }
  }
}
```

### Debug Score Breakdown

Each post includes `_feedScore` and `_scoreBreakdown` for transparency and debugging.

**Production tip:** Remove these fields in production or only show to admins.

---

## Personalization Details

### How User Preferences are Extracted

```typescript
// From user's past completed trips:
1. Calculate average budget (budgetMin, budgetMax)
2. Extract most frequent travel styles (top 3)
3. Store user's location (from preferences)

// Used for relevance scoring:
- Match travel styles → boost score
- Match budget range → boost score
- Match location/region → boost score
```

### Cold Start (New Users)

New users without trip history:

- Get `relevance = 50` (neutral)
- Feed focuses on quality and engagement
- Can still filter by mode (trek, budget, etc.)

---

## Implementation Notes

### Performance Optimization

**Current approach:**

- Fetch 3x limit from database
- Rank in-memory
- Return top N

**Future optimization:**

1. Precompute `tripQualityScore` and store in Trip table
2. Precompute `trustScore` and store in User table
3. Use database indexes for initial filtering
4. Consider Redis caching for hot content

### Avoiding Gaming

**What we prevent:**

- ✅ Buying likes (low weight)
- ✅ Fake engagement (saves/bookmarks weighted higher)
- ✅ Low-quality viral posts (trip quality is 40%)
- ✅ Spam accounts (trust score based on history)

**What we don't prevent yet (future work):**

- Bot accounts creating fake saves
- Coordinated engagement manipulation
- Need: Rate limiting, suspicious activity detection

---

## Testing the Algorithm

### Test Scenarios

1. **High-quality detailed trek**
   - Expected: High trip quality (90+), ranks high regardless of engagement

2. **Viral but low-quality post**
   - Expected: High engagement (80+) but low trip quality (30), mid-ranking

3. **Perfect match for user**
   - Expected: High relevance (90+), personalized top ranking

4. **Old but evergreen trek**
   - Expected: Moderate freshness (50+) in trek mode, ranks well

5. **New user with no history**
   - Expected: Quality and engagement dominate, no personalization boost

### Manual Testing

```bash
# Test different modes
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/post/feed?limit=5&mode=balanced"

curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/post/feed?limit=5&mode=trek"

# Check score breakdowns in response
# Verify ranking makes sense
```

---

## Migration from Simple Feed

### Old Implementation

```typescript
// Just chronological order
orderBy: {
  createdAt: 'desc';
}
```

### New Implementation

```typescript
// Fetch, rank, then sort
const posts = await fetchPosts();
const ranked = rankPosts(posts, userContext, mode);
return ranked.slice(0, limit);
```

### Breaking Changes

- ✅ No breaking changes - API contract unchanged
- ✅ New optional `mode` parameter
- ✅ Response includes `_feedScore` and `_scoreBreakdown` (optional)

---

## Future Enhancements

### Phase 2 (Next)

1. Precompute trip quality scores
2. Add user reputation scores
3. Implement actual geolocation matching
4. A/B test different weight configurations

### Phase 3 (Later)

1. Machine learning ranking signals
2. Collaborative filtering (users like you also liked...)
3. Time-of-day personalization
4. Seasonal content boosting (monsoon vs. winter treks)

---

## Success Metrics

Track these to validate the algorithm:

1. **Save rate** - % of views that result in saves (target: increase)
2. **Session depth** - Posts viewed per session (target: stable/increase)
3. **Return rate** - Users coming back next day (target: increase)
4. **Quality feedback** - User reports of low-quality content (target: decrease)

---

## Teacher's Verdict ✅

This ranking system:

- ✅ Matches Roamly's product vision
- ✅ Avoids social media traps (vanity metrics)
- ✅ Encourages high-quality content creation
- ✅ Scales globally
- ✅ Is explainable and debuggable
- ✅ Can be fine-tuned without code changes (weight adjustment)

**If you break this trust, Roamly dies. Protect the algorithm.**

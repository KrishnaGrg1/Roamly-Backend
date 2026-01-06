# Roamly Implementation Roadmap

## Schema Refactor: COMPLETE ✅

The Prisma schema has been successfully refactored with Trip as the core entity. Key changes:

### What Changed

1. **Trip Model** - Now the single source of truth for journeys
   - Added: `title`, `source`, `destination`, `budgetMin`, `budgetMax`
   - Added: `aiModel`, `aiVersion`, `completedAt`
   - Removed: `startLocation`, `budget` (string)

2. **Post Model** - Now represents completed trips only
   - **BREAKING**: Removed `mediaUrl`, `mediaType`, `locationId`
   - Added: `tripId` (unique) - One post per trip
   - Posts are now social representations of completed trips

3. **Location Model** - Google Maps-first approach
   - Added: `googlePlaceId` (unique) - For Google Places API integration

4. **Review Model** - Optional trip verification
   - Added: `tripId` (optional) - Link reviews to verified trips

5. **AiInteraction Model** - Better logging
   - Added: `purpose` - Track intent of AI interactions
   - Removed: `feedback` - Simplified model

6. **Removed Models** - Cleaned up redundancy
   - ❌ `Route` - Use Google Maps API instead
   - ❌ `TravelHistory` - Use Trip.status tracking instead

---

## PHASE 1: CORE UNIFICATION (CRITICAL - DO FIRST)

### Goal

Make Trip the center of everything. Complete the Trip → Post → Feed loop.

### Tasks

#### 1.1 Trip Routes & Controller

- [ ] `POST /api/trip/generate` - Generate AI itinerary
  - Body: `{ source, destination, days, budgetMin?, budgetMax?, travelStyle[] }`
  - Creates Trip with `status: GENERATED`
  - Logs AI interaction with `purpose: "generate_itinerary"`

- [ ] `PUT /api/trip/:id` - Update trip details
  - Allow editing itinerary, title, dates
  - Keep Trip.status as-is

- [ ] `POST /api/trip/:id/complete` - Mark trip as completed
  - Set `status: COMPLETED`, `completedAt: now()`
  - **Business Rule**: Only COMPLETED trips can create posts

- [ ] `GET /api/trip/my` - List user's trips
  - Filter by status (generated, saved, completed)
  - Include pagination

- [ ] `GET /api/trip/:id` - Get single trip with full itinerary
  - Include related post if exists

**Files to modify:**

- Create: `controllers/trip.controller.ts`
- Create: `routes/trip.routes.ts`
- Create: `validation/trip.validation.ts`
- Update: `routes/main.routes.ts` - Add trip routes

#### 1.2 Refactor Post Routes

- [ ] Remove standalone media upload endpoints
- [ ] `POST /api/post` - Create post from completed trip only
  - Body: `{ tripId, caption }`
  - **Validation**: Verify Trip.status === 'COMPLETED'
  - **Validation**: Verify no existing post for this tripId

- [ ] Update `GET /api/post/feed` to fetch posts with trip data
  - Join with Trip table
  - Show trip itinerary preview in feed

**Files to modify:**

- `controllers/post.controller.ts` - Remove media logic, enforce trip requirement
- `validation/post.validation.ts` - Add trip validation
- `routes/post.routes.ts` - Update endpoints

#### 1.3 Frontend Breaking Changes

⚠️ **Important**: Old post creation will break

**What to update:**

- Post creation UI must now:
  1. Complete a trip first
  2. Then create post from that trip
- Feed UI should show trip data instead of just media

---

## PHASE 2: AI QUALITY & COST CONTROL

### Goal

Split AI by intent, add versioning, reduce costs through caching

### Tasks

#### 2.1 Split AI Routes by Purpose

- [ ] `POST /ai/itinerary/from-source-destination`
  - Traditional itinerary generation
  - Purpose: `"generate_itinerary"`

- [ ] `POST /ai/itinerary/explore`
  - Discovery-based itinerary
  - Purpose: `"explore_destination"`

- [ ] `POST /ai/itinerary/trek`
  - Trekking-specific planning
  - Purpose: `"plan_trek"`

- [ ] `POST /ai/itinerary/refine`
  - Refine existing itinerary
  - Purpose: `"refine_itinerary"`
  - Body includes existing tripId

**Files to modify:**

- `controllers/ai.controller.ts` - Split into specific methods
- `routes/ai.routes.ts` - New endpoints
- `helpers/ai.helper.ts` - Add purpose tracking

#### 2.2 AI Versioning

- [ ] Add `AI_MODEL_VERSION` environment variable
- [ ] Store `aiModel` and `aiVersion` in Trip on generation
- [ ] Log all AI calls to `AiInteraction` with purpose

**Files to modify:**

- `config/env.ts` - Add AI_MODEL_VERSION
- All AI controller methods - Add version tracking

#### 2.3 Itinerary Caching (Optional)

- [ ] Cache common routes (e.g., Kathmandu → Pokhara)
- [ ] Use Redis or in-memory cache
- [ ] Check cache before AI call

---

## PHASE 3: MAP & DISCOVERY

### Goal

Location-centric discovery and visualization

### Tasks

#### 3.1 Location → Itineraries

- [ ] `GET /api/location/:id/trips` - Get all trips that visited this location
- [ ] Update Location to extract places from Trip.itinerary

**Files to modify:**

- `controllers/location.controller.ts` - Add trip listing

#### 3.2 Location → Posts

- [ ] `GET /api/location/:id/posts` - Get posts from trips that visited location
- [ ] Join: Location → Trip (via itinerary) → Post

#### 3.3 Google Place Claiming

- [ ] `POST /api/location/claim` - Business claims location via googlePlaceId
- [ ] Verify Google Place ownership
- [ ] Link to Business

**Files to modify:**

- `controllers/location.controller.ts` - Add claiming logic
- `controllers/business.controller.ts` - Update profile with claimed locations

---

## PHASE 4: TRUST & MONETIZATION

### Goal

Build credibility and revenue streams

### Tasks

#### 4.1 Verified Trip Reviews

- [ ] Update Review creation to optionally link tripId
- [ ] Show "Verified Trip" badge if review.tripId exists
- [ ] `GET /api/location/:id/reviews?verified=true` - Filter verified reviews

**Files to modify:**

- `controllers/review.controller.ts` - Add trip validation
- `validation/review.validation.ts` - Add optional tripId

#### 4.2 Guide/Porter Bookings

- [ ] Enforce `Business.type === 'GUIDE'` for guide bookings
- [ ] Add booking confirmation flow
- [ ] Commission calculation

**Files to modify:**

- `controllers/booking.controller.ts` - Add guide-specific logic

#### 4.3 Subscription Enforcement

- [ ] Middleware to check `User.subscriptionTier`
- [ ] Limit free users:
  - 3 AI-generated itineraries per month
  - No offline access
- [ ] Premium users:
  - Unlimited AI itineraries
  - Offline access
  - Priority support

**Files to create:**

- `middlewares/subscription.middleware.ts`

**Files to modify:**

- `controllers/ai.controller.ts` - Add subscription check
- `controllers/trip.controller.ts` - Add offline export for premium

#### 4.4 Business Promotion Logic

- [ ] `GET /api/location/:id/promoted` - Get active promotions
- [ ] Filter by date range
- [ ] Show promoted businesses first in search

**Files to modify:**

- `controllers/location.controller.ts` - Add promotion filtering

---

## PHASE 5: SCALE & POLISH

### Goal

Production-ready features for growth

### Tasks

#### 5.1 Feed Ranking

- [ ] Not just engagement-based
- [ ] Consider:
  - Recency (Trip.completedAt)
  - Trip quality (itinerary richness)
  - User reputation (review count)
  - Bookmarks/saves

**Files to modify:**

- `controllers/post.controller.ts` - Add ranking algorithm

#### 5.2 Offline Itinerary Support

- [ ] `GET /api/trip/:id/offline` - Export trip for offline use
- [ ] Return JSON with embedded maps
- [ ] Premium feature only

#### 5.3 Creator Attribution

- [ ] Track if user followed someone else's itinerary
- [ ] Optional: Add `Trip.basedOnTripId`
- [ ] Show "Inspired by @username" on posts

#### 5.4 Analytics & Abuse Prevention

- [ ] Track popular destinations
- [ ] Rate limiting on AI endpoints
- [ ] Spam detection on posts/reviews

---

## Critical Business Rules (Enforce in Code)

### Post Creation Rule

```typescript
// Only completed trips can create posts
if (trip.status !== 'COMPLETED') {
  throw new Error('Only completed trips can be posted');
}

// One post per trip
const existingPost = await prisma.post.findUnique({
  where: { tripId: trip.id },
});
if (existingPost) {
  throw new Error('This trip already has a post');
}
```

### AI Logging Rule

```typescript
// Log every AI interaction
await prisma.aiInteraction.create({
  data: {
    userId: user.id,
    purpose: 'generate_itinerary', // or explore, trek, refine
    prompt: userPrompt,
    response: aiResponse,
    model: process.env.AI_MODEL,
    tokens: aiTokenCount,
  },
});
```

### Location Uniqueness Rule

```typescript
// Check for existing Google Place before creating location
if (googlePlaceId) {
  const existing = await prisma.location.findUnique({
    where: { googlePlaceId },
  });
  if (existing) return existing; // Don't create duplicate
}
```

---

## Database Migration Notes

### Migration Applied: `20260106150445_refactor_trip_as_core_entity`

**What it did:**

- Migrated existing posts by creating legacy Trip records
- Each old post now has a corresponding Trip with `status: COMPLETED`
- Trip.title set to "Legacy Trip from Post {postId}"
- Removed Route and TravelHistory tables

**Data safety:**

- ✅ No data lost
- ✅ All existing posts preserved
- ✅ All relationships maintained

### Future Migrations

When you need to make schema changes:

```bash
pnpm prisma migrate dev --name "descriptive_name"
```

---

## Testing Strategy

### Must Test

1. **Trip → Post workflow**
   - Generate trip
   - Complete trip
   - Create post
   - Verify post appears in feed

2. **AI versioning**
   - Check AiInteraction logs
   - Verify purpose field
   - Confirm token counting

3. **Location Google Places**
   - Create location with googlePlaceId
   - Try creating duplicate
   - Verify uniqueness constraint

4. **Business rules enforcement**
   - Try posting incomplete trip (should fail)
   - Try creating duplicate post (should fail)

---

## Architecture Maturity: ACHIEVED ✅

You now have:

- ✅ Trip as single source of truth
- ✅ Post as social layer for completed trips
- ✅ Location ready for Google Maps integration
- ✅ AI logging and versioning
- ✅ Monetization hooks (subscriptions, bookings, promotions)
- ✅ Clean, maintainable schema

### What NOT to Do

- ❌ Don't add new features until Phase 1 is complete
- ❌ Don't skip the Post → Trip refactor
- ❌ Don't allow non-completed trips to create posts
- ❌ Don't duplicate locations (use googlePlaceId)

---

## Next Immediate Action

**Start with Phase 1.1: Trip Routes**

Create these files in order:

1. `validation/trip.validation.ts`
2. `controllers/trip.controller.ts`
3. `routes/trip.routes.ts`
4. Update `routes/main.routes.ts`

This is the foundation. Everything else builds on it.

---

## Questions or Issues?

If you encounter:

- **Schema changes needed**: Create new migration with `prisma migrate dev`
- **Breaking changes**: Update this roadmap's "Breaking Changes" section
- **New feature ideas**: Add to Phase 5 or create "Future Phases" section

Remember: **Finish Trip → AI → Feed loop before anything else.**

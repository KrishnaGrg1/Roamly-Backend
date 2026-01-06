# Schema Changes Reference

## Quick Reference: What Changed

### Models Updated

#### ✅ Trip (CORE ENTITY)

```prisma
model Trip {
  // OLD
  startLocation String
  budget        String

  // NEW - More structured
  title       String?
  source      String        // Replaced startLocation
  destination String        // New required field
  budgetMin   Float?        // Replaced string budget
  budgetMax   Float?

  // NEW - AI tracking
  aiModel   String?
  aiVersion String?

  // NEW - Trip lifecycle
  completedAt DateTime?

  // NEW - Relationship
  post Post?  // One trip can have one post
}
```

#### ✅ Post (NOW TRIP-BASED)

```prisma
model Post {
  // REMOVED
  mediaUrl   String        ❌
  mediaType  MediaType     ❌
  locationId String?       ❌

  // NEW
  tripId String @unique   // Each post must reference a completed trip

  // NEW - Relationship
  trip Trip @relation(...)
}
```

**BREAKING CHANGE**: Posts no longer store media directly. They represent completed trips.

#### ✅ Location (GOOGLE MAPS READY)

```prisma
model Location {
  // NEW
  googlePlaceId String? @unique  // For Google Places API integration

  // REMOVED
  posts Post[]  ❌  // No direct post relationship anymore
}
```

#### ✅ Review (TRIP VERIFICATION)

```prisma
model Review {
  // NEW
  tripId String?  // Optional link to verified trip
}
```

#### ✅ AiInteraction (BETTER LOGGING)

```prisma
model AiInteraction {
  // REMOVED
  feedback Int?  ❌

  // NEW
  purpose String  // Track intent: generate_itinerary, explore, trek, refine
}
```

### Models Removed

#### ❌ Route

```prisma
// DELETED - Use Google Maps API instead
model Route {
  sourceLat, sourceLng, destLat, destLng
  distanceKm, durationMin
}
```

#### ❌ TravelHistory

```prisma
// DELETED - Use Trip.status tracking instead
model TravelHistory {
  source, destination, date
}
```

---

## Migration Impact

### Data Handling

- **Existing Posts**: Each old post got a legacy Trip record created
- **Trip titles**: Legacy trips labeled as "Legacy Trip from Post {id}"
- **Status**: All legacy trips set to `COMPLETED`
- **No data lost**: All existing data preserved with backward compatibility

### Breaking Changes for API

#### POST Creation - BEFORE

```typescript
POST /api/post
{
  mediaUrl: "https://...",
  mediaType: "PHOTO",
  locationId: "uuid",
  caption: "Beautiful place!"
}
```

#### POST Creation - AFTER

```typescript
// Step 1: Complete a trip first
POST /api/trip/:id/complete

// Step 2: Create post from completed trip
POST /api/post
{
  tripId: "uuid",
  caption: "Amazing journey!"
}
```

### New Required Validations

```typescript
// When creating a post
const trip = await prisma.trip.findUnique({ where: { id: tripId } });
if (trip.status !== 'COMPLETED') {
  throw new Error('Can only create posts from completed trips');
}

// When creating a location with Google Place
if (googlePlaceId) {
  const existing = await prisma.location.findUnique({
    where: { googlePlaceId },
  });
  if (existing) {
    // Use existing location, don't create duplicate
    return existing;
  }
}

// When logging AI interactions
await prisma.aiInteraction.create({
  data: {
    userId,
    purpose: 'generate_itinerary', // REQUIRED
    prompt,
    response,
    model,
    tokens,
  },
});
```

---

## Database Schema Visualization

```
User
 ├─ trips[]
 │   └─ Trip (CORE)
 │       ├─ status: GENERATED | SAVED | COMPLETED | CANCELLED
 │       ├─ source, destination, days
 │       ├─ itinerary (JSON)
 │       ├─ aiModel, aiVersion
 │       └─ post? (ONE-TO-ONE)
 │           └─ Post (SOCIAL LAYER)
 │               ├─ caption
 │               ├─ comments[]
 │               ├─ likes[]
 │               └─ bookmarks[]
 │
 ├─ reviews[]
 │   └─ Review
 │       ├─ locationId (REQUIRED)
 │       ├─ tripId? (OPTIONAL - for verification)
 │       └─ rating, comment
 │
 ├─ businesses[]
 │   └─ Business
 │       └─ locations[]
 │           └─ Location
 │               ├─ googlePlaceId (UNIQUE)
 │               ├─ reviews[]
 │               ├─ bookmarks[]
 │               └─ promotions[]
 │
 └─ aiLogs[]
     └─ AiInteraction
         ├─ purpose (generate|explore|trek|refine)
         ├─ prompt, response
         └─ model, tokens
```

---

## Environment Variables Needed

```env
# AI Configuration
AI_MODEL=gpt-4
AI_MODEL_VERSION=1.0.0

# Google Maps (for Location)
GOOGLE_MAPS_API_KEY=your_key_here

# Database
DATABASE_URL=postgresql://...
```

---

## Common Queries After Refactor

### Get Feed (Posts with Trip Data)

```typescript
const feed = await prisma.post.findMany({
  include: {
    user: true,
    trip: {
      select: {
        source: true,
        destination: true,
        days: true,
        itinerary: true,
        travelStyle: true,
      },
    },
    likes: true,
    comments: true,
    bookmarks: true,
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

### Get User's Trips with Post Status

```typescript
const trips = await prisma.trip.findMany({
  where: { userId },
  include: {
    post: true, // Will be null if not posted yet
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

### Get Location with Verified Reviews

```typescript
const location = await prisma.location.findUnique({
  where: { id: locationId },
  include: {
    reviews: {
      where: {
        tripId: { not: null }, // Only verified reviews
      },
      include: {
        user: true,
      },
    },
  },
});
```

### Track AI Usage by Purpose

```typescript
const aiStats = await prisma.aiInteraction.groupBy({
  by: ['purpose'],
  _count: true,
  _sum: {
    tokens: true,
  },
  where: {
    createdAt: {
      gte: new Date('2026-01-01'),
    },
  },
});
```

---

## Rollback Plan (If Needed)

If you need to rollback:

```bash
# View migration history
pnpm prisma migrate status

# Rollback to previous migration
pnpm prisma migrate resolve --rolled-back 20260106150445_refactor_trip_as_core_entity

# Reset to specific migration
pnpm prisma migrate reset
```

**Note**: Rollback will lose the refactored structure. Only do this if absolutely necessary.

---

## Next Steps Checklist

- [ ] Update API controllers to handle new Trip-based flow
- [ ] Modify Post controller to enforce Trip.status === COMPLETED
- [ ] Add validation for googlePlaceId uniqueness
- [ ] Implement AI purpose tracking in all AI calls
- [ ] Update frontend to use new Trip → Post workflow
- [ ] Add tests for business rules
- [ ] Update API documentation

---

## Support

For questions about the schema refactor:

1. Check [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)
2. Review migration file: `prisma/migrations/20260106150445_refactor_trip_as_core_entity/migration.sql`
3. Run `pnpm prisma studio` to inspect database visually

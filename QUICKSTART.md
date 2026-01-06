# Quick Start Guide - Trip & Post API

## 🚀 Getting Started

The Trip routes, validation, and controllers have been fully implemented. Here's how to use them.

---

## Environment Setup

Make sure your `.env` has:

```env
# AI Configuration
OPENAI_MODEL=gpt-4-turbo-preview
AI_MODEL_VERSION=1.0.0
OPENAI_API_KEY=your_openai_or_openrouter_key

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Auth
JWT_SECRET=your_secret_key
```

---

## API Flow

### 1. Generate a Trip with AI

**Endpoint:** `POST /api/trip/generate`

**Headers:**

```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Body:**

```json
{
  "source": "Kathmandu",
  "destination": "Pokhara",
  "days": 3,
  "budgetMin": 200,
  "budgetMax": 500,
  "travelStyle": ["CULTURAL", "ADVENTURE"],
  "title": "Weekend Getaway to Pokhara"
}
```

**Response:**

```json
{
  "statusCode": 201,
  "success": true,
  "body": {
    "message": "Trip itinerary generated successfully",
    "data": {
      "id": "uuid",
      "userId": "uuid",
      "source": "Kathmandu",
      "destination": "Pokhara",
      "days": 3,
      "budgetMin": 200,
      "budgetMax": 500,
      "travelStyle": ["CULTURAL", "ADVENTURE"],
      "title": "Weekend Getaway to Pokhara",
      "status": "GENERATED",
      "itinerary": {
        "overview": "...",
        "days": [
          {
            "day": 1,
            "title": "Arrival and Lake Exploration",
            "activities": [...]
          }
        ],
        "transportation": {...},
        "tips": [...]
      },
      "costBreakdown": {
        "accommodation": 200,
        "activities": 150,
        "meals": 100,
        "transportation": 50,
        "total": 500
      },
      "aiModel": "gpt-4-turbo-preview",
      "aiVersion": "1.0.0",
      "createdAt": "2026-01-06T..."
    }
  }
}
```

---

### 2. List Your Trips

**Endpoint:** `GET /api/trip/my?status=GENERATED&limit=10`

**Query Parameters:**

- `status` (optional): GENERATED | SAVED | COMPLETED | CANCELLED
- `limit` (optional): 1-100, default 20
- `cursor` (optional): For pagination

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "body": {
    "message": "Trips fetched successfully",
    "data": {
      "items": [
        {
          "id": "uuid",
          "source": "Kathmandu",
          "destination": "Pokhara",
          "days": 3,
          "status": "GENERATED",
          "post": null,
          ...
        }
      ],
      "pagination": {
        "nextCursor": "uuid",
        "hasNextPage": true,
        "count": 10
      }
    }
  }
}
```

---

### 3. Update Trip (Optional)

**Endpoint:** `PUT /api/trip/:id`

**Body:**

```json
{
  "title": "Updated Title",
  "days": 4,
  "travelStyle": ["LUXURY", "CULTURAL"]
}
```

**Note:** Cannot update completed trips.

---

### 4. Save Trip for Later

**Endpoint:** `POST /api/trip/:id/save`

Changes status from GENERATED → SAVED.

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "body": {
    "message": "Trip saved successfully",
    "data": {
      "id": "uuid",
      "status": "SAVED",
      ...
    }
  }
}
```

---

### 5. Complete the Trip

**Endpoint:** `POST /api/trip/:id/complete`

**Required before creating a post!**

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "body": {
    "message": "Trip marked as completed. You can now create a post from this trip!",
    "data": {
      "id": "uuid",
      "status": "COMPLETED",
      "completedAt": "2026-01-06T...",
      ...
    }
  }
}
```

---

### 6. Create Post from Completed Trip

**Endpoint:** `POST /api/post`

**Body:**

```json
{
  "tripId": "uuid",
  "caption": "What an incredible journey through the mountains! The culture, the people, the views - everything was perfect. 🏔️✨"
}
```

**Validations:**

- ✅ Trip must exist
- ✅ Trip must belong to you
- ✅ Trip status must be COMPLETED
- ✅ Trip cannot already have a post

**Response:**

```json
{
  "statusCode": 201,
  "success": true,
  "body": {
    "message": "Post created successfully from completed trip",
    "data": {
      "id": "uuid",
      "userId": "uuid",
      "tripId": "uuid",
      "caption": "What an incredible journey...",
      "createdAt": "2026-01-06T...",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "avatar": "https://..."
      },
      "trip": {
        "id": "uuid",
        "source": "Kathmandu",
        "destination": "Pokhara",
        "days": 3,
        "travelStyle": ["CULTURAL", "ADVENTURE"],
        "itinerary": {...},
        "costBreakdown": {...},
        "completedAt": "2026-01-06T..."
      }
    }
  }
}
```

---

### 7. View Feed with Trip Data

**Endpoint:** `GET /api/post/feed?limit=10`

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "body": {
    "message": "Success",
    "data": {
      "items": [
        {
          "id": "uuid",
          "caption": "What an incredible journey...",
          "createdAt": "2026-01-06T...",
          "user": {
            "id": "uuid",
            "name": "John Doe",
            "avatar": "https://..."
          },
          "trip": {
            "source": "Kathmandu",
            "destination": "Pokhara",
            "days": 3,
            "travelStyle": ["CULTURAL", "ADVENTURE"],
            "itinerary": {
              "days": [...],
              "tips": [...]
            },
            "costBreakdown": {
              "total": 500
            }
          },
          "_count": {
            "likes": 42,
            "comments": 15,
            "bookmarks": 8
          },
          "isLiked": false,
          "isBookmarked": true
        }
      ],
      "pagination": {
        "nextCursor": "uuid",
        "hasNextPage": true
      }
    }
  }
}
```

---

## Testing with cURL

### Generate Trip

```bash
curl -X POST http://localhost:3000/api/trip/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "Kathmandu",
    "destination": "Pokhara",
    "days": 3,
    "budgetMin": 200,
    "budgetMax": 500,
    "travelStyle": ["CULTURAL", "ADVENTURE"]
  }'
```

### Complete Trip

```bash
curl -X POST http://localhost:3000/api/trip/TRIP_ID/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Post

```bash
curl -X POST http://localhost:3000/api/post \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "TRIP_ID",
    "caption": "Amazing experience!"
  }'
```

### Get Feed

```bash
curl -X GET http://localhost:3000/api/post/feed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Responses

### Trip Not Completed

```json
{
  "statusCode": 400,
  "success": false,
  "body": {
    "message": "Only completed trips can be posted. Complete the trip first using POST /trip/:id/complete",
    "error": "Only completed trips can be posted. Complete the trip first using POST /trip/:id/complete"
  }
}
```

### Trip Already Has Post

```json
{
  "statusCode": 400,
  "success": false,
  "body": {
    "message": "This trip already has a post. Each trip can only have one post.",
    "error": "This trip already has a post. Each trip can only have one post."
  }
}
```

### Unauthorized

```json
{
  "statusCode": 401,
  "success": false,
  "body": {
    "message": "Authentication required",
    "error": "Authentication required"
  }
}
```

---

## Travel Styles Available

- `ADVENTURE` - Hiking, trekking, outdoor activities
- `RELAXED` - Leisure, spa, beach
- `CULTURAL` - Museums, heritage sites, local experiences
- `LUXURY` - High-end hotels, fine dining
- `BACKPACKING` - Budget-friendly, hostels, local transport

**Note:** Can select 1-3 styles per trip.

---

## Status Flow

```
GENERATED → Trip created by AI
    ↓
SAVED → User saved for later
    ↓
COMPLETED → User finished the trip
    ↓
Post Created → Shared to feed
```

**Alternative flows:**

- GENERATED → COMPLETED (skip SAVED)
- GENERATED → CANCELLED (abandon trip)

---

## Common Workflows

### Workflow 1: Plan and Share Immediately

1. Generate trip
2. Complete trip
3. Create post
4. View in feed

### Workflow 2: Save for Later

1. Generate trip
2. Save trip
3. (Later) Complete trip
4. Create post

### Workflow 3: Plan Only

1. Generate trip
2. Update as needed
3. Never complete (keeps as plan)

---

## Next Features (Coming in Phase 2)

- 🔄 AI itinerary refinement
- 🗺️ Trek-specific planning
- 🌍 Explore mode (no specific destination)
- 💰 Subscription limits (free: 3 trips/month)
- 📱 Offline itinerary export

---

## Support

- Schema Documentation: [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md)
- Implementation Roadmap: [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- Phase 1 Summary: [PHASE_1_COMPLETE.md](PHASE_1_COMPLETE.md)

**API is now ready for testing!** 🎉

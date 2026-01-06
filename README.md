# 🌍 Roamly Backend

Our project (Roamly) is a smart travel ecosystem that combines AI, social media, maps, and hospitality into one platform.
It helps travelers discover places, plan trips, find hotels, and explore nearby locations using personalized AI suggestions, a reels-style feed with intelligent ranking, and **database-first AI chat** for grounded travel planning.

Think of it as:

**Booking.com + TikTok Travel + Google Maps + AirBnB + TripAdvisor + ChatGPT** (in one).

**New:** AI Chat system provides intelligent, grounded travel advice using ONLY verified data from the database—never inventing hotels, routes, or prices.

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2.23 or higher
- PostgreSQL database
- OpenRouter API key (for AI features)
- Cloudinary account (for media uploads)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**

```bash
bun install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/roamly"
PORT=3000
JWT_SECRET="your-super-secret-jwt-key-change-this"
BCRYPT_SALT_ROUNDS="12"
TOKEN_EXPIRY="7d"

# Cloudinary (Media Storage)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# OpenRouter (AI)
OPENAI_API_KEY="sk-or-v1-your-openrouter-key"
OPENAI_MODEL="openai/gpt-4-turbo-preview"
```

4. **Initialize database**

```bash
# Generate Prisma client
bunx prisma generate

# Run migrations
bunx prisma migrate dev

# Seed test data (optional but recommended)
bun prisma db seed
```

5. **Start the server**

```bash
bun dev
```

Server will run on `http://localhost:3000`

---

## 🧪 Testing

### View Seed Data

```bash
bunx prisma studio
```

### Test API Endpoints

See [QUICKSTART_TESTING.md](QUICKSTART_TESTING.md) for comprehensive testing guide.

**Quick test:**

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'

# Get intelligent feed
curl -X GET "http://localhost:3000/api/v1/post/feed?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📚 API Documentation

Base URL: `/api/v1`

---

## ✅ Implemented Routes

### 1. **Auth Routes** (`/auth`)

| Method | Endpoint    | Description              | Auth Required |
| ------ | ----------- | ------------------------ | ------------- |
| POST   | `/register` | Register a new user      | ❌            |
| POST   | `/login`    | Login and get JWT token  | ❌            |
| POST   | `/refresh`  | Refresh access token     | ❌            |
| GET    | `/me`       | Get current user profile | ✅            |
| POST   | `/logout`   | Logout and revoke token  | ❌            |

---

### 2. **Trip Routes** (`/trip`) 🔒 ✨ NEW

> **Core feature:** AI-powered trip planning with Trip as the single source of truth

| Method | Endpoint        | Description                           | Auth Required |
| ------ | --------------- | ------------------------------------- | ------------- |
| POST   | `/generate`     | Generate AI trip itinerary            | ✅            |
| GET    | `/my`           | Get user's trips (with status filter) | ✅            |
| GET    | `/:id`          | Get trip details by ID                | ✅            |
| PUT    | `/:id`          | Update trip details                   | ✅            |
| POST   | `/:id/complete` | Mark trip as completed                | ✅            |
| POST   | `/:id/save`     | Save trip (GENERATED → SAVED)         | ✅            |
| POST   | `/:id/cancel`   | Cancel trip                           | ✅            |
| DELETE | `/:id`          | Delete trip (only if no post exists)  | ✅            |

**Generate Trip Request:**

```json
{
  "source": "Kathmandu",
  "destination": "Annapurna Base Camp",
  "days": 10,
  "budgetMin": 500,
  "budgetMax": 700,
  "travelStyle": ["ADVENTURE", "BACKPACKING"]
}
```

**Trip Status Lifecycle:**

```
GENERATED → SAVED → COMPLETED
         ↓
      CANCELLED
```

**Key Rules:**

- ✅ Only `COMPLETED` trips can create posts
- ✅ One post per trip (enforced)
- ✅ AI generates detailed daily itinerary with budget breakdown
- ✅ Trips cannot be deleted if they have posts

---

### 3. **Post Routes** (`/post`) 🔒 ✨ ENHANCED

> **Social layer:** Trip-based posting with intelligent feed ranking

| Method | Endpoint        | Description                           | Auth Required |
| ------ | --------------- | ------------------------------------- | ------------- |
| POST   | `/`             | Create post (requires completed trip) | ✅            |
| GET    | `/feed`         | Get intelligent ranked feed           | ✅            |
| GET    | `/bookmarks`    | Get bookmarked posts                  | ✅            |
| GET    | `/:id`          | Get post by ID                        | ✅            |
| DELETE | `/:id`          | Delete post                           | ✅            |
| POST   | `/:id/like`     | Like a post                           | ✅            |
| DELETE | `/:id/like`     | Unlike a post                         | ✅            |
| POST   | `/:id/bookmark` | Bookmark a post                       | ✅            |
| DELETE | `/:id/bookmark` | Remove bookmark                       | ✅            |

**Create Post Request:**

```json
{
  "tripId": "uuid-of-completed-trip",
  "caption": "Just completed ABC trek! Amazing experience 🏔️"
}
```

**Feed Query Params:**

```
?limit=10&cursor=<post_id>&mode=balanced
```

**Feed Modes:**

- `balanced` (default) - Equal weight to all signals
- `trek` - Prioritizes high-quality adventure content (evergreen)
- `budget` - Matches user's budget preferences
- `nearby` - Prioritizes geographically relevant trips

**Feed Ranking Algorithm:**
See [FEED_RANKING.md](FEED_RANKING.md) for complete documentation.

**5 Weighted Signals:**

1. **Trip Quality (40%)** - Completeness, details, budget realism
2. **Engagement Quality (20%)** - Saves > Comments > Likes (anti-viral)
3. **Relevance (20%)** - Personalized to user preferences
4. **Trust (10%)** - User reputation, verified trips
5. **Freshness (10%)** - Time decay (treks age slower)

**Response includes debug scores:**

```json
{
  "_feedScore": 87.5,
  "_scoreBreakdown": {
    "tripQuality": 92,
    "engagement": 65,
    "relevance": 88,
    "trust": 70,
    "freshness": 100,
    "total": 87.5
  }
}
```

---

### 4. **User Routes** (`/user`) 🔒

> All routes require authentication

| Method | Endpoint  | Description                                  |
| ------ | --------- | -------------------------------------------- |
| GET    | `/:id`    | Get user by ID                               |
| PUT    | `/update` | Update user profile (supports avatar upload) |

---

### 5. **Location Routes** (`/location`) 🔒

> All routes require authentication

| Method | Endpoint  | Description                |
| ------ | --------- | -------------------------- |
| POST   | `/`       | Add a new location (admin) |
| GET    | `/`       | List all locations         |
| GET    | `/nearby` | Get nearby locations       |
| GET    | `/search` | Search locations           |
| GET    | `/:id`    | Get location details by ID |

**Nearby Query Params:**

```
?lat=27.7172&lng=85.3240&radius=5
```

> `radius` is in kilometers (default: 5km, max: 100km)

**Search Query Params:**

```
?q=hotel&category=HOTEL
```

**Location Categories:**
`HOTEL`, `RESTAURANT`, `ATTRACTION`, `TREKKING`, `VIEWPOINT`, `SHOPPING`, `OTHER`

---

### 5. **AI Routes** (`/ai`) 🔒

> AI-powered suggestions using OpenRouter

| Method | Endpoint   | Description                                       | Auth Required |
| ------ | ---------- | ------------------------------------------------- | ------------- |
| POST   | `/suggest` | Suggest places based on user location + interests | ✅            |

**Request Body:**

```json
{
  "latitude": 27.7172,
  "longitude": 85.324,
  "interests": ["temples", "hiking"],
  "radius": 10
}
```

**Key Features:**

- ✅ Uses OpenRouter (OpenAI-compatible API)
- ✅ Logs all AI interactions for analytics
- ✅ Token usage tracking
- ✅ Model: `gpt-4-turbo-preview`

---

### 6. **AI Chat Routes** (`/ai/chat`) 🔒 ✨ NEW

> **Database-first AI chat** for intelligent travel planning with strict grounding

| Method | Endpoint              | Description                 | Auth Required |
| ------ | --------------------- | --------------------------- | ------------- |
| POST   | `/session`            | Create new chat session     | ✅            |
| GET    | `/sessions`           | List user's chat sessions   | ✅            |
| GET    | `/:sessionId`         | Get session with messages   | ✅            |
| POST   | `/:sessionId/message` | Send message to chat        | ✅            |
| POST   | `/:sessionId/end`     | End session (mark inactive) | ✅            |

**Create Session Request:**

```json
{
  "title": "Planning Kathmandu trip" // Optional
}
```

**Send Message Request:**

```json
{
  "message": "What are the best places to visit in Pokhara?"
}
```

**Key Features:**

- ✅ **Database-first**: AI ONLY references verified trips, locations, and posts
- ✅ **Grounded responses**: Never invents hotels, routes, or prices
- ✅ **Context building**: Intelligently loads user trips + similar trips + posts + locations
- ✅ **Intent detection**: Automatic classification (PLAN, MODIFY, COMPARE, RECALL, EXPLORE)
- ✅ **Response validation**: Checks for hallucinations and dangerous claims
- ✅ **Cost controls**: 1 active session per user, 15 messages max, token limits
- ✅ **Reference tracking**: Logs which trips/posts/locations AI used

**Hard Limits:**

- 1 active session per user
- 15 messages per session
- 1000 tokens per response
- Last 6 messages in history

**Context Limits:**

- 3 completed trips (user)
- 3 saved trips (user)
- 5 generated trips (user)
- 5 similar trips (global)
- 5 posts (global)
- 5 locations (global)

**Response includes references:**

```json
{
  "message": {
    "content": "Based on completed trips to Pokhara...",
    "tokens": 250,
    "contextRefs": [
      {
        "refType": "TRIP",
        "refId": "trip-123"
      },
      {
        "refType": "LOCATION",
        "refId": "location-456"
      }
    ]
  }
}
```

**System Behavior:**

- ✅ Admits unknowns: "I don't have data about X in our database"
- ✅ Cites sources: "Based on completed trip to Kathmandu..."
- ✅ Refuses to guess: If context is insufficient, returns error
- ✅ Prevents hallucinations: Validates response before returning

**Full Documentation:** [AI_CHAT.md](AI_CHAT.md)

---

### 7. **Business Routes** (`/business`) 🔒

> Business account management

| Method | Endpoint  | Description                 | Auth Required |
| ------ | --------- | --------------------------- | ------------- |
| GET    | `/me`     | Get business profile        | ✅            |
| PUT    | `/update` | Update business information | ✅            |

---

## 📊 Database Schema

**Current Schema:** Trip-centric architecture (Phase 1 complete)

### Core Models

#### User

```prisma
- id, email, password, name, avatar
- role: USER | BUSINESS | ADMIN
- subscriptionTier: FREE | PREMIUM | ULTIMATE
- preferences: JSON (travel styles, budget range)
- Relations: trips, posts, bookmarks, reviews, comments, likes
```

#### Trip (Core Entity ⭐)

```prisma
- id, userId, status
- source, destination, days
- budgetMin, budgetMax
- travelStyle: TravelStyle[]
- itinerary: JSON (detailed daily breakdown)
- costBreakdown: JSON
- aiModel, aiVersion
- completedAt (required to create post)
- Relations: user, post (one-to-one)
```

**Trip Status:** `GENERATED | SAVED | COMPLETED | CANCELLED`

#### Post

```prisma
- id, userId, tripId (unique, required)
- caption
- Relations: user, trip, comments, likes, bookmarks
```

**Key Rule:** One post per trip, only for completed trips

#### Location

```prisma
- id, googlePlaceId (unique)
- name, category, description
- latitude, longitude, address
- priceRange, avgRating
- verified, ownerBusinessId
- Relations: reviews, embeddings, bookmarks, promotions
```

#### Review

```prisma
- id, userId, locationId
- tripId (optional - for verified trips)
- rating (1-5), comment
- Relations: user, location, trip
```

#### Engagement Models

```prisma
- Like: userId, postId
- Comment: userId, postId, content
- Bookmark: userId, postId
```

#### Business & Marketplace

```prisma
- Business: ownerId, type, tier, verified, status
- BusinessProfile: businessId, profile details
- Booking: userId, businessId, locationId, amount, commission
- Promotion: businessId, locationId, startDate, endDate
```

#### AI & Analytics

```prisma
- AiInteraction: userId, tripId, purpose, model, tokensUsed, cost
- LocationEmbedding: locationId, embedding (vector), metadata
```

**Full Schema:** See [prisma/schema.prisma](prisma/schema.prisma)

---

## 🏗️ Architecture Highlights

### Trip-Centric Design

```
User generates Trip → Trip completed → Post created → Feed ranking applied
```

**Benefits:**

- ✅ Posts always have rich trip data
- ✅ No orphaned posts without context
- ✅ Quality content enforced at creation
- ✅ Immutable trip snapshots

### Feed Ranking Intelligence

**Problem Solved:** Avoid TikTok's mistakes (viral > quality)

**Solution:** Multi-signal ranking

- Quality matters more than likes
- Saves indicate real intent
- Personalization without echo chambers
- Evergreen content (treks) doesn't die

**See:** [FEED_RANKING.md](FEED_RANKING.md) for full algorithm

### AI Cost Control

**Tracking:**

- Every AI call logged in `AiInteraction`
- Token usage and cost tracking
- Purpose tagging (generate-itinerary, refine, suggest)

**Future:** Subscription enforcement (FREE: 3 trips/month)

---

## 🧪 Test Data

Run `bun prisma db seed` to populate:

- 5 users with different travel preferences
- 9 Nepal locations
- 6 trips (varying quality levels)
- 5 posts with strategic engagement
- Engagement data (bookmarks, comments, likes)

**Test Credentials:**

```
Email: alice@example.com
Password: password123
```

**Other test users:** bob, charlie, diana, eve (all same password)

**See:** [SEED_DATA.md](SEED_DATA.md) for complete test scenarios

---

## 📖 Documentation Files

| File                                                   | Description                                         |
| ------------------------------------------------------ | --------------------------------------------------- |
| [AI_CHAT.md](AI_CHAT.md)                               | **NEW** Database-first AI chat system documentation |
| [AI_CHAT_TESTING.md](AI_CHAT_TESTING.md)               | **NEW** AI Chat testing guide with curl commands    |
| [AI_CHAT_IMPLEMENTATION.md](AI_CHAT_IMPLEMENTATION.md) | **NEW** AI Chat implementation summary              |
| [FEED_RANKING.md](FEED_RANKING.md)                     | Complete feed ranking algorithm documentation       |
| [SEED_DATA.md](SEED_DATA.md)                           | Seed data breakdown and test scenarios              |
| [QUICKSTART_TESTING.md](QUICKSTART_TESTING.md)         | Quick testing guide with curl commands              |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Full project roadmap (Phase 1-3)                    |
| [PHASE_1_COMPLETE.md](PHASE_1_COMPLETE.md)             | Phase 1 completion summary                          |
| [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md)                 | Database migration notes                            |

---

## 🚧 Planned Features (Phase 2 & 3)

### Phase 2: AI Enhancement & Marketplace

- [x] **AI Chat system** (database-first, grounded responses) ✨ **COMPLETE**
- [ ] AI response caching for common routes
- [ ] Subscription enforcement (FREE: 3 trips/month, PREMIUM: unlimited)
- [ ] Enhanced review system with trip verification
- [ ] Booking system with commission tracking
- [ ] Business promotion system
- [ ] Advanced analytics dashboard

### Phase 3: Discovery & Social

- [ ] Location-centric discovery features
- [ ] Google Place claiming by businesses
- [ ] Collaborative filtering recommendations
- [ ] Machine learning ranking signals
- [ ] Seasonal content boosting
- [ ] A/B testing framework for feed algorithms

**Full Roadmap:** [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)

---

## 🔐 Authentication & Authorization

### JWT Strategy

- **Access Token:** Short-lived (7 days default)
- **Refresh Token:** Stored in database, revocable
- **Logout:** Blacklists refresh tokens

### User Roles

| Role     | Capabilities                          |
| -------- | ------------------------------------- |
| USER     | Discover, AI trips, reviews, posts    |
| BUSINESS | Promotions, bookings, analytics       |
| ADMIN    | Verification, moderation, full access |

### Protected Routes

All routes under `/user`, `/post`, `/trip`, `/location`, `/ai`, `/business` require authentication.

---

## 🔌 WebSocket Events

### Chat Socket (`/sockets/chat.socket.ts`)

**Incoming Events:**
| Event | Payload |
| ------------- | ------------------------------------ |
| `sendMessage` | `{ receiverId: string, message: string }` |

**Outgoing Events:**
| Event | Description |
| ------------- | ---------------------- |
| `message` | New message received |
| `messageSent` | Message sent confirmation |
| `error` | Error response |

---

## 🛠️ Tech Stack

**Runtime & Framework:**

- [Bun](https://bun.sh) - Fast JavaScript runtime
- Express.js - Web framework
- TypeScript - Type safety

**Database:**

- PostgreSQL - Primary database
- Prisma ORM - Database toolkit
- @prisma/adapter-pg - Native Bun adapter

**Authentication:**

- JWT (jsonwebtoken) - Token-based auth
- bcrypt - Password hashing
- Refresh token rotation

**AI & Intelligence:**

- OpenRouter - AI API gateway
- OpenAI SDK - Compatible with OpenRouter
- Vector embeddings (planned)

**Storage & Media:**

- Cloudinary - Image/video hosting
- express-fileupload - File handling

**Real-time:**

- Socket.io - WebSocket server

**Validation & Security:**

- Zod - Schema validation
- helmet - Security headers
- CORS - Cross-origin resource sharing

---

## 🚀 Deployment

### Environment Setup

Ensure all environment variables are set:

```bash
DATABASE_URL=postgresql://...
PORT=3000
JWT_SECRET=your-secret
BCRYPT_SALT_ROUNDS=12
TOKEN_EXPIRY=7d
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OPENAI_API_KEY=sk-or-v1-...
OPENAI_MODEL=openai/gpt-4-turbo-preview
```

### Database Migration

```bash
bunx prisma migrate deploy
bunx prisma generate
```

### Production Start

```bash
bun run index.ts
```

### Health Check

```bash
curl http://localhost:3000/api/v1/auth/me
# Should return 401 without token (working!)
```

---

## 📈 Performance & Optimization

### Current Implementation

- In-memory feed ranking (3x fetch → rank → return top N)
- JWT verification on every request
- Cloudinary for media optimization

### Planned Optimizations

- [ ] Redis caching for hot content
- [ ] Precomputed trip quality scores
- [ ] Database indexes for feed queries
- [ ] Rate limiting per user tier
- [ ] CDN for static assets

---

## 🐛 Debugging

### Enable Detailed Logging

Check terminal output for:

```
[2026-01-06T...] POST /api/v1/trip/generate
[AI] chat.completions.create → model=gpt-4-turbo-preview promptChars=1234
```

### Common Issues

**1. Database Connection Error**

```bash
# Check DATABASE_URL format
postgresql://user:password@host:5432/database
```

**2. AI Generation Fails**

```bash
# Verify OPENAI_API_KEY is valid OpenRouter key
# Check https://openrouter.ai/keys
```

**3. Feed Returns Empty**

```bash
# Ensure trips are COMPLETED and have posts
# Run: bun prisma db seed
```

**4. Image Upload Fails**

```bash
# Check Cloudinary credentials
# Test: https://cloudinary.com/console
```

### View Data

```bash
bunx prisma studio
# Opens http://localhost:5555
```

---

## 🤝 Contributing

### Code Style

```bash
bun run format
```

### Database Changes

```bash
# 1. Modify prisma/schema.prisma
# 2. Create migration
bunx prisma migrate dev --name describe_change
# 3. Update seed if needed
```

### Testing New Features

1. Add test data in `prisma/seed.ts`
2. Run `bun prisma db seed`
3. Test with curl or Postman
4. Update README.md documentation

---

## 📜 License

This project is private and proprietary.

---

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- Powered by [OpenRouter](https://openrouter.ai) - AI API aggregation
- Database by [Prisma](https://prisma.io) - Next-generation ORM
- Media by [Cloudinary](https://cloudinary.com) - Media optimization

---

## 📞 Support

For issues or questions:

1. Check [QUICKSTART_TESTING.md](QUICKSTART_TESTING.md)
2. Review error logs in terminal
3. Use `bunx prisma studio` to inspect database
4. Verify `.env` configuration

---

**Built with ❤️ for travelers who value quality over virality**

---

## 🎯 Quick Commands Reference

```bash
# Development
bun install              # Install dependencies
bun dev                  # Start dev server
bun run format           # Format code

# Database
bunx prisma generate     # Generate Prisma client
bunx prisma migrate dev  # Run migrations
bunx prisma db seed      # Populate test data
bunx prisma studio       # Open database GUI
bunx prisma migrate reset # Reset database (⚠️ destructive)

# Testing
npx tsc --noEmit        # Type check
curl -X POST ...        # Test API (see QUICKSTART_TESTING.md)

# Production
bunx prisma migrate deploy  # Deploy migrations
bun run index.ts            # Start production server
```

---

**Version:** 1.0.0 (Phase 1 Complete)  
**Last Updated:** January 6, 2026

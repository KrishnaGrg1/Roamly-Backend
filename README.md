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
| GET    | `/save`         | Get saved trip(status=SAVED)          | ✅            |
| POST   | `/:id/cancel`   | Cancel trip                           | ✅            |
| DELETE | `/:id`          | Delete trip (only if no post exists)  | ✅            |

**Generate Trip Request:**

```json
// ========================================
// HEALTH-AWARE TRIP PLANNING EXAMPLES
// ========================================

// EXAMPLE 1: Asthma - Lower Altitude Trek
{
  "source": "Pokhara",
  "destination": "Poon Hill",
  "startDate": "2026-03-15",
  "endDate": "2026-03-19",
  "budgetMax": 15000,
  "budgetMin": 10000,
  "travelStyle": ["RELAXED", "CULTURAL"],
  "travelType": "nepali",
  "healthIssue": "Asthma - moderate severity, need to avoid high altitude above 3500m"
}

// Expected AI Response:
// - Maximum altitude: 3210m (Poon Hill)
// - Gradual ascent with extra rest days
// - Activities marked with difficulty levels
// - Tips: "Carry inhaler, avoid dusty trails"
// - Medical facilities: "Nearest clinic in Ghandruk"


// ========================================
// EXAMPLE 2: Heart Condition - Gentle Safari
{
  "source": "Kathmandu",
  "destination": "Chitwan",
  "startDate": "2026-07-10",
  "endDate": "2026-07-13",
  "budgetMax": 20000,
  "budgetMin": 15000,
  "travelStyle": ["RELAXED"],
  "travelType": "foreigner",
  "healthIssue": "Controlled heart condition, avoid strenuous activities and high altitude"
}

// Expected AI Response:
// - Low-intensity activities only
// - Canoe rides, elephant breeding center visits
// - No long jungle walks or treks
// - Jeep safari instead of walking safari
// - Tips: "Stay near medical facilities, carry medications"
// - Hotel with medical support nearby


// ========================================
// EXAMPLE 3: Knee Problems - Accessible Tour
{
  "source": "Kathmandu",
  "destination": "Pokhara",
  "startDate": "2026-10-05",
  "endDate": "2026-10-10",
  "budgetMax": 30000,
  "budgetMin": 20000,
  "travelStyle": ["CULTURAL", "RELAXED"],
  "travelType": "saarc",
  "healthIssue": "Chronic knee pain, difficulty with stairs and long walks"
}

// Expected AI Response:
// - Accessible attractions (boat rides, museums)
// - Hotels with elevators
// - Short, flat walking tours
// - Private vehicle for sightseeing
// - Avoid: Swayambhunath steps, World Peace Pagoda climb
// - Include: Phewa Lake boat ride, International Mountain Museum


// ========================================
// EXAMPLE 4: Diabetes - Controlled Trek
{
  "source": "Kathmandu",
  "destination": "Langtang Valley",
  "startDate": "2026-04-10",
  "endDate": "2026-04-19",
  "budgetMax": 40000,
  "budgetMin": 30000,
  "travelStyle": ["ADVENTURE"],
  "travelType": "nepali",
  "healthIssue": "Type 1 Diabetes, need regular meals and insulin storage"
}

// Expected AI Response:
// - Regular meal times scheduled
// - Shorter daily walking distances
// - Hotels with refrigeration for insulin
// - Gradual altitude gain
// - Tips: "Pack extra glucose tablets, inform guide"
// - Medical: "Nearest health post at Kyanjin Gompa"


// ========================================
// EXAMPLE 5: Senior Traveler - Easy Pace
{
  "source": "Kathmandu",
  "destination": "Annapurna Base Camp",
  "startDate": "2026-10-15",
  "endDate": "2026-10-25",
  "budgetMax": 50000,
  "budgetMin": 35000,
  "travelStyle": ["ADVENTURE", "RELAXED"],
  "travelType": "foreigner",
  "healthIssue": "65 years old, good health but need slower pace and more rest days"
}

// Expected AI Response:
// - Extended itinerary (10 days vs typical 7)
// - Extra acclimatization days
// - Shorter daily trekking distances (3-4 hours max)
// - Better accommodation options
// - Porter service recommended
// - Tips: "Take it slow, listen to your body"


// ========================================
// EXAMPLE 6: Pregnancy - Safe Sightseeing
{
  "source": "Kathmandu",
  "destination": "Kathmandu Valley",
  "startDate": "2026-11-01",
  "endDate": "2026-11-05",
  "budgetMax": 25000,
  "budgetMin": 15000,
  "travelStyle": ["CULTURAL", "RELAXED"],
  "travelType": "nepali",
  "healthIssue": "Second trimester pregnancy (5 months), avoid high altitude and strenuous activities"
}

// Expected AI Response:
// - Valley sightseeing only (no mountain trips)
// - Comfortable transport (private car)
// - Frequent rest breaks
// - Clean, hygienic restaurants
// - Avoid: Long walks, crowded places
// - Include: Bhaktapur, Patan Durbar Square
// - Medical: "Nearby hospitals listed"


// ========================================
// EXAMPLE 7: Altitude Sickness History
{
  "source": "Kathmandu",
  "destination": "Everest Base Camp",
  "startDate": "2026-04-15",
  "endDate": "2026-05-01",
  "budgetMax": 150000,
  "budgetMin": 100000,
  "travelStyle": ["ADVENTURE"],
  "travelType": "foreigner",
  "healthIssue": "Previous altitude sickness at 3800m, need extra acclimatization days"
}

// Expected AI Response:
// - EXTENDED itinerary (16 days instead of 12)
// - Multiple acclimatization days
// - Gradual ascent profile
// - Alternative route via Gokyo (lower altitude option)
// - Tips: "Diamox prophylaxis recommended, consult doctor"
// - Emergency evacuation plan included
// - Medical: "Helicopter evacuation insurance required"


// ========================================
// EXAMPLE 8: Allergies - Dietary Restrictions
{
  "source": "Pokhara",
  "destination": "Ghorepani",
  "startDate": "2026-09-10",
  "endDate": "2026-09-15",
  "budgetMax": 18000,
  "budgetMin": 12000,
  "travelStyle": ["ADVENTURE"],
  "travelType": "saarc",
  "healthIssue": "Severe nut allergy and gluten intolerance"
}

// Expected AI Response:
// - Meal suggestions without nuts
// - Gluten-free options highlighted
// - Communication tips for tea houses
// - Pre-order meals when possible
// - Tips: "Carry allergy card in Nepali"
// - Emergency: "Carry EpiPen, inform guide"


// ========================================
// EXPECTED RESPONSE STRUCTURE
// ========================================

{
  "itinerary": {
    "overview": "Customized itinerary considering asthma condition...",
    "season": "Spring",
    "healthConsiderations": "This itinerary is designed for someone with moderate asthma. Maximum altitude kept below 3500m to minimize breathing difficulties. All activities are low to moderate intensity.",
    "healthIssue": "Asthma - moderate severity, need to avoid high altitude above 3500m",
    "days": [
      {
        "day": 1,
        "date": "2026-03-15",
        "title": "Pokhara to Tikhedhunga",
        "activities": [
          {
            "time": "09:00 AM",
            "activity": "Drive to Nayapul",
            "difficultyLevel": "Easy",
            "description": "Comfortable jeep ride...",
            "estimatedCost": 800
          },
          {
            "time": "11:00 AM",
            "activity": "Gentle walk to Tikhedhunga",
            "difficultyLevel": "Easy",
            "duration": "3 hours",
            "description": "Flat terrain, take breaks as needed",
            "estimatedCost": 0
          }
        ]
      }
    ],
    "safetyPrecautions": [
      "Carry asthma inhaler at all times",
      "Inform guide about your condition",
      "Take breaks if breathing becomes difficult",
      "Nearest health post: Ghandruk (20 min from trail)",
      "Helicopter evacuation available from Ghorepani",
      "Avoid dusty trails during windy days"
    ],
    "tips": [
      "Pack your medication in accessible pocket",
      "Spring: Clear air is better for asthma",
      "Drink plenty of water to stay hydrated",
      "Walk at your own pace, don't rush",
      "Consider hiring a porter to reduce load"
    ]
  },
  "costBreakdown": {
    "total": 14500,
    "entryFees": 100,
    // ... other costs
  }
}


// ========================================
// HEALTH CONDITION CATEGORIES
// ========================================

/*
COMMON HEALTH ISSUES SUPPORTED:

1. RESPIRATORY:
   - Asthma
   - COPD
   - Sleep apnea
   → Lower altitude, shorter treks

2. CARDIOVASCULAR:
   - Heart conditions
   - High blood pressure
   - Previous heart surgery
   → Low-intensity activities, avoid altitude

3. MOBILITY:
   - Knee/joint problems
   - Back pain
   - Hip issues
   → Accessible routes, shorter walks

4. METABOLIC:
   - Diabetes
   - Thyroid issues
   → Regular meals, temperature control

5. AGE-RELATED:
   - Senior travelers (65+)
   - Children under 10
   → Slower pace, frequent breaks

6. PREGNANCY:
   - Any trimester
   → Low altitude, comfortable transport

7. ALTITUDE SENSITIVITY:
   - Previous AMS
   - Altitude sickness history
   → Extra acclimatization days

8. ALLERGIES:
   - Food allergies
   - Environmental allergies
   → Dietary planning, medication
*/


// ========================================
// SAFETY RECOMMENDATIONS BY CONDITION
// ========================================

/*
ALTITUDE LIMITS:

- Heart/Lung conditions: Max 3000m
- Pregnancy: Max 2500m
- Diabetes: Max 4000m (with precautions)
- Senior travelers: Max 3500m
- Previous AMS: Extra acclimatization above 3000m

ACTIVITY INTENSITY:

- Severe conditions: Easy only (< 3 hours/day)
- Moderate conditions: Easy-Moderate (3-5 hours/day)
- Mild conditions: All levels (with caution)

MEDICAL SUPPORT:

- Always inform guide
- Carry sufficient medication
- Travel insurance mandatory
- Know nearest medical facilities
- Evacuation plan in place
*/
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

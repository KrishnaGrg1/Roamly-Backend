# 🌍 Roamly Backend

Our project (Roamly) is a smart travel ecosystem that combines AI, social media, maps, and hospitality into one platform.
It helps travelers discover places, plan trips, find hotels, and explore nearby locations using personalized AI suggestions and a reels-style feed.

Think of it as:

**Booking.com + TikTok Travel + Google Maps + AirBnB + TripAdvisor** (in one).

---

## Getting Started

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

---

## API Routes

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

### 2. **User Routes** (`/user`) 🔒

> All routes require authentication

| Method | Endpoint  | Description                                  |
| ------ | --------- | -------------------------------------------- |
| GET    | `/:id`    | Get user by ID                               |
| PUT    | `/update` | Update user profile (supports avatar upload) |

---

### 3. **Post Routes** (`/post`) 🔒

> All routes require authentication

| Method | Endpoint        | Description                    |
| ------ | --------------- | ------------------------------ |
| POST   | `/`             | Create a new post (with media) |
| GET    | `/feed`         | Get paginated feed             |
| GET    | `/bookmarks`    | Get bookmarked posts           |
| GET    | `/:id`          | Get post by ID                 |
| DELETE | `/:id`          | Delete post by ID              |
| POST   | `/:id/like`     | Like a post                    |
| DELETE | `/:id/like`     | Unlike a post                  |
| POST   | `/:id/bookmark` | Bookmark a post                |
| DELETE | `/:id/bookmark` | Remove bookmark from a post    |

**Feed Query Params:**

```
?cursor=<post_id>&limit=10
```

**Bookmarks Query Params:**

```
?cursor=<bookmark_id>&limit=10
```

---

### 4. **Location Routes** (`/location`) 🔒

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

> All routes require authentication

| Method | Endpoint   | Description                                       |
| ------ | ---------- | ------------------------------------------------- |
| POST   | `/suggest` | Suggest places based on user location + interests |

**Request Body:**

```json
{
  "latitude": 27.7172,
  "longitude": 85.324,
  "interests": ["temples", "hiking"],
  "radius": 10
}
```

---

## 🚧 To Be Implemented

### 6. **Business & Marketplace Routes** (`/business`) 🔒

> Phase 2 Core Feature

| Method | Endpoint    | Description             | Role            |
| ------ | ----------- | ----------------------- | --------------- |
| POST   | `/register` | Register business       | USER → BUSINESS |
| GET    | `/me`       | My business profile     | BUSINESS        |
| PUT    | `/update`   | Update business         | BUSINESS        |
| GET    | `/:id`      | Public business profile | ALL             |

**Maintains:**

- Verification status
- Tier (FREE / BOOSTED / PREMIUM)
- Linked locations

**Rules:**

- User role must be BUSINESS
- Tier controls promotion reach

---

### 7. **Promotion Routes** (`/promotion`) 🔒

> Paid Visibility Feature

| Method | Endpoint        | Description       |
| ------ | --------------- | ----------------- |
| POST   | `/`             | Create promotion  |
| GET    | `/location/:id` | Active promotions |
| DELETE | `/:id`          | Remove promotion  |

**Maintains:**

- startDate / endDate validity
- Business ownership

**Rules:**

- Only ownerBusiness can promote
- BOOSTED / PREMIUM tier only

---

### 8. **Review Routes** (`/review`) 🔒

> Trust & Rating System

| Method | Endpoint        | Description       |
| ------ | --------------- | ----------------- |
| POST   | `/`             | Add review        |
| GET    | `/location/:id` | Get reviews       |
| DELETE | `/:id`          | Delete own review |

**Maintains:**

- Rating integrity
- Trust signal for locations

**Rules:**

- One review per user per location
- Rating: 1–5 only

---

### 9. **Extended AI Routes** (`/ai`) 🔒

> Core AI Value Features

| Method | Endpoint               | Description                     |
| ------ | ---------------------- | ------------------------------- |
| POST   | `/suggest`             | Suggest nearby places ✅        |
| POST   | `/trip`                | Generate full trip              |
| POST   | `/refine`              | Refine existing trip            |
| POST   | `/feedback`            | AI result feedback              |
| POST   | `/generate-embedding`  | Generate vector for a location  |
| GET    | `/recommend-locations` | Personalized recommended places |

**Maintains:**

- AiInteraction logs
- Token usage
- Feedback score

**Rules:**

- Premium users get more API calls
- AI output must be stored
- Never trust raw AI JSON blindly

---

### 10. **Trip Routes** (`/trip`) 🔒

> Core Itinerary Feature

| Method | Endpoint    | Description         |
| ------ | ----------- | ------------------- |
| POST   | `/generate` | Generate AI trip    |
| POST   | `/save`     | Save generated trip |
| GET    | `/my`       | User trips          |
| GET    | `/:id`      | Trip details        |
| DELETE | `/:id`      | Delete trip         |

**Maintains:**

- Immutable itinerary snapshot
- Trip status lifecycle (GENERATED → SAVED → COMPLETED)

**Rules:**

- Generated ≠ Saved
- Offline trips require saved state

---

### 11. **Route/Navigation Routes** (`/route`) 🔒

> Navigation History

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST   | `/`      | Save route  |
| GET    | `/my`    | User routes |

**Maintains:**

- Navigation history
- Distance & duration cache

---

### 12. **Booking Routes** (`/booking`) 🔒

> Revenue & Reservations

| Method | Endpoint      | Description       |
| ------ | ------------- | ----------------- |
| POST   | `/`           | Create booking    |
| GET    | `/my`         | User bookings     |
| GET    | `/business`   | Business bookings |
| POST   | `/:id/cancel` | Cancel booking    |

**Maintains:**

- Commission calculation
- Booking status
- Attribution (AI / search / feed)

**Rules:**

- Commission calculated at booking time
- Immutable financial data

---

### 13. **Subscription Routes** (`/subscription`) 🔒

> Premium Features

| Method | Endpoint     | Description         |
| ------ | ------------ | ------------------- |
| GET    | `/plans`     | Available plans     |
| POST   | `/subscribe` | Upgrade to premium  |
| POST   | `/cancel`    | Cancel subscription |

**Maintains:**

- subscriptionEnds date
- Feature gating

---

### 14. **Admin Routes** (`/admin`) 🔒

> Admin Only (ADMIN role required)

| Method | Endpoint               | Description     |
| ------ | ---------------------- | --------------- |
| GET    | `/users`               | List users      |
| GET    | `/businesses`          | List businesses |
| GET    | `/ai/usage`            | AI metrics      |
| PUT    | `/location/:id/verify` | Verify location |
| PUT    | `/business/:id/verify` | Verify business |

---

## 🔐 Permission Summary

| Role     | Capabilities                          |
| -------- | ------------------------------------- |
| USER     | Discover, AI trips, reviews, posts    |
| BUSINESS | Promotions, bookings, analytics       |
| ADMIN    | Verification, moderation, full access |

---

## 📊 Database Schema

Key models in `prisma/schema.prisma`:

- **User** - Authentication, profiles, subscriptions
- **Post** - Social media content
- **Location** - Places with coordinates
- **Business** - Business accounts
- **Booking** - Reservations with commission
- **Trip** - AI-generated itineraries
- **Review** - Location ratings
- **Promotion** - Paid visibility
- **AiInteraction** - AI usage logs

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

- **Runtime:** Bun
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT (Access + Refresh tokens)
- **File Storage:** Cloudinary
- **AI:** OpenRouter (OpenAI compatible)
- **Real-time:** Socket.io

---

This project was created using `bun init` in bun v1.2.23. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

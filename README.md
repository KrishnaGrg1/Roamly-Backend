# 🌍 Project Description (Clear, Professional & Complete)

Our project(Roamly) is a smart travel ecosystem that combines AI, social media, maps, and hospitality into one platform.
It helps travelers discover places, plan trips, find hotels, and explore nearby locations using personalized AI suggestions and a reels-style feed.

Think of it as:

Booking.com + TikTok Travel + Google Maps + AirBnB + TripAdvisor (in one).

---

# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

## API Routes

Base URL: `/api/v1`

---

### 1. **Auth Routes** (`/auth`)

| Method | Endpoint    | Description              | Auth Required |
| ------ | ----------- | ------------------------ | ------------- |
| POST   | `/register` | Register a new user      | ❌            |
| POST   | `/login`    | Login and get JWT token  | ❌            |
| GET    | `/me`       | Get current user profile | ✅            |

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

## Need to do

1. **AI Routes:**

| Method | Routes                    | Description                                       |
| ------ | ------------------------- | ------------------------------------------------- |
| POST   | `/ai/suggest`             | Suggest places based on user location + interests |
| POST   | `/ai/generate-embedding`  | Generate vector for a location                    |
| GET    | `/ai/recommend-locations` | Personalized recommended places                   |

---

This project was created using `bun init` in bun v1.2.23. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

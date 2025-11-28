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

## Need to do

1. **Location Routes:**

| Method | Routes                               |
| ------ | ------------------------------------ |
| POST   | /locations // add location(admin)    |
| GET    | /locations // list all the locations |
| GET    | /locations/:id //location details    |
| GET    | /locations/nearby //places nearby    |

Params for /nearby:

```bash
?lat=...
&lng=...
&radius=5000 (meters)
```

2. **AI Routes:**

| Method | Routes                                                            |
| ------ | ----------------------------------------------------------------- |
| POST   | /ai/suggest //suggest places based on user's location + interests |
| POST   | //ai/generate-embedding // generate vector for a location         |
| GET    | /ai/recommend-locations // personalized recommended places        |

---

This project was created using `bun init` in bun v1.2.23. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

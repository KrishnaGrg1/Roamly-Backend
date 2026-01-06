# Quick Start: Testing Feed Ranking Algorithm

## 1️⃣ Start the Server

```bash
cd /Users/developer/Projects/Roamly/backend
bun run dev
```

## 2️⃣ Login to Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123"
  }'
```

Copy the `accessToken` from the response.

## 3️⃣ Test Feed (Replace YOUR_TOKEN)

### Balanced Mode

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Trek Mode

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10&mode=trek" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Budget Mode

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10&mode=budget" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Nearby Mode

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10&mode=nearby" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

## 4️⃣ Expected Results

**Balanced mode ranking:**

1. Post 4 (EBC) - 14 days, $1000-1500, high engagement
2. Post 1 (ABC) - 10 days, $500-700, high engagement
3. Post 5 (Lumbini) - 4 days, $300-500, medium engagement
4. Post 2 (Pokhara) - 3 days, $150-250, viral likes (but low quality!)
5. Post 3 (Bhaktapur) - 1 day, no budget, minimal engagement

**Key test:** Pokhara has the MOST likes (5) but should rank #4 due to low quality!

## 5️⃣ Check Score Breakdown

Each post includes:

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

## 🎯 Success = Quality beats virality!

---

## Other Test Users

Login as different users to see personalized results:

**Bob (Budget $100-300):**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}'
```

In budget mode, Bob should see Pokhara ($150-250) ranked MUCH higher!

**Test all users:**

- alice@example.com (Adventure $300-600)
- bob@example.com (Backpacking $100-300)
- charlie@example.com (Cultural $400-800)
- diana@example.com (Relaxed $500-1000)
- eve@example.com (Cultural $200-500)

All passwords: `password123`

---

## 📊 View Data in Prisma Studio

```bash
bunx prisma studio
# Opens http://localhost:5555
```

---

## 🔄 Re-seed Database

```bash
bun prisma db seed
```

---

## 📚 Full Documentation

- [SEED_DATA.md](SEED_DATA.md) - What was seeded and why
- [test-feed-ranking.md](test-feed-ranking.md) - Detailed test scenarios
- [FEED_RANKING.md](FEED_RANKING.md) - Algorithm documentation
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) - Full project roadmap

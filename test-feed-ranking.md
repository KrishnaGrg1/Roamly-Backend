# Feed Ranking Test Guide

## ✅ Seed Data Created Successfully!

The database now has comprehensive test data:

### Users (5)

- **alice@example.com** - Adventure/Cultural traveler ($300-$600)
- **bob@example.com** - Backpacking/Cultural traveler ($100-$300)
- **charlie@example.com** - Cultural/Adventure traveler ($400-$800)
- **diana@example.com** - Relaxed/Cultural traveler ($500-$1000)
- **eve@example.com** - Cultural/Relaxed traveler ($200-$500)

### Locations (9)

- Pashupatinath Temple
- Boudhanath Stupa
- Swayambhunath (Monkey Temple)
- Pokhara Lakeside
- Phewa Lake
- Sarangkot Viewpoint
- Thamel
- Annapurna Base Camp (ABC)
- Everest Base Camp

### Trips (6 total, 5 completed)

| Trip | User    | Destination | Days | Budget     | Quality            | Status    | Age     |
| ---- | ------- | ----------- | ---- | ---------- | ------------------ | --------- | ------- |
| 1    | Alice   | ABC         | 10   | $500-700   | ⭐⭐⭐⭐⭐ High    | COMPLETED | 15 days |
| 2    | Bob     | Pokhara     | 3    | $150-250   | ⭐⭐ Low           | COMPLETED | 5 days  |
| 3    | Charlie | Bhaktapur   | 1    | null       | ⭐ Very Low        | COMPLETED | 2 days  |
| 4    | Alice   | EBC         | 14   | $1000-1500 | ⭐⭐⭐⭐⭐ Highest | COMPLETED | 60 days |
| 5    | Diana   | Lumbini     | 4    | $300-500   | ⭐⭐⭐ Medium      | COMPLETED | 30 days |
| 6    | Eve     | Chitwan     | 3    | $250-400   | N/A                | GENERATED | -       |

### Posts (5) with Engagement

**Expected Ranking (Balanced Mode):**

1. **Post 4 (EBC)** - Alice
   - Trip Quality: 95+ (14 days, full itinerary, all fields)
   - Engagement: High (4 bookmarks, 4 comments, 4 likes)
   - Trust: High (Alice has 2 completed trips, has reviews)
   - Freshness: Lower (60 days old, but trek bonus applies)
   - **Expected Score: ~85-90**

2. **Post 1 (ABC)** - Alice
   - Trip Quality: 90+ (10 days, full details)
   - Engagement: High (4 bookmarks, 3 comments, 4 likes)
   - Trust: High (experienced user)
   - Freshness: High (15 days old)
   - **Expected Score: ~82-88**

3. **Post 5 (Lumbini)** - Diana
   - Trip Quality: 70 (4 days, good details)
   - Engagement: Medium (2 bookmarks, 1 comment, 3 likes)
   - Trust: Medium (1 trip)
   - Freshness: Medium (30 days old)
   - **Expected Score: ~65-70**

4. **Post 2 (Pokhara)** - Bob
   - Trip Quality: 40 (3 days, basic itinerary)
   - Engagement: Viral but low quality (1 bookmark, 2 comments, 5 likes)
   - Trust: Low (new user)
   - Freshness: High (5 days old)
   - **Expected Score: ~45-55** (proves likes don't dominate!)

5. **Post 3 (Bhaktapur)** - Charlie
   - Trip Quality: 20 (1 day, minimal details)
   - Engagement: Very low (1 like only)
   - Trust: Low (new user)
   - Freshness: Very high (2 days old)
   - **Expected Score: ~30-40**

---

## 🧪 Testing the Feed Ranking

### 1. Login as a user

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123"
  }'
```

Save the `accessToken` from response.

### 2. Test Balanced Feed (Default)

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Expected order:** EBC → ABC → Lumbini → Pokhara → Bhaktapur

Check `_feedScore` and `_scoreBreakdown` in response.

### 3. Test Trek Mode (Quality + Trust focused)

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10&mode=trek" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Expected:** EBC and ABC should dominate even more (quality weight is 45%)

### 4. Test Budget Mode (Relevance focused)

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10&mode=budget" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**For Alice ($300-600 budget):**

- ABC ($500-700) should rank highest (closest match)
- Lumbini ($300-500) also good match
- EBC ($1000-1500) should rank lower

### 5. Test as Different User (Different Preferences)

Login as Bob (Backpacking, $100-300):

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "password123"
  }'
```

Get Bob's feed:

```bash
curl -X GET "http://localhost:3000/api/post/feed?limit=10&mode=budget" \
  -H "Authorization: Bearer <BOB_TOKEN>"
```

**Expected for Bob:** Pokhara ($150-250) should rank MUCH higher due to budget match!

---

## 🔍 Validation Checklist

- [ ] EBC and ABC (high quality) rank at top
- [ ] Pokhara (viral likes) does NOT dominate despite 5 likes
- [ ] Bhaktapur (minimal details) ranks last
- [ ] Trek mode boosts trekking content more
- [ ] Budget mode personalizes based on user budget
- [ ] Score breakdown shows all 5 signals
- [ ] Old EBC post (60 days) still ranks high (evergreen)
- [ ] Fresh but low-quality posts don't dominate

---

## 📊 Understanding Score Breakdown

Each post response includes:

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

**How to read:**

- `tripQuality`: 0-100 (completeness of itinerary)
- `engagement`: 0-100 (weighted: saves > comments > likes)
- `relevance`: 0-100 (match with user preferences)
- `trust`: 0-100 (user reputation + verified trips)
- `freshness`: 0-100 (time decay with trek bonus)
- `total`: Weighted average based on mode

---

## 🎯 Success Criteria

The feed ranking algorithm is working correctly if:

1. **Quality matters more than virality** ✅
   - EBC (high quality) > Pokhara (viral likes)
2. **Saves beat likes** ✅
   - ABC with 4 bookmarks ranks higher than similar posts with just likes
3. **Detailed itineraries win** ✅
   - 10+ day trips with full breakdowns beat 1-day minimal trips
4. **Personalization works** ✅
   - Budget mode shows different rankings for Alice vs Bob
5. **Evergreen content stays relevant** ✅
   - 60-day-old EBC post still ranks high (trek bonus)
6. **Trust boosts credibility** ✅
   - Alice's posts (experienced) rank higher than new users
7. **Low-quality content sinks** ✅
   - Bhaktapur (minimal details) ranks last regardless of freshness

---

## 🚀 Next Steps

If tests pass:

1. Remove `_feedScore` and `_scoreBreakdown` from production responses (or admin-only)
2. Monitor engagement patterns (save rate, session depth)
3. A/B test weight adjustments
4. Add caching for hot content
5. Precompute trip quality scores

If tests fail:

1. Check score breakdowns to debug which signal is off
2. Adjust weights in [feedRanking.ts](helpers/feedRanking.ts)
3. Re-seed database if needed: `bun prisma db seed`
4. Review [FEED_RANKING.md](FEED_RANKING.md) for algorithm details

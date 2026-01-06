# Seeding Complete ✅

## Summary

Comprehensive seed data has been created to test the feed ranking algorithm with realistic scenarios.

## What Was Seeded

### 👥 Users (5)

Created users with different travel preferences and budget ranges to test personalization:

- Alice: Adventure/Cultural ($300-$600) - **Experienced** (2 completed trips)
- Bob: Backpacking/Cultural ($100-$300) - Budget traveler
- Charlie: Cultural/Adventure ($400-$800) - Photographer
- Diana: Relaxed/Cultural ($500-$1000) - Wellness traveler
- Eve: Cultural/Relaxed ($200-$500) - Food explorer

### 📍 Locations (9)

Nepal's top destinations:

- Kathmandu: Pashupatinath, Boudhanath, Swayambhunath, Thamel
- Pokhara: Lakeside, Phewa Lake, Sarangkot Viewpoint
- Treks: Annapurna Base Camp, Everest Base Camp

### 🗺️ Trips (6)

Varying quality levels to test trip quality scoring:

| ID  | User    | Destination | Days | Budget     | Quality Level      | Status       | Age |
| --- | ------- | ----------- | ---- | ---------- | ------------------ | ------------ | --- |
| 1   | Alice   | ABC         | 10   | $500-700   | ⭐⭐⭐⭐⭐ High    | ✅ Completed | 15d |
| 2   | Bob     | Pokhara     | 3    | $150-250   | ⭐⭐ Low           | ✅ Completed | 5d  |
| 3   | Charlie | Bhaktapur   | 1    | null       | ⭐ Very Low        | ✅ Completed | 2d  |
| 4   | Alice   | EBC         | 14   | $1000-1500 | ⭐⭐⭐⭐⭐ Highest | ✅ Completed | 60d |
| 5   | Diana   | Lumbini     | 4    | $300-500   | ⭐⭐⭐ Medium      | ✅ Completed | 30d |
| 6   | Eve     | Chitwan     | 3    | $250-400   | N/A                | ⏳ Generated | -   |

**Quality variations:**

- **High quality:** Full daily breakdown, budget, cost breakdown, accommodation, meals, transport, tips
- **Medium quality:** Some details missing
- **Low quality:** Minimal itinerary, no budget
- **Very low:** Text-only itinerary, 1 day

### 📝 Posts (5)

Only completed trips have posts (Trip 6 Chitwan is still GENERATED):

| Post | Trip      | Engagement Pattern               | Test Purpose                         |
| ---- | --------- | -------------------------------- | ------------------------------------ |
| 1    | ABC       | 4 bookmarks, 3 comments, 4 likes | High quality + high engagement       |
| 2    | Pokhara   | 1 bookmark, 2 comments, 5 likes  | **Viral likes** (should rank lower!) |
| 3    | Bhaktapur | 0 bookmarks, 0 comments, 1 like  | Low everything                       |
| 4    | EBC       | 4 bookmarks, 4 comments, 4 likes | Highest quality + high engagement    |
| 5    | Lumbini   | 2 bookmarks, 1 comment, 3 likes  | Medium everything                    |

**Key test case:** Post 2 (Pokhara) has the MOST likes (5) but lowest quality. The algorithm should rank it lower than high-quality posts, proving saves > likes.

### 💬 Engagement Data

- **14 bookmarks** (highest intent - users want to reuse itinerary)
- **10 comments** (medium engagement)
- **17 likes** (weakest signal)

Weighted: Bookmark = 5pts, Comment = 3pts, Like = 1pt

### ⭐ Reviews (2)

- Alice's ABC trek review (location + trip linked)
- Alice's EBC trek review (location + trip linked)

These boost trust scores for verified trips.

### 🤖 AI Interactions (3)

Logged AI usage for:

- ABC trip generation (2500 tokens)
- Pokhara trip generation (1800 tokens)
- EBC trip generation (3500 tokens)

---

## Expected Feed Ranking Results

### Balanced Mode (Default Weights)

```
1. EBC (Alice)       - Score: ~85-90 | High quality + high engagement + trust
2. ABC (Alice)       - Score: ~82-88 | High quality + high engagement + fresh
3. Lumbini (Diana)   - Score: ~65-70 | Medium quality + medium engagement
4. Pokhara (Bob)     - Score: ~45-55 | Low quality BUT viral (proves algorithm works!)
5. Bhaktapur (Charlie) - Score: ~30-40 | Minimal quality + minimal engagement
```

### Trek Mode (Quality 45%, Trust 20%)

```
1. EBC (Alice)       - Even higher score (quality boosted)
2. ABC (Alice)       - Even higher score (quality boosted)
3. Lumbini (Diana)   - Similar
4. Pokhara (Bob)     - Even lower (low quality penalized more)
5. Bhaktapur (Charlie) - Bottom
```

### Budget Mode (Relevance 30%)

For Alice ($300-$600 budget):

```
1. ABC ($500-700)    - Perfect budget match + high quality
2. EBC ($1000-1500)  - Quality wins but budget mismatch
3. Lumbini ($300-500) - Budget match + decent quality
4. Pokhara ($150-250) - Outside budget range
5. Bhaktapur (null)   - No budget data
```

For Bob ($100-$300 budget):

```
1. Pokhara ($150-250) - HUGE boost! Perfect budget match
2. ABC ($500-700)     - Outside budget
3-5. Others...
```

---

## Key Testing Insights

### ✅ What This Tests

1. **Trip Quality Scoring**
   - Does a 14-day detailed EBC trek rank higher than a 1-day Bhaktapur trip?
   - Do itineraries with full details (accommodation, meals, transport, tips) score better?

2. **Engagement Quality Over Quantity**
   - Does a post with 4 bookmarks beat a post with 5 likes?
   - Is Pokhara (viral) correctly ranked BELOW high-quality posts?

3. **Trust & Credibility**
   - Does Alice (2 completed trips + reviews) rank higher than new users?
   - Do verified trips with linked reviews get boosted?

4. **Personalization**
   - Does Alice see different rankings than Bob?
   - Does budget mode correctly match user preferences?

5. **Freshness vs. Evergreen**
   - Does the 60-day-old EBC trek still rank high? (trek bonus applies)
   - Is there a balance between fresh content and quality?

6. **Feed Modes**
   - Does trek mode boost adventure content?
   - Does budget mode prioritize price-matching?
   - Does nearby mode (when implemented) consider location?

---

## How to Test

See [test-feed-ranking.md](test-feed-ranking.md) for detailed API testing instructions.

**Quick test:**

```bash
# 1. Start server
bun run dev

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'

# 3. Get feed
curl -X GET "http://localhost:3000/api/post/feed?limit=10" \
  -H "Authorization: Bearer <TOKEN>"

# 4. Check ranking order and _feedScore values
```

---

## Database Commands

**View data in Prisma Studio:**

```bash
bunx prisma studio
```

**Re-seed database:**

```bash
bun prisma db seed
```

**Reset database (⚠️ deletes all data):**

```bash
bun prisma migrate reset
```

---

## Files Modified

- ✅ [prisma/seed.ts](prisma/seed.ts) - Comprehensive seed data
- ✅ [test-feed-ranking.md](test-feed-ranking.md) - Testing guide
- ✅ [SEED_DATA.md](SEED_DATA.md) - This file

---

## Success Criteria

The feed ranking algorithm passes testing if:

- [ ] EBC ranks #1 (highest quality + trust)
- [ ] ABC ranks #2 (high quality + freshness)
- [ ] Pokhara (viral likes) does NOT rank #1
- [ ] Bhaktapur (minimal) ranks last
- [ ] Trek mode boosts trekking posts more
- [ ] Budget mode shows personalized results
- [ ] Score breakdowns are logical and debuggable

---

## Next Steps After Testing

1. **If tests pass:**
   - Remove debug fields (`_feedScore`, `_scoreBreakdown`) from production
   - Add feed result caching (Redis)
   - Precompute trip quality scores (store in Trip table)
   - Monitor metrics: save rate, session depth, return rate

2. **If tests fail:**
   - Check score breakdowns to identify which signal is off
   - Adjust weights in [helpers/feedRanking.ts](helpers/feedRanking.ts)
   - Re-seed and re-test

3. **Phase 2 enhancements:**
   - Implement actual geolocation matching for "nearby" mode
   - Add collaborative filtering (users like you also liked...)
   - A/B test different weight configurations
   - Machine learning ranking signals

---

## 🎉 Ready to Test!

All seed data is in the database. Follow [test-feed-ranking.md](test-feed-ranking.md) to verify the feed ranking algorithm works as designed.

**Credentials:**

- Email: `alice@example.com`
- Password: `password123`

Happy testing! 🚀

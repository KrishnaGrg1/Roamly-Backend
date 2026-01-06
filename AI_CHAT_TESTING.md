# AI Chat Testing Guide

Quick reference for testing the Roamly AI Chat system.

---

## Prerequisites

1. **Server running**: `bun dev`
2. **Database seeded**: `bun prisma db seed`
3. **User authenticated**: Get JWT token from login

---

## Get JWT Token

```bash
# Login as Alice (has completed trips to Kathmandu)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123"
  }'

# Save the token from response
TOKEN="<your-jwt-token-here>"
```

---

## Test Flow

### 1. Create Chat Session

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Planning my Pokhara adventure"
  }'

# Save the sessionId from response
SESSION_ID="<session-id-here>"
```

**Expected**: Session created with `active: true`, `messageCount: 0`

---

### 2. Send First Message (Explore Intent)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the best things to do in Pokhara?"
  }'
```

**Expected Response**:

- Intent detected as `EXPLORE`
- Destination extracted as `Pokhara`
- Response cites specific trips/posts from database
- Includes `contextRefs` array with TRIP/POST/LOCATION references
- No hallucinated data

**Example Response Content**:

```
"Based on completed trips to Pokhara in our database, here are some great activities:

Phewa Lake boating is highly recommended - one traveler reported spending ₹5000 for boat rental and enjoying the Tal Barahi Temple visit.

Hiking to World Peace Pagoda for sunrise is popular according to posts in our database. The trek takes about 2 hours.

Davis Falls and Gupteshwor Cave are worth visiting - budget around ₹2000 for entry fees based on completed trips.

Note: These recommendations are based on 2 completed trips to Pokhara in our database."
```

---

### 3. Send Planning Message (Plan Intent)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you help me plan a 3-day trip to Kathmandu on a budget of ₹15000?"
  }'
```

**Expected Response**:

- Intent detected as `PLAN`
- Destination extracted as `Kathmandu`
- Response includes specific budget breakdown from database
- Cites completed trips with similar budgets
- Admits if specific hotels/routes not in database

---

### 4. Send Comparison Message (Compare Intent)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Should I visit Pokhara or Chitwan for my first Nepal trip?"
  }'
```

**Expected Response**:

- Intent detected as `COMPARE`
- Compares based on trips in database
- Cites specific user preferences (if available)
- Admits if one destination lacks data

---

### 5. Get Session Details

```bash
curl -X GET http://localhost:3000/api/v1/ai/chat/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:

- All messages in conversation
- Context references for each assistant message
- Updated `messageCount` and `tokenCount`
- Intent classification visible

---

### 6. List All Sessions

```bash
# List all sessions
curl -X GET http://localhost:3000/api/v1/ai/chat/sessions \
  -H "Authorization: Bearer $TOKEN"

# List only active sessions
curl -X GET "http://localhost:3000/api/v1/ai/chat/sessions?activeOnly=true" \
  -H "Authorization: Bearer $TOKEN"

# Paginated list
curl -X GET "http://localhost:3000/api/v1/ai/chat/sessions?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:

- Array of sessions with metadata
- Pagination info if `cursor` provided
- Filtered results if `activeOnly=true`

---

### 7. End Session

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/end \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:

- Session marked as `active: false`
- User can now create new session

---

## Edge Case Tests

### Test 1: Insufficient Context (No Data)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about traveling to Mustang"
  }'
```

**Expected**:

```json
{
  "success": false,
  "message": "I don't have enough information in our database to answer that. Try asking about destinations with more trip data like Kathmandu, Pokhara, or Chitwan."
}
```

---

### Test 2: Active Session Limit

```bash
# Try creating second session while first is still active
curl -X POST http://localhost:3000/api/v1/ai/chat/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Second session attempt"
  }'
```

**Expected**:

```json
{
  "success": false,
  "message": "You already have an active chat session. Please end it first or continue with the existing session."
}
```

---

### Test 3: Message Limit

```bash
# Send 15 messages, then try 16th
for i in {1..16}; do
  curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Message $i\"}"
  sleep 2
done
```

**Expected on 16th message**:

```json
{
  "success": false,
  "message": "Message limit reached (15 messages per session). Please end this session and start a new one."
}
```

---

### Test 4: Invalid Session ID

```bash
curl -X GET http://localhost:3000/api/v1/ai/chat/invalid-uuid \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:

```json
{
  "success": false,
  "message": "Session not found"
}
```

---

### Test 5: Session From Different User

```bash
# Login as Bob
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "password123"
  }'

BOB_TOKEN="<bob-token>"

# Try accessing Alice's session
curl -X GET http://localhost:3000/api/v1/ai/chat/$SESSION_ID \
  -H "Authorization: Bearer $BOB_TOKEN"
```

**Expected**:

```json
{
  "success": false,
  "message": "Session not found"
}
```

---

## Validation Tests

### Test 6: Empty Message

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": ""
  }'
```

**Expected**: 400 error, "Message must be 1-2000 characters"

---

### Test 7: Message Too Long

```bash
# Create message > 2000 chars
LONG_MESSAGE=$(python3 -c "print('a' * 2001)")

curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$LONG_MESSAGE\"}"
```

**Expected**: 400 error, "Message must be 1-2000 characters"

---

### Test 8: Title Too Long

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"$(python3 -c 'print("a" * 101)')\"}"
```

**Expected**: 400 error, "Title must be max 100 characters"

---

## Response Quality Tests

### Test 9: Budget Question (Should Use Real Data)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How much does a 5-day trip to Kathmandu cost?"
  }'
```

**Expected**:

- Response cites specific budgets from completed trips
- Mentions budget range (e.g., "₹30,000 - ₹50,000 based on 2 completed trips")
- Does NOT invent specific prices

---

### Test 10: Hotel Question (Should Cite or Admit Unknown)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What hotels do you recommend in Pokhara?"
  }'
```

**Expected**:

- If hotels in database: Cites specific hotels from trips
- If no hotels: "I don't have specific hotel data in our database for Pokhara"
- Does NOT invent hotel names

---

## Performance Tests

### Test 11: Token Usage Tracking

```bash
# Send message and check tokenCount
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quick question about Kathmandu temples"
  }'

# Check session tokenCount
curl -X GET http://localhost:3000/api/v1/ai/chat/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.data.session.tokenCount'
```

**Expected**: tokenCount increases with each message

---

### Test 12: Context Reference Tracking

```bash
# Send message and check contextRefs
curl -X POST http://localhost:3000/api/v1/ai/chat/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me completed trips to Pokhara"
  }' | jq '.data.message.contextRefs'
```

**Expected**:

- Array of references with `refType` (TRIP/POST/LOCATION) and `refId`
- References correspond to actual database IDs

---

## Debug Tips

### View OpenRouter API Calls

Check terminal logs for:

```
[AI Chat] Calling OpenRouter...
[AI Chat] Response: { ... }
[AI Chat] Tokens used: input=X, output=Y
```

### Check Database State

```bash
# View sessions
bunx prisma studio

# Or SQL directly
psql -d roamly -c "SELECT * FROM \"AIChatSession\" WHERE \"userId\" = '<user-id>';"
```

### Enable Verbose Logging

Add to [aiChat.helper.ts](helpers/aiChat.helper.ts):

```typescript
console.log('[Context]', JSON.stringify(context, null, 2));
console.log('[Prompt]', prompt);
console.log('[Response]', response);
```

---

## Success Criteria

✅ **All endpoints work**

- Create session
- Send message
- Get session
- List sessions
- End session

✅ **Grounded responses**

- No hallucinated hotels/prices
- Cites specific trips/posts
- Admits unknowns clearly

✅ **Limits enforced**

- 1 active session per user
- 15 messages per session
- Token tracking working

✅ **Validation working**

- Empty message rejected
- Long message rejected
- Invalid session ID handled
- Cross-user access blocked

✅ **Intent detection**

- PLAN detected for "plan a trip"
- EXPLORE detected for "what to do"
- COMPARE detected for "versus"

✅ **Context building**

- Loads user trips correctly
- Finds similar trips
- Extracts destination
- hasEnoughContext() works

---

## Troubleshooting

### "OpenRouter API error"

- Check `OPENAI_API_KEY` in .env
- Verify `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
- Check OpenRouter account balance

### "I don't have enough information"

- Add more seed data for that destination
- Check user has completed/saved trips
- Verify similar trips exist in database

### "Session not found"

- Check sessionId is valid UUID
- Verify session belongs to authenticated user
- Check session not marked inactive

### Slow responses

- Normal first response: 2-5 seconds (context building + LLM)
- Subsequent: 1-3 seconds (context cached)
- If >10 seconds: Check OpenRouter latency

---

## Next Steps

After successful testing:

1. ✅ Deploy to staging environment
2. ✅ Monitor token usage costs
3. ✅ Gather user feedback on response quality
4. ✅ Tune context limits based on usage patterns
5. ✅ Add more destinations to extraction
6. ✅ Implement streaming responses (optional)

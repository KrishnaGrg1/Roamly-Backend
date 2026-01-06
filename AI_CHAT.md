# Roamly AI Chat System

## Overview

The Roamly AI Chat system provides **database-first, read-only intelligence** for Nepal travel planning. It's designed to answer questions using ONLY verified data from the database—never inventing hotels, routes, or prices.

### Core Principles

1. **Database-First**: AI can ONLY reference trips, locations, and posts that exist in the database
2. **Read-Only**: Never modifies data (except creating chat sessions/messages)
3. **Grounded Responses**: System prompt forces AI to cite sources and admit unknowns
4. **Cost Controls**: Hard limits on sessions, messages, and tokens per user
5. **Context Building**: Smart loading of relevant trips, locations, and posts with strict limits

---

## Architecture

### Database Models

```prisma
model AIChatSession {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  title        String?  @db.VarChar(100)
  intent       ChatIntent @default(GENERAL)
  active       Boolean  @default(true)

  messageCount Int      @default(0)
  tokenCount   Int      @default(0)

  messages     AIChatMessage[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model AIChatMessage {
  id        String   @id @default(uuid())
  sessionId String
  session   AIChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  role      ChatMessageRole
  content   String   @db.Text
  tokens    Int      @default(0)

  contextRefs AIContextReference[]

  timestamp DateTime @default(now())
}

model AIContextReference {
  id        String @id @default(uuid())
  messageId String
  message   AIChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  refType   ContextRefType
  refId     String
}

enum ChatIntent {
  PLAN      // Planning new trip
  MODIFY    // Modifying existing trip
  COMPARE   // Comparing options
  RECALL    // Asking about completed trip
  EXPLORE   // General discovery
  GENERAL   // Default
}

enum ChatMessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum ContextRefType {
  TRIP
  POST
  LOCATION
  REVIEW
}
```

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Chat Request                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                     aiChat.controller.ts                        │
│  - Validates session limits (1 active per user)                 │
│  - Enforces message limit (15 per session)                      │
│  - Extracts destination & detects intent                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                   chatContext.helper.ts                         │
│  - buildChatContext(): Loads trips (3 completed, 3 saved,       │
│    5 generated) + similar trips (5) + posts (5) + locations (5) │
│  - hasEnoughContext(): Validates sufficient data                │
│  - extractDestination(): Simple keyword extraction              │
│  - detectIntent(): Rule-based classification                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                     aiChat.helper.ts                            │
│  - buildPrompt(): Structures context as JSON                    │
│  - callAIChatWithContext(): Calls OpenRouter                    │
│  - validateAIResponse(): Checks for hallucinations              │
│  - extractReferences(): Tracks which data was used              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                        OpenRouter API                           │
│  Model: gpt-4-turbo-preview                                     │
│  Max tokens: 1000                                               │
│  Temperature: 0.7                                               │
│  History: Last 6 messages                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                     Response Validation                         │
│  - Check for dangerous phrases ("I guarantee", etc.)            │
│  - Verify budget data exists if mentioned                       │
│  - Prevent detailed responses without context                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                    Save Message + References                    │
│  - Store assistant message                                      │
│  - Log context references (TRIP/POST/LOCATION)                  │
│  - Update session counters                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Create Chat Session

**POST** `/ai/chat/session`

Creates a new chat session. Enforces limit of 1 active session per user.

**Request Body:**

```json
{
  "title": "Planning Kathmandu trip" // Optional, max 100 chars
}
```

**Response:**

```json
{
  "success": true,
  "message": "Chat session created successfully",
  "data": {
    "session": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userId": "user-id",
      "title": "Planning Kathmandu trip",
      "intent": "GENERAL",
      "active": true,
      "messageCount": 0,
      "tokenCount": 0,
      "createdAt": "2024-01-06T12:00:00Z",
      "updatedAt": "2024-01-06T12:00:00Z"
    }
  }
}
```

**Errors:**

- 400: Already have an active session

---

### 2. Send Message

**POST** `/ai/chat/:sessionId/message`

Send a message to the AI chat. This is the main endpoint that:

1. Validates session limits (15 messages max)
2. Detects intent and destination
3. Builds context from database
4. Calls LLM with context
5. Validates response for hallucinations
6. Saves message and tracks references

**Request Body:**

```json
{
  "message": "What are the best places to visit in Pokhara?"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "id": "msg-id",
      "sessionId": "session-id",
      "role": "ASSISTANT",
      "content": "Based on the trips in our database, Pokhara has several amazing places...",
      "tokens": 250,
      "timestamp": "2024-01-06T12:00:00Z",
      "contextRefs": [
        {
          "id": "ref-1",
          "refType": "TRIP",
          "refId": "trip-123"
        },
        {
          "id": "ref-2",
          "refType": "LOCATION",
          "refId": "location-456"
        }
      ]
    },
    "session": {
      "messageCount": 2,
      "tokenCount": 500,
      "intent": "EXPLORE"
    }
  }
}
```

**Errors:**

- 404: Session not found
- 400: Session inactive
- 400: Message limit reached (15 messages)
- 400: Insufficient context to answer
- 500: AI validation failed

---

### 3. Get Session

**GET** `/ai/chat/:sessionId`

Retrieve a chat session with all messages and context references.

**Response:**

```json
{
  "success": true,
  "message": "Session retrieved successfully",
  "data": {
    "session": {
      "id": "session-id",
      "userId": "user-id",
      "title": "Planning Kathmandu trip",
      "intent": "PLAN",
      "active": true,
      "messageCount": 4,
      "tokenCount": 1200,
      "createdAt": "2024-01-06T12:00:00Z",
      "updatedAt": "2024-01-06T12:05:00Z",
      "messages": [
        {
          "id": "msg-1",
          "role": "USER",
          "content": "What are the best places in Kathmandu?",
          "tokens": 10,
          "timestamp": "2024-01-06T12:00:00Z",
          "contextRefs": []
        },
        {
          "id": "msg-2",
          "role": "ASSISTANT",
          "content": "Based on trips in our database...",
          "tokens": 300,
          "timestamp": "2024-01-06T12:00:05Z",
          "contextRefs": [
            {
              "id": "ref-1",
              "refType": "TRIP",
              "refId": "trip-123"
            }
          ]
        }
      ]
    }
  }
}
```

---

### 4. List Sessions

**GET** `/ai/chat/sessions`

List user's chat sessions with pagination.

**Query Parameters:**

- `limit`: Number of sessions (default: 20, max: 50)
- `cursor`: Session ID for pagination
- `activeOnly`: Filter to active sessions only (default: false)

**Response:**

```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "id": "session-1",
        "title": "Planning Kathmandu trip",
        "intent": "PLAN",
        "active": true,
        "messageCount": 4,
        "tokenCount": 1200,
        "createdAt": "2024-01-06T12:00:00Z",
        "updatedAt": "2024-01-06T12:05:00Z"
      }
    ],
    "pagination": {
      "hasMore": false,
      "nextCursor": null
    }
  }
}
```

---

### 5. End Session

**POST** `/ai/chat/:sessionId/end`

Mark a chat session as inactive (soft delete). This allows user to start a new session.

**Response:**

```json
{
  "success": true,
  "message": "Session ended successfully",
  "data": {
    "session": {
      "id": "session-id",
      "active": false,
      "updatedAt": "2024-01-06T12:10:00Z"
    }
  }
}
```

---

## Context Building

The `chatContext.helper.ts` builds context with **hard limits** to prevent token explosion:

### User's Trips (Max Limits)

- **Completed trips**: 3 most recent
- **Saved trips**: 3 most recent
- **Generated trips**: 5 most recent

### Similar Trips (Max 5)

Loads trips to detected destination with:

- Same travel style as user
- Completed trips only
- Ordered by engagement score

### Posts (Max 5)

Recent posts about detected destination:

- Photos and captions
- Engagement data

### Locations (Max 5)

Top-rated locations in detected destination:

- Name, description, category
- Rating and review count

### Data Structure Sent to LLM

```json
{
  "userTrips": {
    "completed": [
      {
        "id": "trip-1",
        "title": "Kathmandu Cultural Tour",
        "destination": "Kathmandu",
        "days": 5,
        "status": "COMPLETED",
        "budget": 50000,
        "travelStyle": "CULTURAL",
        "activities": ["Temple visits", "Local food"],
        "hotels": ["Hotel Yak & Yeti"],
        "routes": ["Kathmandu → Bhaktapur → Patan"]
      }
    ],
    "saved": [...],
    "generated": [...]
  },
  "similarTrips": [...],
  "posts": [...],
  "locations": [...],
  "constraints": {
    "maxCompletedTrips": 3,
    "maxSavedTrips": 3,
    "maxGeneratedTrips": 5,
    "maxSimilarTrips": 5,
    "maxPosts": 5,
    "maxLocations": 5
  }
}
```

---

## System Prompt (Key Section)

```
You are Roamly AI, a Nepal travel assistant. You MUST answer ONLY using the provided trips, posts, and locations from the database.

CRITICAL RULES:
1. NEVER invent hotels, routes, prices, or activities not in the context
2. NEVER say "I can help you plan" without specific data
3. NEVER guarantee safety, weather, or availability
4. If information is missing, say so clearly: "I don't have data about X in our database"
5. ALWAYS cite specific trips/posts when giving recommendations
6. If budget is mentioned, ONLY use budgets from provided trips

RESPONSE FORMAT:
- Short paragraphs (2-3 sentences)
- Cite sources: "Based on completed trip to Kathmandu..."
- Admit unknowns: "I don't have information about..."
- Never exceed context boundaries
```

---

## Response Validation

The `validateAIResponse()` function checks for:

### Dangerous Phrases

- "I guarantee"
- "definitely safe"
- "certainly will"
- "promise"
- "100%"
- Other absolute statements

### Budget Mentions

If response mentions budget/cost/price, verify:

- At least one trip in context has budget data
- Response doesn't invent specific prices

### Context Depth

If response has >200 chars, verify:

- User has at least 2 trips OR
- Context has at least 3 similar trips

### Unknown Admission

Validates that AI admits unknowns rather than inventing data.

---

## Cost Controls

### Hard Limits

| Resource                 | Limit | Reason                 |
| ------------------------ | ----- | ---------------------- |
| Active sessions per user | 1     | Prevent session spam   |
| Messages per session     | 15    | Control API costs      |
| Tokens per response      | 1000  | Prevent long responses |
| Message history          | 6     | Limit context window   |

### Token Tracking

Every message tracks:

- Input tokens (user message)
- Output tokens (assistant response)
- Cumulative session tokens

Session is auto-terminated at 15 messages.

---

## Intent Detection

Rule-based classification (no LLM needed):

```typescript
function detectIntent(message: string): ChatIntent {
  const lower = message.toLowerCase();

  if (/plan|create|generate|suggest|itinerary/i.test(lower)) {
    return 'PLAN';
  }
  if (/change|modify|update|edit|different/i.test(lower)) {
    return 'MODIFY';
  }
  if (/compare|versus|vs|better|difference/i.test(lower)) {
    return 'COMPARE';
  }
  if (/remember|recall|past|previous|completed/i.test(lower)) {
    return 'RECALL';
  }
  if (/show|tell|what|where|when|explore|discover/i.test(lower)) {
    return 'EXPLORE';
  }

  return 'GENERAL';
}
```

---

## Destination Extraction

Simple keyword matching for Nepal destinations:

```typescript
const NEPAL_DESTINATIONS = [
  'Kathmandu',
  'Pokhara',
  'Chitwan',
  'Lumbini',
  'Nagarkot',
  'Bhaktapur',
  'Patan',
  'Bandipur',
  'Gorkha',
  'Janakpur',
];

function extractDestination(message: string): string | null {
  for (const dest of NEPAL_DESTINATIONS) {
    if (message.toLowerCase().includes(dest.toLowerCase())) {
      return dest;
    }
  }
  return null;
}
```

---

## Testing Examples

### Example 1: Planning Trip (With Context)

**Request:**

```bash
curl -X POST http://localhost:3000/api/ai/chat/session-id/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "What should I do in Pokhara for 3 days?"}'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "message": {
      "content": "Based on completed trips to Pokhara in our database, here's a great 3-day plan:\n\nDay 1: Start with Phewa Lake boating and visit Tal Barahi Temple. One traveler spent ₹5000 for boat rental.\n\nDay 2: Trek to World Peace Pagoda for sunrise. According to posts in our database, this takes about 2 hours.\n\nDay 3: Visit Davis Falls and Gupteshwor Cave. Budget around ₹2000 for entry fees based on completed trips.\n\nNote: These recommendations are based on 2 completed trips to Pokhara in our database.",
      "tokens": 180
    }
  }
}
```

### Example 2: Insufficient Context

**Request:**

```bash
curl -X POST http://localhost:3000/api/ai/chat/session-id/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Plan a trip to Mustang"}'
```

**Expected Response:**

```json
{
  "success": false,
  "message": "I don't have enough information in our database to answer that. Try asking about destinations with more trip data like Kathmandu, Pokhara, or Chitwan."
}
```

### Example 3: Session Limit

**Request:**

```bash
# After 15 messages
curl -X POST http://localhost:3000/api/ai/chat/session-id/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "One more question"}'
```

**Expected Response:**

```json
{
  "success": false,
  "message": "Message limit reached (15 messages per session). Please end this session and start a new one."
}
```

---

## Best Practices

### For Users

1. **Be specific**: "What hotels in Kathmandu cost under ₹3000?" vs "Hotels?"
2. **One question at a time**: Better context building
3. **Use trip data**: System works best with your completed/saved trips
4. **Accept limitations**: If data doesn't exist, AI will say so

### For Developers

1. **Monitor token usage**: Track cumulative costs per user
2. **Adjust context limits**: Tune based on usage patterns
3. **Add destinations**: Update `NEPAL_DESTINATIONS` array as needed
4. **Improve validation**: Add more hallucination patterns to catch
5. **Test with minimal data**: Verify graceful degradation

---

## Troubleshooting

### "I don't have enough information"

**Cause**: User has no trips or context is insufficient

**Solution**:

- Add seed data for popular destinations
- Encourage users to save/complete trips
- Check `hasEnoughContext()` thresholds

### AI inventing data

**Cause**: System prompt not strong enough or validation failed

**Solution**:

- Strengthen system prompt
- Add more phrases to `validateAIResponse()`
- Lower temperature (currently 0.7)

### High costs

**Cause**: Too many sessions or messages

**Solution**:

- Lower message limit (currently 15)
- Reduce max tokens (currently 1000)
- Shrink context limits (3 completed, 3 saved, 5 generated)

### Slow responses

**Cause**: Large context or model latency

**Solution**:

- Cache similar trips queries
- Reduce context limits
- Use faster model (e.g., gpt-3.5-turbo)

---

## Future Improvements

1. **Streaming responses**: Implement SSE for real-time typing effect
2. **Multi-turn planning**: Allow AI to ask clarifying questions
3. **Image understanding**: Process uploaded trip photos
4. **Voice input**: Speech-to-text integration
5. **Proactive suggestions**: "Based on your trips, you might like..."
6. **Better intent detection**: Use lightweight classifier model
7. **Context caching**: Cache frequently accessed trips/locations
8. **A/B testing**: Experiment with different prompts and limits

---

## Environment Variables

```env
# OpenRouter API Configuration
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4-turbo-preview

# Optional: Override defaults
AI_CHAT_MAX_MESSAGES=15
AI_CHAT_MAX_TOKENS=1000
AI_CHAT_TEMPERATURE=0.7
```

---

## Related Files

- **Controller**: `controllers/aiChat.controller.ts`
- **Routes**: `routes/aiChat.routes.ts`
- **Validation**: `validation/aiChat.validation.ts`
- **Context Builder**: `helpers/chatContext.helper.ts`
- **LLM Helper**: `helpers/aiChat.helper.ts`
- **Schema**: `prisma/schema.prisma` (AIChatSession, AIChatMessage, AIContextReference)

---

## Summary

The Roamly AI Chat system is a **database-first, grounded AI** that:

- ✅ Never invents data
- ✅ Always cites sources
- ✅ Admits unknowns gracefully
- ✅ Controls costs with hard limits
- ✅ Provides intelligent context building
- ✅ Validates responses for hallucinations

It's designed to be a helpful travel assistant that knows its limits and refuses to guess.

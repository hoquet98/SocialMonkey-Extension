# Backend Tweet Evaluation System

## Overview

The SocialMonkey Twitter extension now includes an intelligent batched backend evaluation system that provides AI-powered recommendations for tweet engagement. This system works alongside the existing local high-impact scoring to give users personalized guidance on which tweets to reply to, retweet, or like based on their niche relevance.

## Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User scrolls Twitter feed                                    │
│    - MutationObserver detects new tweets                        │
│    - extractTweetData() parses tweet content & engagement       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Local High-Impact Scoring (Client-Side)                      │
│    - scoreTweetForEngagement() computes 0-100 score             │
│    - Based on likes, replies, retweets, recency                 │
│    - If score ≥ 70 → Show "High-Impact" badge                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend Evaluation Queue (if score ≥ 60 & user connected)   │
│    - queueTweetForEvaluation() adds tweet to evalQueue          │
│    - Checks: MIN_LOCAL_IMPACT_SCORE_FOR_EVAL (60)              │
│    - Checks: smAccessToken exists (user connected)              │
│    - Deduplicates: evalQueuedIds Set prevents duplicates        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Batch Send Trigger                                           │
│    - scheduleEvalBatch() monitors queue size                    │
│    - If queue.length ≥ EVAL_BATCH_SIZE (20) → send immediately │
│    - Else: debounce timer (1500ms) → send partial batch        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Backend API Call                                             │
│    POST https://socialmonkey.ai/api/twitter/evaluate-posts      │
│    Authorization: Bearer <smAccessToken>                        │
│    Body: { platform: "twitter", tweets: [...] }                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Backend Response Processing                                  │
│    - Parse JSON: { results: [{id, should_reply, ...}] }        │
│    - For each result: lookup tweetElement from tweetElementMap  │
│    - applyEngagementRecommendations()                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. UI Updates                                                    │
│    - should_reply → Purple glow on reply icon                   │
│    - should_retweet → Green glow on retweet icon                │
│    - should_like → Orange glow on like icon                     │
│    - Pulse animations + tooltips with reason_summary            │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

All tunable parameters are centralized in `content_scripts/twitter/twitter-config.js`:

```javascript
const TWITTER_CONFIG = {
  // Batch size - number of tweets to accumulate before sending to backend
  EVAL_BATCH_SIZE: 20,                // ↑ = fewer API calls, ↓ = faster feedback

  // Debounce timer - max wait time for partial batch (milliseconds)
  EVAL_DEBOUNCE_MS: 1500,             // ↑ = larger batches, ↓ = faster feedback

  // Minimum local score required to queue tweet for backend evaluation
  MIN_LOCAL_IMPACT_SCORE_FOR_EVAL: 60, // ↑ = fewer API calls, ↓ = more evaluations

  // Backend API endpoint
  API_ENDPOINT: 'https://socialmonkey.ai/api/twitter/evaluate-posts',

  // Debug logging
  DEBUG_EVAL: true
};
```

### Tuning Recommendations

- **High-volume users** (many tweets): Increase `EVAL_BATCH_SIZE` to 30-40, increase `MIN_SCORE` to 70
- **Low-volume users** (few tweets): Decrease `EVAL_BATCH_SIZE` to 10-15, decrease `MIN_SCORE` to 50
- **API cost optimization**: Increase `MIN_SCORE` to 70-80 to only evaluate truly high-impact tweets
- **Fast feedback**: Decrease `EVAL_DEBOUNCE_MS` to 500-1000ms

## Backend API Contract

### Request

**Endpoint:** `POST https://socialmonkey.ai/api/twitter/evaluate-posts`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <smAccessToken>
```

**Body:**
```json
{
  "platform": "twitter",
  "tweets": [
    {
      "id": "1234567890",
      "text": "Check out this amazing AI tool...",
      "authorHandle": "elonmusk",
      "likes": 1500,
      "replies": 42,
      "retweets": 120,
      "timestamp": "2025-01-15T10:30:00.000Z",
      "localScore": 85
    },
    // ... up to EVAL_BATCH_SIZE tweets
  ]
}
```

### Response

**Status:** `200 OK`

**Body:**
```json
{
  "results": [
    {
      "id": "1234567890",
      "priority_score": 87,
      "should_reply": true,
      "should_retweet": false,
      "should_like": true,
      "reason_summary": "Strong niche fit (AI tools) and high engagement. Author is influential in your target audience."
    },
    // ... results for all submitted tweets
  ]
}
```

### Error Handling

- **401 Unauthorized:** Token expired → User sees no backend recommendations (limited mode)
- **429 Too Many Requests:** Backend rate limit → Extension logs error, retries tweets on next batch
- **5xx Server Error:** Backend issue → Extension logs error, removes tweets from queue

## UI Visual Design

### Engagement Recommendation Highlights

The system adds three distinct visual indicators to tweet action buttons:

1. **Reply Recommendation** (Purple)
   - Color: `#a855f7`
   - Glow: Purple drop-shadow with pulse animation
   - Tooltip: `💬 Recommended: [reason_summary]`

2. **Retweet Recommendation** (Green)
   - Color: `#22c55e`
   - Glow: Green drop-shadow with pulse animation
   - Tooltip: `🔄 Recommended: [reason_summary]`

3. **Like Recommendation** (Orange)
   - Color: `#f97316`
   - Glow: Orange drop-shadow with pulse animation
   - Tooltip: `❤️ Recommended: [reason_summary]`

### CSS Classes

```css
.sm-recommend-reply    { /* Purple glow, pulse animation */ }
.sm-recommend-retweet  { /* Green glow, pulse animation */ }
.sm-recommend-like     { /* Orange glow, pulse animation */ }
```

## Limited Mode vs Connected Mode

### Limited Mode (No smAccessToken)
- ✅ Local high-impact scoring works
- ✅ "High-Impact" badges displayed
- ❌ No backend evaluation
- ❌ No AI-powered engagement recommendations
- ❌ No icon highlighting

### Connected Mode (smAccessToken exists)
- ✅ Local high-impact scoring works
- ✅ "High-Impact" badges displayed
- ✅ Backend evaluation enabled
- ✅ AI-powered engagement recommendations
- ✅ Reply/retweet/like icons highlighted
- ✅ Tooltips with niche-relevance explanations

## Performance Considerations

### Memory Management
- `evalQueue`: Cleared after each batch send (max 20 items at once)
- `evalQueuedIds`: Set grows with page scroll, but tweet IDs are small (≈50 bytes each)
- `tweetElementMap`: Holds references to DOM elements; cleaned up when tweets leave viewport (handled by WeakSet in `processedTweets`)

### Network Efficiency
- **Batching:** 20 tweets/request instead of 20 individual requests = 95% fewer API calls
- **Debouncing:** Prevents rapid-fire requests during scrolling
- **Deduplication:** `evalQueuedIds` Set ensures each tweet evaluated only once
- **Conditional:** Only tweets with score ≥ 60 are queued (typically 10-20% of feed)

### API Rate Limits
Assuming user scrolls 100 tweets:
- Without batching: 100 API requests
- With batching (size=20): 5 API requests
- With threshold (60+ score): ≈2 API requests (10-20 high-impact tweets)

## Testing Checklist

### Local Features (Limited Mode)
- [ ] Load extension without connecting account
- [ ] Scroll Twitter feed
- [ ] Verify "High-Impact" badges appear on engaging tweets
- [ ] Confirm NO backend API calls in Network tab
- [ ] Confirm NO icon highlighting

### Backend Evaluation (Connected Mode)
- [ ] Connect SocialMonkey account
- [ ] Scroll Twitter feed slowly
- [ ] Open DevTools Console → Filter "Twitter:Eval"
- [ ] Verify debug logs show:
  - [ ] `Twitter:Eval:Queue` - Tweets added to queue
  - [ ] `Twitter:Eval:Schedule` - Batch scheduling
  - [ ] `Twitter:Eval:Send` - API requests
  - [ ] `Twitter:Eval:Response` - Backend responses
  - [ ] `Twitter:Eval:Apply` - UI updates
- [ ] Verify Network tab shows POST to `/api/twitter/evaluate-posts`
- [ ] Verify reply/retweet/like icons glow on recommended tweets
- [ ] Hover over highlighted icons → Verify tooltips with `reason_summary`

### Edge Cases
- [ ] Disconnect account mid-scroll → Batch drops, no more evaluations
- [ ] Backend returns 401 → Extension logs error, no crash
- [ ] Backend returns malformed JSON → Extension logs error, no crash
- [ ] Tweet element removed from DOM before backend responds → No error, skips gracefully

## Debugging

### Enable Debug Logging

Set `DEBUG_EVAL: true` in `twitter-config.js` (default).

### Console Log Namespaces

- `Twitter:Eval:Queue` - Tweet queuing events
- `Twitter:Eval:Schedule` - Batch scheduling decisions
- `Twitter:Eval:Send` - API request details
- `Twitter:Eval:Response` - Backend response processing
- `Twitter:Eval:Apply` - UI update application
- `Twitter:Eval:Highlight` - Icon highlighting
- `Twitter:Eval:Styles` - CSS injection
- `Twitter:Eval:Error` - Error handling

### Common Issues

**No backend calls happening:**
- Check: User connected? (`chrome.storage.local` → `smAccessToken`)
- Check: Tweet scores meeting threshold? (Look for `Twitter:Feature1:Score` logs)
- Check: `MIN_LOCAL_IMPACT_SCORE_FOR_EVAL` too high?

**Icons not highlighting:**
- Check: Backend response format matches expected structure?
- Check: `tweetElementMap` contains tweet IDs? (`console.log(tweetElementMap)`)
- Check: CSS injected? (Look for `<style>` tag with `sm-recommend-` classes)

**Batch never sends:**
- Check: `EVAL_BATCH_SIZE` too high for typical scroll behavior?
- Check: `EVAL_DEBOUNCE_MS` timer firing? (Should see `Debounce timer fired` log)

## Future Enhancements

1. **User Preferences:** Allow users to customize thresholds and batch size via popup settings
2. **Priority Queue:** Evaluate highest-scoring tweets first instead of FIFO
3. **Retry Logic:** Exponential backoff for failed API requests
4. **Offline Queue:** Persist queue to `chrome.storage.local` to survive page refreshes
5. **Analytics:** Track recommendation acceptance rate (did user actually engage?)
6. **Streaming API:** WebSocket connection for real-time evaluation without batching
7. **Niche Customization:** Let users specify topics/keywords to prioritize in backend evaluation

## Related Files

- `content_scripts/twitter/twitter-config.js` - Configuration
- `content_scripts/twitter/twitter-advanced.js` - Implementation (lines 43-440)
- `manifests/twitter.json` - Extension manifest
- `BACKEND_INTEGRATION.md` - OAuth flow documentation

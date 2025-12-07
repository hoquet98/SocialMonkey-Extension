# Reply Starters Feature - Testing Guide

## Implementation Complete ✅

The Reply Starters feature has been fully implemented and integrated into the SocialMonkey Twitter extension.

## What Was Added

### 1. Content Script Changes ([twitter-advanced.js](content_scripts/twitter/twitter-advanced.js))

**Lines 1043-1418**: Complete Reply Starters implementation including:
- Cache system for API responses
- Authentication helper
- Button injection next to High-Impact badges
- Click handler with toggle functionality
- API integration via background script
- Accordion UI rendering with categories
- Text insertion into Twitter's reply box

**Line 967**: Integration call added to `markTweetAsHighImpact()` function

### 2. Background Script Changes ([background.js](background.js))

**Lines 50-55**: Added message handler for `fetchReplyStarters` action

**Lines 138-176**: Added `handleFetchReplyStarters()` function to proxy API calls

## How It Works

### User Flow

1. **User scrolls Twitter feed** → High-Impact tweets are detected and marked with blue badges
2. **Purple "💬 Reply Starters" button appears** next to each High-Impact badge
3. **User clicks button** → Extension checks authentication
4. **If authenticated** → Fetches AI-generated reply suggestions from backend
5. **Accordion displays** with 2-5 categories of suggestions:
   - 💡 Insightful
   - 🔥 Contrarian
   - 🎣 Hooks
   - 😄 Playful
   - 💪 Supportive
6. **User clicks category** → Expands to show 3 suggestions
7. **User clicks suggestion** → Opens Twitter's reply box and inserts text (does NOT auto-send)

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. High-Impact Tweet Detected                                   │
│    - markTweetAsHighImpact() adds blue badge                    │
│    - addReplyStartersButton() adds purple button                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. User Clicks "Reply Starters" Button                          │
│    - handleReplyStartersClick() checks auth                     │
│    - Creates accordion container                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Check Cache                                                   │
│    - If cached: render immediately                              │
│    - If not cached: show loading state                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Fetch from Backend (if not cached)                           │
│    - fetchReplyStarters() sends message to background script    │
│    - Background script calls API with Bearer token              │
│    - Response cached in replyStartersCache Map                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Render Accordion                                              │
│    - renderReplyStarters() creates category UI                  │
│    - Adds click handlers for toggle and suggestions             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. User Selects Suggestion                                       │
│    - insertReplyText() opens reply box if needed                │
│    - Inserts text into contenteditable div                      │
│    - Triggers input event for Twitter's state                   │
│    - User manually clicks Reply to send                         │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Checklist

### Prerequisites
- [ ] Extension built: `node build-extensions.js twitter`
- [ ] Extension loaded in Chrome at `chrome://extensions/`
- [ ] SocialMonkey account connected (has `smAccessToken` in storage)
- [ ] Backend API endpoint ready: `POST https://socialmonkey.ai/api/twitter/reply-starters`

### Test Cases

#### 1. Visual Elements
- [ ] Navigate to Twitter/X feed
- [ ] Scroll to find High-Impact tweets (blue badges)
- [ ] Verify purple "💬 Reply Starters" button appears next to each badge
- [ ] Button should have hover effect (darker purple)

#### 2. Authentication Check
- [ ] Disconnect SocialMonkey account (clear `smAccessToken` in `chrome.storage.local`)
- [ ] Click "Reply Starters" button
- [ ] Verify accordion shows "🔒 Connect Required" message
- [ ] Reconnect account

#### 3. Loading State
- [ ] Open DevTools Console (F12)
- [ ] Click "Reply Starters" button on fresh tweet
- [ ] Verify loading state appears: "🐵 Generating reply starters…"
- [ ] Check console for: `[SocialMonkey:Background] Fetching reply starters for tweet: [id]`

#### 4. Accordion Interaction
- [ ] Wait for accordion to load with categories
- [ ] Verify categories appear with labels and descriptions
- [ ] Click a category header → Should expand to show 3 suggestions
- [ ] Click category header again → Should collapse
- [ ] Click toggle icon (▼/▲) → Same expand/collapse behavior

#### 5. Caching
- [ ] Click "Reply Starters" button → Wait for load
- [ ] Click button again to hide accordion
- [ ] Click button third time → Should show instantly (no loading state)
- [ ] Check console: Should NOT see new API call

#### 6. Text Insertion
- [ ] Expand a category and click a suggestion
- [ ] Verify Twitter's reply box opens (if not already open)
- [ ] Verify suggestion text is inserted into reply textarea
- [ ] Verify cursor is at end of text
- [ ] Verify tweet compose button is enabled
- [ ] **DO NOT AUTO-SEND** → User must manually click Reply

#### 7. Selected State
- [ ] Click a suggestion
- [ ] Verify clicked suggestion gets blue background (#eff6ff)
- [ ] Click different suggestion in same category
- [ ] Verify only newest selection is highlighted

#### 8. Toggle Behavior
- [ ] Click "Reply Starters" button to open accordion
- [ ] Click button again → Accordion should hide
- [ ] Click button again → Accordion should show (uses cache)
- [ ] No duplicate accordions should appear

#### 9. Error Handling
- [ ] Simulate backend error (disconnect internet or use invalid token)
- [ ] Click "Reply Starters" button
- [ ] Verify error message displays: "⚠️ Failed to Load Reply Starters"
- [ ] Check console for error log: `[SocialMonkey ReplyStarters]`

#### 10. Multiple Tweets
- [ ] Open multiple Reply Starters accordions on different tweets
- [ ] Verify each maintains independent state
- [ ] Verify clicking one doesn't affect others
- [ ] Check cache contains entries for each tweet ID

### Network Inspection

Open DevTools → Network tab:

1. **Request Verification**:
   - [ ] Method: `POST`
   - [ ] URL: `https://socialmonkey.ai/api/twitter/reply-starters`
   - [ ] Header: `Authorization: Bearer [token]`
   - [ ] Header: `Content-Type: application/json`

2. **Request Body** (example):
   ```json
   {
     "platform": "twitter",
     "tweet": {
       "id": "1234567890",
       "text": "Check out this AI tool...",
       "author_handle": "username",
       "permalink": "https://x.com/username/status/1234567890",
       "metrics": {
         "likes": 150,
         "replies": 12,
         "retweets": 8
       }
     }
   }
   ```

3. **Expected Response**:
   ```json
   {
     "tweet_id": "1234567890",
     "categories": [
       {
         "type": "insightful",
         "label": "💡 Insightful",
         "description": "Share expertise and add value",
         "suggestions": [
           {
             "id": "sugg_1",
             "text": "This reminds me of [related concept]..."
           },
           {
             "id": "sugg_2",
             "text": "Great point! I'd also add..."
           },
           {
             "id": "sugg_3",
             "text": "Have you considered [alternative approach]?"
           }
         ]
       },
       // ... more categories
     ]
   }
   ```

## Console Debugging

Enable debug logs by checking `twitter-config.js`:

```javascript
DEBUG_EVAL: true  // Should be enabled by default
```

Look for these console messages:

- `[SocialMonkey ReplyStarters] Button added for tweet: [id]`
- `[SocialMonkey ReplyStarters] Accordion created, fetching...`
- `[SocialMonkey ReplyStarters] Using cached response`
- `[SocialMonkey:Background] Fetching reply starters for tweet: [id]`
- `[SocialMonkey:Background] Reply starters received: X categories`
- `[SocialMonkey ReplyStarters] Accordion rendered with X categories`
- `[SocialMonkey ReplyStarters] Reply text inserted`

## Known Limitations

1. **Reply Box Detection**: Uses `data-testid="tweetTextarea_0"` which may change if Twitter updates their DOM structure
2. **Modal vs Inline**: Reply box can appear in modal dialog or inline; code handles both cases
3. **Rate Limiting**: No built-in rate limiting; backend should handle this
4. **Cache Persistence**: Cache is in-memory only; cleared on page refresh

## Styling Reference

### Button Styles
- **Background**: `#8b5cf6` (purple)
- **Hover**: `#7c3aed` (darker purple)
- **Text**: White, 12px, 600 weight
- **Padding**: 4px 10px
- **Border radius**: 16px

### Accordion Styles
- **Background**: White
- **Border**: `#e5e7eb`
- **Border radius**: 12px
- **Shadow**: `0 2px 8px rgba(0, 0, 0, 0.1)`
- **Padding**: 16px
- **Max width**: 500px

### Category Styles
- **Label**: 13px, 600 weight
- **Description**: 11px, `#6b7280` gray
- **Hover**: `#f9fafb` background
- **Border**: `#e5e7eb`

### Suggestion Styles
- **Normal**: `#374151` text, `#f3f4f6` background
- **Hover**: `#e5e7eb` background
- **Selected**: `#eff6ff` background (blue tint)
- **Padding**: 10px 12px
- **Font size**: 13px

## Next Steps

1. **Backend Implementation**: Ensure `/api/twitter/reply-starters` endpoint is deployed
2. **Test with Real Data**: Use actual user accounts and tweets
3. **User Feedback**: Gather feedback on suggestion quality and UX
4. **Performance Monitoring**: Track API response times and cache hit rates
5. **A/B Testing**: Test different category labels and suggestion formats

## Troubleshooting

### Button Not Appearing
- **Check**: Is the tweet marked as High-Impact? (Look for blue badge)
- **Check**: Is `addReplyStartersButton()` being called? (Add console.log)
- **Check**: Does engagement row exist? (Inspect DOM)

### Accordion Not Loading
- **Check**: Is user authenticated? (`chrome.storage.local.get(['smAccessToken'])`)
- **Check**: Is backend endpoint reachable? (Network tab)
- **Check**: Console errors? (Look for CORS or fetch errors)

### Text Not Inserting
- **Check**: Is reply box opening? (Look for modal or inline box)
- **Check**: Is `data-testid="tweetTextarea_0"` correct? (Inspect DOM)
- **Check**: Are input events firing? (Add console.log in insertReplyText)

### Cache Not Working
- **Check**: Is tweet ID consistent? (Compare request.data.tweet.id)
- **Check**: Is Map persisting? (Console: `replyStartersCache.size`)

## Files Changed

1. [content_scripts/twitter/twitter-advanced.js](content_scripts/twitter/twitter-advanced.js)
   - Lines 1043-1418: Reply Starters implementation
   - Line 967: Integration call

2. [background.js](background.js)
   - Lines 50-55: Message handler
   - Lines 138-176: API proxy function

3. Build output: `builds/twitter/` (regenerated)

## Contact

If you encounter issues:
- Check console for `[SocialMonkey ReplyStarters]` logs
- Review Network tab for API errors
- Verify backend API contract matches specification
- Backend team: See [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) for OAuth details

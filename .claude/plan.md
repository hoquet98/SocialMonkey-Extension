# Reply Tracking Feature Implementation Plan

## Overview
Implement a system to track which tweets the user has replied to, store up to 500 tweet IDs with timestamps in rolling storage, and visually indicate replied tweets in the feed by filling the reply icon purple.

## User Requirements
1. Track when user clicks Reply (from feed or detail page)
2. Store tweet ID + timestamp in chrome.storage.local
3. Maintain rolling storage of max 500 replies (delete oldest when exceeding limit)
4. Visually mark replied tweets in feed with filled purple reply icon
5. No backend integration needed initially - pure client-side tracking

## Architecture Analysis

### Existing Patterns to Follow
From codebase exploration, I found:

**1. Storage Pattern (twitter-followers.js)**
```javascript
// Key in storage
const SM_FOLLOWERS_KEY = 'smFollowers';

// Get data
chrome.storage.local.get([SM_FOLLOWERS_KEY], (result) => {
  const data = result[SM_FOLLOWERS_KEY] || { followers: [], lastFetch: null };
});

// Save data
chrome.storage.local.set({ [SM_FOLLOWERS_KEY]: data }, () => resolve());
```

**2. Tweet Processing Pattern (twitter-advanced.js)**
- MutationObserver watches feed for new tweets
- `processTweetElement()` called for each tweet
- `extractTweetData()` extracts ID from `a[href*="/status/"]`
- Tweet ID extraction: `tweetLink.href.split('/status/')[1]?.split('?')[0]`

**3. Icon Highlighting Pattern (twitter-advanced.js)**
- `highlightReplyIcon()` adds classes to reply button SVG
- Injects CSS for visual styling
- Uses `.sm-recommend-reply` class for purple highlighting

**4. Event Handling Pattern**
- Passive event listeners: `{ passive: true }`
- Click handlers with `e.preventDefault()` and `e.stopPropagation()`

## Implementation Plan

### Phase 1: Storage Module
Create `twitter-reply-tracker.js` with storage management functions.

**Storage Structure:**
```javascript
{
  smRepliedTweets: [
    { id: "1234567890", timestamp: 1701234567890 },
    { id: "9876543210", timestamp: 1701234567891 },
    // ... up to 500 entries
  ]
}
```

**Functions:**
1. `getStoredReplies()` - Fetch all replied tweet IDs from storage
2. `addRepliedTweet(tweetId)` - Add new reply with timestamp
3. `cleanOldReplies()` - Keep only newest 500 entries
4. `hasReplied(tweetId)` - Check if tweet ID exists in storage

**Implementation Details:**
- Sort by timestamp DESC when cleaning (newest first)
- Slice to keep first 500 entries
- Use Set for fast lookup when checking if replied

### Phase 2: Reply Detection
Detect when user clicks Reply button to capture tweet ID.

**Challenge:** Twitter's reply button doesn't directly submit - it opens compose dialog.

**Solution Approach:**
Monitor for reply dialog opening after click on reply button.

**Detection Strategy:**
1. Add click listener to all `[data-testid="reply"]` buttons
2. When clicked, extract tweet ID from parent tweet element
3. Store the tweet ID immediately (user intent to reply)

**Alternative Strategy (More Conservative):**
1. Watch for dialog with `[data-testid="tweetTextarea_0"]`
2. When dialog appears, extract tweet ID from context
3. Watch for "Post" button click in dialog
4. Only then store the tweet ID

**Recommendation:** Use first strategy (immediate on Reply click) because:
- User clicking Reply shows intent
- Simpler implementation
- Matches user's mental model ("I replied to this")

### Phase 3: Click Handler Integration

**Location:** twitter-reply-tracker.js

**Approach:**
```javascript
function attachReplyClickHandlers() {
  const observer = new MutationObserver(() => {
    // Find all reply buttons not yet tracked
    const replyButtons = document.querySelectorAll('[data-testid="reply"]:not(.sm-reply-tracked)');

    replyButtons.forEach(button => {
      button.classList.add('sm-reply-tracked');

      button.addEventListener('click', async (e) => {
        // Find parent tweet element
        const tweetElement = button.closest('[data-testid="tweet"]');
        if (!tweetElement) return;

        // Extract tweet ID
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        const tweetId = tweetLink?.href.split('/status/')[1]?.split('?')[0];

        if (tweetId) {
          await addRepliedTweet(tweetId);
          // Immediately update UI
          markReplyIconAsFilled(button);
        }
      }, { passive: false }); // Need to be non-passive to potentially prevent default
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
```

**Note:** Use passive: false only if we need preventDefault(). Otherwise passive: true.

### Phase 4: Visual Indicator

**Integration Point:** `processTweetElement()` in twitter-advanced.js

**Approach:**
```javascript
// In processTweetElement() or similar feed processor
async function checkAndMarkRepliedTweets(tweetElement, tweetData) {
  const hasReplied = await window.SM_ReplyTracker.hasReplied(tweetData.id);

  if (hasReplied) {
    const replyButton = tweetElement.querySelector('[data-testid="reply"]');
    if (replyButton) {
      markReplyIconAsFilled(replyButton);
    }
  }
}

function markReplyIconAsFilled(replyButton) {
  const replyIcon = replyButton.querySelector('svg');
  if (!replyIcon) return;

  // Add filled class
  replyIcon.classList.add('sm-replied-filled');

  // Inject CSS if not present
  injectRepliedStyles();
}
```

**CSS Styling:**
```css
.sm-replied-filled {
  fill: rgb(168, 85, 247) !important; /* Purple */
  opacity: 1 !important;
}

.sm-replied-filled path {
  fill: rgb(168, 85, 247) !important;
}
```

### Phase 5: Integration with Existing Code

**Files to Modify:**

1. **twitter-advanced.js** - `processTweetElement()`
   - Add call to check if tweet has been replied to
   - Mark reply icon as filled if yes

2. **manifests/twitter.json**
   - Add twitter-reply-tracker.js to content_scripts list

3. **build-extensions.js**
   - Add twitter-reply-tracker.js to advancedFeatures array

## Data Flow

```
User clicks Reply button on tweet
         ↓
Click handler captures tweet ID
         ↓
Store {id, timestamp} in chrome.storage.local
         ↓
Clean storage (keep newest 500)
         ↓
Immediately update UI (fill icon purple)
         ↓
On page load/scroll, check each tweet
         ↓
If tweet ID in storage → fill icon purple
```

## Edge Cases & Considerations

### 1. Duplicate Clicks
**Issue:** User clicks Reply multiple times on same tweet
**Solution:** Check if ID already exists before adding to storage

### 2. Storage Limit
**Issue:** Chrome storage has 5MB limit for local storage
**Solution:**
- Each entry ≈ 50 bytes (ID + timestamp)
- 500 entries ≈ 25KB
- Well under limit, no concern

### 3. Tweet ID Not Found
**Issue:** Some tweets might not have extractable IDs
**Solution:**
- Skip tracking if ID extraction fails
- Log warning in debug mode

### 4. Performance
**Issue:** Checking 500 IDs for every tweet in feed
**Solution:**
- Use Set for O(1) lookup
- Cache replied IDs in memory
- Refresh cache only on storage changes

### 5. Multiple Tabs/Windows
**Issue:** User replies in one tab, feed in another tab not updated
**Solution:**
- Listen to chrome.storage.onChanged
- Update UI when storage changes in other tabs

### 6. Extension Reload
**Issue:** User reloads extension, loses in-memory cache
**Solution:**
- Storage persists across reloads
- Rebuild cache from storage on init

## Testing Plan

### Manual Testing
1. Click Reply on tweet → verify stored in chrome.storage.local
2. Refresh page → verify icon still filled purple
3. Reply to 500+ tweets → verify oldest deleted
4. Open tweet detail page → click Reply → verify tracked
5. Check multiple tabs → verify sync across tabs

### Storage Verification
```javascript
// In console
chrome.storage.local.get(['smRepliedTweets'], (result) => {
  console.log(result.smRepliedTweets);
  console.log('Total:', result.smRepliedTweets?.length);
});
```

## File Structure

```
content_scripts/twitter/
├── twitter.js                    # Main Twitter integration
├── twitter-advanced.js           # High-Impact tweets (MODIFY)
├── twitter-followers.js          # Follower glow
├── twitter-inspirations.js       # Save inspirations
└── twitter-reply-tracker.js      # NEW - Reply tracking
```

## Implementation Steps

1. Create twitter-reply-tracker.js with storage functions
2. Implement click handlers for Reply buttons
3. Add visual styling for filled purple icons
4. Integrate check in processTweetElement()
5. Update manifest and build script
6. Test all scenarios
7. Document in REPLY_TRACKING.md

## Open Questions

1. **Should we track on Reply click or Post button click?**
   - **Recommendation:** Reply click (simpler, matches intent)
   - Pro: Immediate feedback
   - Con: Might track unrealized replies (user cancels)

2. **Should we sync with backend later?**
   - **Recommendation:** Yes, but not in initial implementation
   - Backend can provide cross-device sync
   - Backend can track actual posted replies via Twitter API

3. **What if user deletes their reply later?**
   - **Recommendation:** Keep tracking it (no way to detect deletion)
   - Future: Backend can verify via Twitter API

4. **Should we show timestamp/tooltip on hover?**
   - **Recommendation:** Not in v1, add later
   - Could show "Replied on Dec 7, 2024"

## Success Criteria

✅ User clicks Reply → tweet ID stored
✅ Storage limited to 500 newest entries
✅ Reply icons filled purple in feed
✅ Works on both feed and detail pages
✅ Persists across page reloads
✅ No performance degradation
✅ No console violations

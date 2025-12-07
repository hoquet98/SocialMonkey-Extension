# Follower Glow v1 - Feature Documentation

## Overview

The Follower Glow feature highlights tweets from your followers with distinctive avatar glows, making it easy to spot and engage with your community at a glance.

## Visual Indicators

### 🔵 Blue Glow - Regular Followers
- Applied to avatars of users who follow you
- Subtle blue shadow around the profile picture
- Indicates established follower relationship

### 🟢 Green Glow - New Followers (within 7 days)
- Applied to avatars of users who followed you recently (within 7 days)
- Vibrant green shadow with subtle pulse animation
- Helps you prioritize engagement with new relationships

## How It Works

### Data Sources

The feature combines two detection methods for maximum accuracy:

1. **Backend Follower Snapshot** (Primary)
   - Fetches up to ~1,000 most recent followers from SocialMonkey backend
   - Includes follower history with "first followed" timestamps
   - Syncs on first load and periodically checks for new followers
   - Requires connected SocialMonkey account (`smAccessToken`)

2. **DOM Detection** (Fallback)
   - Detects "Follows you" label in tweet header in real-time
   - Works even without backend connection (limited mode)
   - Automatically adds detected followers to local cache

### Storage

All follower data is stored locally in `chrome.storage.local` under key `smFollowers`:

```javascript
{
  followers: {
    "handle_or_id": {
      handle: "@username",
      firstSeenAt: "2025-12-04T10:00:00Z",
      source: "backend" | "dom"
    },
    ...
  },
  lastSync: "2025-12-04T10:00:00Z" // Last backend sync time
}
```

## Backend API Endpoints

### Initial Follower Snapshot
```
GET /api/extension/twitter/followers/initial?twitter_username=socialmonkeyai
Authorization: Bearer <smAccessToken>

Response:
{
  "success": true,
  "twitter_user_id": "123456789",
  "followers": [
    {
      "id": "1234567890",
      "handle": "@example",
      "followed_at": "2025-12-01T10:00:00.000Z"
    }
  ],
  "sync_stats": {
    "new_followers": 5,
    "total_processed": 100,
    "pages_processed": 2,
    "partial_error": null
  }
}
```

### New Followers Diff
```
GET /api/extension/twitter/followers/diff?twitter_username=socialmonkeyai
GET /api/extension/twitter/followers/diff?twitter_username=socialmonkeyai&since=2025-12-04T12:00:00.000Z
Authorization: Bearer <smAccessToken>

Response:
{
  "success": true,
  "twitter_user_id": "123456789",
  "new_followers": [
    {
      "id": "555",
      "handle": "@brandnew",
      "followed_at": "2025-12-05T09:11:00.000Z"
    }
  ],
  "sync_stats": {
    "new_followers": 2,
    "total_processed": 50,
    "pages_processed": 1,
    "partial_error": null
  }
}
```

## Implementation Details

### Files

- **`twitter-followers.js`** - Core follower tracking logic
  - Storage management
  - Backend API calls
  - DOM detection
  - Avatar decoration

- **`twitter-advanced.js`** - Integration point
  - Calls follower decoration during tweet processing
  - Initializes follower tracking on page load

- **`manifest.json`** / **`manifests/twitter.json`** - Configuration
  - Loads `twitter-followers.js` before other Twitter scripts
  - Includes host permissions for backend API

### Key Functions

```javascript
// Initialize follower tracking (call once on page load)
await window.SM_FollowerGlow.init();

// Decorate a tweet with follower glow
await window.SM_FollowerGlow.decorateTweet(tweetElement, authorId, authorHandle);

// Manually sync new followers
await window.SM_FollowerGlow.syncNewFollowers();

// Extract author info from tweet
const { authorId, authorHandle } = window.SM_FollowerGlow.extractAuthorInfo(tweetElement);
```

## Configuration

### Adjust "New Follower" Threshold

Edit `twitter-followers.js`:
```javascript
const DAYS_NEW_FOLLOWER = 7; // Change this to adjust "new follower" window
```

### Custom Glow Colors

Edit the injected CSS in `twitter-followers.js`:
```javascript
.sm-follower-glow {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.9), 0 0 10px rgba(59, 130, 246, 0.7);
}

.sm-new-follower-glow {
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.95), 0 0 12px rgba(16, 185, 129, 0.8);
}
```

## Limitations & Future Enhancements

### Current Limitations (v1)
- **No unfollow tracking** - We don't remove followers who unfollow you
- **1,000 follower cap** - Backend only tracks ~1,000 most recent followers
- **No follower metrics** - No engagement history or relationship scoring yet

### Future Enhancements (v2+)
- **Relationship Builder** - Track engagement history per follower
- **Unfollow detection** - Remove users who unfollow
- **Priority scoring** - Score followers by engagement value
- **Follower segments** - Group followers by niche, location, etc.
- **Engagement insights** - "You last replied to @user 3 days ago"

## Debugging

All logs are prefixed with `[SM Followers]`:

```javascript
console.log('[SM Followers] Initializing Follower Glow v1');
console.log('[SM Followers] ✅ Initial sync complete. Total followers:', count);
console.log('[SM Followers] 🎉 Found X new followers!');
console.log('[SM Followers] 🌟 Applied NEW follower glow to:', handle);
```

To debug:
1. Open DevTools Console on Twitter/X
2. Look for `[SM Followers]` logs
3. Check `chrome.storage.local` for `smFollowers` key

## Testing

### Test Follower Detection
1. Open Twitter/X feed
2. Look for tweets with "Follows you" label
3. Verify avatar has blue glow
4. Check console for `[SM Followers] DOM detected new follower:` log

### Test Backend Sync
1. Connect SocialMonkey account (have `smAccessToken`)
2. Reload Twitter/X
3. Check console for:
   - `[SM Followers] Fetching initial follower snapshot...`
   - `[SM Followers] ✅ Initial sync complete. Total followers: X`
4. Verify glows appear on follower tweets

### Test New Follower Glow
1. Manually set a follower's `firstSeenAt` to recent date in `chrome.storage.local`
2. Reload page
3. Verify that follower has green glow instead of blue

## Performance

- **Initialization**: ~500-1000ms (one-time backend fetch)
- **Per-tweet processing**: ~1-5ms (local storage lookup + DOM check)
- **Storage size**: ~50-100KB for 1,000 followers
- **Network**: 2 API calls total (initial + diff sync), cached locally

## Privacy & Security

- All follower data stored locally in browser
- No follower data sent to third parties
- Backend API requires authentication (`smAccessToken`)
- DOM detection works offline (no backend needed)

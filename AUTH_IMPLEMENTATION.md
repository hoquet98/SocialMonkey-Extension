# SocialMonkey Extension - Authentication Implementation

## Overview

The SocialMonkey Chrome extension now supports two modes:

1. **Limited Mode** (No authentication) - Local features like High-Impact detection work
2. **Full Mode** (Connected) - All AI and backend features are unlocked

## Implementation Details

### 1. Access Token Storage

**Key**: `smAccessToken` (stored in `chrome.storage.local`)

This token is obtained from the SocialMonkey backend via the OAuth flow at:
```
https://socialmonkey.ai/extension/connect?platform=twitter&state=<random>
```

After user authentication, the backend redirects to:
```
https://socialmonkey.ai/extension/connected?code=<code>&state=<state>
```

### 2. Popup States

#### State A: Not Connected (`#notConnectedView`)

**Shown when**: No `smAccessToken` exists

**Features**:
- Welcome header with SocialMonkey branding
- Description of AI features available when connected
- Note about limited mode availability
- **Primary button**: "Connect SocialMonkey Account"
  - Generates random `state` parameter
  - Saves to `smAuthState` in chrome.storage.local
  - Opens OAuth flow in new tab
- **Secondary button**: "Continue in Limited Mode"
  - Closes popup
  - Extension continues to work with local features only
- **Info text**: Explains limited mode works without account

#### State B: Connected (`#connectedView`)

**Shown when**: `smAccessToken` exists

**Features**:
- **Status strip** at top showing:
  - Green pulsing indicator
  - "Connected to SocialMonkey"
  - Platform info: "Platform: Twitter · AI features enabled"
  - "Manage account" link → opens https://socialmonkey.ai/dashboard
  - "Disconnect" link → removes token and returns to State A
- **Full dashboard** with platform cards
- All existing popup functionality

### 3. OAuth Flow

#### Step 1: User clicks "Connect" in popup

```javascript
// popup.js
connectButton.addEventListener('click', function() {
  const state = crypto.randomUUID();
  chrome.storage.local.set({ smAuthState: state }, function() {
    const connectUrl = `https://socialmonkey.ai/extension/connect?platform=twitter&state=${state}`;
    chrome.tabs.create({ url: connectUrl });
  });
});
```

#### Step 2: User authenticates on SocialMonkey

User logs in and authorizes the extension. Backend redirects to:
```
https://socialmonkey.ai/extension/connected?code=ABC123&state=XYZ789
```

#### Step 3: Background script exchanges code for token

```javascript
// background.js
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Detect callback URL
  if (url.pathname === '/extension/connected') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    // Verify state
    chrome.storage.local.get(['smAuthState'], ({ smAuthState }) => {
      if (smAuthState !== state) return; // CSRF protection

      // Exchange code for token
      fetch('https://socialmonkey.ai/api/extension/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, platform: 'twitter' }),
      })
        .then(res => res.json())
        .then(data => {
          // Store access token
          chrome.storage.local.set({ smAccessToken: data.accessToken });

          // Close OAuth tab
          chrome.tabs.remove(tabId);

          // Show success notification
          chrome.notifications.create({
            title: 'SocialMonkey Connected',
            message: 'Your account has been connected successfully!'
          });
        });
    });
  }
});
```

#### Step 4: Popup auto-updates

The popup listens for storage changes and automatically switches to the connected view:

```javascript
// popup.js
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'local' && changes.smAccessToken) {
    if (changes.smAccessToken.newValue) {
      showConnectedView();
    } else {
      showNotConnectedView();
    }
  }
});
```

### 4. Feature Gating

#### Helper Utility: `shared/auth-utils.js`

Functions available for content scripts:

```javascript
// Check if user is authenticated
const isAuth = await isAuthenticated();

// Get access token
const token = await getAccessToken();

// Make authenticated API request
const data = await apiRequest('/niche/score', {
  tweetId: '123',
  content: 'Tweet text...'
});

// Check if feature is available
const canUse = await isFeatureAvailable('niche-scoring');

// Show auth required notification
if (!canUse) {
  showAuthRequiredNotification('Niche Scoring');
}
```

#### Example Usage in Content Script

```javascript
// content_scripts/twitter/twitter-advanced.js

// Feature #1: High-Impact - works in limited mode (no auth required)
function detectHighImpactTweets() {
  // This runs without authentication
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  tweets.forEach(tweet => {
    const score = calculateLocalScore(tweet);
    if (score >= 70) {
      markTweetAsHighImpact(tweet);
    }
  });
}

// Feature #2: Niche Relevance - requires authentication
async function addNicheRelevanceScoring() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    console.log('[SocialMonkey] Niche scoring skipped - not authenticated');
    return;
  }

  const tweets = document.querySelectorAll('[data-testid="tweet"]');

  for (const tweet of tweets) {
    const tweetData = extractTweetData(tweet);

    // Call backend API with authentication
    const result = await apiRequest('/niche/score', {
      tweetId: tweetData.id,
      content: tweetData.text,
      author: tweetData.author
    });

    if (result && result.nicheScore) {
      // Add niche score badge
      addNicheScoreBadge(tweet, result.nicheScore);
    }
  }
}
```

#### Backend API Helper

The `sendToBackend` function in background.js now automatically includes the auth token:

```javascript
// background.js
async function sendToBackend(endpoint, data) {
  const { smAccessToken } = await chrome.storage.local.get(['smAccessToken']);

  if (!smAccessToken) {
    console.warn('[SocialMonkey] No access token - feature requires authentication');
    return { error: 'Not authenticated' };
  }

  const response = await fetch(`https://socialmonkey.ai/api${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${smAccessToken}`
    },
    body: JSON.stringify(data)
  });

  return await response.json();
}
```

### 5. Disconnect Flow

When user clicks "Disconnect":

```javascript
// popup.js
disconnectLink.addEventListener('click', function(e) {
  e.preventDefault();

  if (confirm('Are you sure you want to disconnect?')) {
    // Remove tokens
    chrome.storage.local.remove(['smAccessToken', 'smAuthState'], function() {
      // Return to not connected view
      showNotConnectedView();
    });
  }
});
```

## Security Considerations

1. **CSRF Protection**: Uses `state` parameter to prevent CSRF attacks
2. **Token Storage**: Access token stored in `chrome.storage.local` (not exposed to web pages)
3. **State Verification**: Background script verifies state matches before exchanging code
4. **HTTPS Only**: All API calls use HTTPS
5. **Token Scope**: Token only has access to user's SocialMonkey account data

## Feature Categories

### Limited Mode (No Auth Required)
- ✅ High-Impact tweet detection (local scoring)
- ✅ Engagement tracking (local)
- ✅ Basic UI enhancements

### Full Mode (Auth Required)
- ✅ Niche relevance scoring (AI/backend)
- ✅ Reply starters (AI)
- ✅ Who to follow suggestions (AI)
- ✅ AI content generation
- ✅ Sentiment analysis
- ✅ Scheduled posting (backend)

## Testing

### Test Limited Mode
1. Open extension popup
2. Click "Continue in Limited Mode"
3. Verify High-Impact badges still appear on Twitter
4. Verify no backend API calls are made

### Test Connect Flow
1. Open extension popup
2. Click "Connect SocialMonkey Account"
3. Verify new tab opens to socialmonkey.ai
4. Log in and authorize extension
5. Verify redirect to `/extension/connected`
6. Verify background script exchanges code
7. Verify token is stored in chrome.storage.local
8. Verify OAuth tab is closed
9. Verify success notification appears
10. Reopen popup - verify connected state

### Test Disconnect Flow
1. Open popup (while connected)
2. Click "Disconnect"
3. Confirm dialog
4. Verify token is removed
5. Verify popup returns to not connected state

## Files Modified

- ✅ `popup.html` - Added two views (notConnectedView, connectedView)
- ✅ `popup.js` - Added auth state management and OAuth flow
- ✅ `popup.css` - Added styles for welcome screen and status strip
- ✅ `background.js` - Added OAuth callback handler and token exchange
- ✅ `shared/auth-utils.js` - New helper utilities for feature gating

## Next Steps

1. Wire up backend features (niche scoring, reply starters, etc.) to use `apiRequest` helper
2. Add loading states in popup during OAuth flow
3. Add error handling for failed OAuth or API requests
4. Consider adding user profile info display in connected view
5. Add analytics tracking for auth events

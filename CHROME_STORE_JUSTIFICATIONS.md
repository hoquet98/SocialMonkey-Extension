# Chrome Web Store Permission Justifications

## Permission Justifications for SocialMonkey Extension

### 1. **Storage** (`storage`)
**Justification:**
The extension uses `chrome.storage.local` and `chrome.storage.sync` to store essential user data locally:
- **Authentication tokens** (`smAccessToken`) for API communication with SocialMonkey backend
- **User preferences** (theme settings, dark/light mode)
- **Replied tweets tracking** (up to 500 tweet IDs) to mark which tweets the user has replied to
- **Follower data** (`smFollowers`) to identify and highlight recent followers with visual glows
- **Saved inspirations** - tweets the user wants to save for later reference

All data is stored locally on the user's device for privacy and performance. No data is accessible to other extensions or websites.

**Code locations:**
- `popup.js` lines 67, 118, 186, 234, 249
- `content_scripts/twitter/twitter-followers.js` lines 20-40
- `content_scripts/twitter/twitter-inspirations.js` lines 40-50
- `content_scripts/twitter/twitter-reply-tracker.js` lines 46-85
- `background.js` lines 370, 475

---

### 2. **Tabs** (`tabs`)
**Justification:**
The extension uses `chrome.tabs` API to:
- **Open SocialMonkey dashboard** when user clicks "Open Dashboard" button in popup
- **OAuth authentication flow** - opens SocialMonkey.ai login page in new tab and monitors for callback
- **Auto-close OAuth tabs** after successful authentication to improve user experience

The extension does NOT read browsing history or track user's tabs. It only creates tabs for authentication and dashboard access.

**Code locations:**
- `popup.js` lines 144, 207, 263 (opens dashboard/auth URLs)
- `background.js` lines 60, 429, 600 (OAuth flow)

---

### 3. **ActiveTab** (`activeTab`)
**Justification:**
The extension uses `activeTab` permission to:
- **Inject content scripts** on Twitter/X pages only when user is actively viewing them
- **Access page DOM** to detect tweets, follower information, and reply dialogs on Twitter/X
- **Add visual indicators** (High-Impact badges, reply starters, follower glows, lightbulb icons) to tweets

This permission is used ONLY when the user is on Twitter/X (twitter.com or x.com). The extension does not access any other websites' content without explicit host permissions listed below.

**Code locations:**
- Content scripts defined in `manifest.json` run only on twitter.com and x.com
- All content script files in `content_scripts/twitter/` directory

---

### 4. **Notifications** (`notifications`)
**Justification:**
The extension uses `chrome.notifications` API to:
- **Notify authentication status** after OAuth login completes ("SocialMonkey Connected")
- **Alert connection errors** if OAuth authentication fails

Notifications enhance user experience by providing immediate feedback for authentication without requiring users to check the extension popup.

**Code locations:**
- `background.js` line 604 (authentication success notification)
- `background.js` line 626 (connection error notification)

---

### 5. **Host Permissions**
**Justification for each host:**

#### `https://twitter.com/*` and `https://x.com/*`
- **Required for core functionality** - Extension adds AI-powered features directly to Twitter/X interface
- **Features enabled:** High-Impact tweet detection, AI reply starters, follower glow highlights, tweet inspiration saving, reply tracking
- **DOM access needed** to identify tweets, user profiles, reply dialogs, and engagement buttons

#### `https://socialmonkey.ai/*`
- **Backend API communication** - Extension connects to SocialMonkey backend for AI features
- **OAuth authentication** - Users log in via SocialMonkey.ai to unlock personalized AI scoring
- **API endpoints used:**
  - `/api/extension/twitter/evaluate-posts` (AI tweet scoring)
  - `/api/extension/twitter/reply-starters` (AI reply suggestions)
  - `/api/extension/exchange-code` (OAuth token exchange)
  - `/extension/connected` (OAuth callback)

**Code locations:**
- `config.js` line 3 (API_BASE_URL configuration)
- `background.js` lines 136-193 (API proxy functions for tweet evaluation and reply starters)
- `background.js` lines 429-667 (OAuth callback handler)
- Content scripts in `content_scripts/twitter/` (DOM access on Twitter/X)

---

### 6. **Remote Code**
**Statement:**
This extension does **NOT execute remote code**. All JavaScript code is bundled within the extension package at submission time.

**What we DO:**
- ✅ Make API calls to SocialMonkey backend to fetch **data only** (AI scores, reply suggestions)
- ✅ All code execution happens in locally bundled files shipped with the extension

**What we DON'T DO:**
- ❌ No `eval()` of remote code
- ❌ No dynamic script loading from external URLs
- ❌ No execution of code received from API responses

All logic and UI rendering is contained in the extension's static JavaScript files included in this submission package.

---

## Summary
All permissions are essential for the extension's advertised core features:
1. **AI-powered tweet analysis** requires backend API communication (host permissions)
2. **User authentication** requires OAuth flow (tabs, storage, notifications)
3. **Reply tracking and follower detection** require local storage and DOM access (storage, activeTab, host permissions)

The extension follows Chrome's principle of least privilege - we only request permissions that are strictly necessary for functionality.

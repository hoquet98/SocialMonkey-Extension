# SocialMonkey Extension Architecture

## Overview

Yes, exactly as you described! Each extension embeds its own scripts directly into social media pages, giving you full access to read, modify, and automate actions on those platforms.

## How It Works

### 1. Content Scripts = Your Code Running ON Social Media Pages

```
┌──────────────────────────────────────────────┐
│  Twitter.com (The Actual Website)            │
│  ┌────────────────────────────────────────┐  │
│  │  Your Content Script (Injected)        │  │
│  │  ✅ Full access to page DOM            │  │
│  │  ✅ Can read everything on page        │  │
│  │  ✅ Can modify anything on page        │  │
│  │  ✅ Can click buttons                  │  │
│  │  ✅ Can fill forms                     │  │
│  │  ✅ Can extract data                   │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

When a user visits Twitter.com, your content script **automatically injects** and runs alongside Twitter's code. It's like having your own JavaScript running on their page.

### 2. What Each Extension Does

#### When User Visits Twitter/X:
```javascript
// Your twitter.js content script automatically runs:

1. Detects Twitter is loaded
2. Finds tweet composer: document.querySelector('[data-testid="tweetTextarea_0"]')
3. Adds your "Schedule" button next to Twitter's "Tweet" button
4. Monitors the page for changes (new tweets, engagement updates)
5. Can auto-fill tweets, upload images, click post, etc.
```

#### When User Visits Facebook:
```javascript
// Your facebook.js content script automatically runs:

1. Detects Facebook is loaded
2. Finds post composer: document.querySelector('[role="textbox"]')
3. Adds your schedule button
4. Can read posts, engagement, comments
5. Can auto-post, auto-like, auto-comment
```

**Same pattern for all 8 platforms!**

## File Structure & What Each File Does

```
Extension Root/
│
├── manifest.json
│   └── Tells Chrome:
│       - Which websites to inject into
│       - Which scripts to inject
│       - What permissions needed
│
├── background.js (Service Worker)
│   └── Runs persistently in background
│       - Coordinates all tabs
│       - Handles scheduled posts
│       - Manages storage
│       - Talks to your backend API
│
├── popup.html/js/css
│   └── The UI when user clicks extension icon
│       - Shows all platforms
│       - Settings
│       - Quick actions
│
└── content_scripts/
    ├── shared/utils.js
    │   └── Common functions all platforms use
    │       - createButton()
    │       - showNotification()
    │       - storage helpers
    │
    ├── twitter/twitter.js
    │   └── INJECTS into twitter.com pages
    │       - Adds schedule buttons
    │       - Extracts tweets
    │       - Auto-likes
    │       - Auto-replies
    │
    ├── facebook/facebook.js
    │   └── INJECTS into facebook.com pages
    │
    ├── instagram/instagram.js
    │   └── INJECTS into instagram.com pages
    │
    └── [... all other platforms ...]
```

## Data Flow Example: Scheduling a Tweet

```
1. USER: Clicks "Schedule" button on Twitter.com
   ↓
2. CONTENT SCRIPT (twitter.js):
   - Captures tweet text from composer
   - Shows date/time picker
   ↓
3. SENDS MESSAGE to Background Script:
   chrome.runtime.sendMessage({
     action: 'schedulePost',
     data: {
       platform: 'twitter',
       content: 'My tweet',
       time: '2024-01-15 2pm'
     }
   })
   ↓
4. BACKGROUND SCRIPT (background.js):
   - Saves to chrome.storage
   - Sets alarm for scheduled time
   - Sends to your backend API
   ↓
5. AT SCHEDULED TIME:
   - Alarm triggers
   - Opens Twitter.com in new tab
   - Sends message to content script: "fill this tweet"
   ↓
6. CONTENT SCRIPT:
   - Fills tweet composer
   - Clicks "Tweet" button
   - Done! ✅
```

## Permission Model

### What Extensions Can Access:

| Permission | What It Allows |
|------------|----------------|
| `host_permissions: twitter.com` | Full access to Twitter pages |
| `storage` | Save data locally & sync across devices |
| `tabs` | Open/close tabs, get URLs |
| `activeTab` | Access currently active tab |
| `alarms` | Schedule future actions |
| `notifications` | Show desktop notifications |
| `contextMenus` | Add right-click menu items |

### What Extensions CANNOT Do:
- ❌ Access pages without permission
- ❌ Run without user installing
- ❌ Access other extensions
- ❌ Access local files (without explicit permission)

## Manifest.json Breakdown

```json
{
  "content_scripts": [
    {
      // When to inject:
      "matches": ["https://twitter.com/*"],

      // What to inject:
      "js": [
        "content_scripts/shared/utils.js",  // Load first
        "content_scripts/twitter/twitter.js" // Then platform-specific
      ],

      // When to inject:
      "run_at": "document_end" // After DOM loads, before images
    }
  ]
}
```

This tells Chrome:
- **When**: User visits twitter.com
- **What**: Inject these JavaScript files
- **How**: Run them after page loads

## Multi-Extension Strategy

### Master Extension (All-in-One)
```json
{
  "name": "SocialMonkey - All Platforms",
  "host_permissions": [
    "https://twitter.com/*",
    "https://facebook.com/*",
    "https://instagram.com/*",
    // ... all 8 platforms
  ],
  "content_scripts": [
    { "matches": ["twitter.com"], "js": ["twitter.js"] },
    { "matches": ["facebook.com"], "js": ["facebook.js"] },
    // ... all 8 platforms
  ]
}
```
**Size**: ~500KB (all platforms)
**Permissions**: Access to all 8 platforms

### Individual Extensions (Platform-Specific)
```json
{
  "name": "SocialMonkey for Twitter",
  "host_permissions": [
    "https://twitter.com/*"  // ONLY Twitter
  ],
  "content_scripts": [
    { "matches": ["twitter.com"], "js": ["twitter.js"] }  // ONLY Twitter
  ]
}
```
**Size**: ~100KB (just one platform)
**Permissions**: Only Twitter access

## Publishing Strategy

### Chrome Web Store Listings

| Extension Name | File Size | Permissions | Target Users |
|----------------|-----------|-------------|--------------|
| SocialMonkey - All Platforms | ~500KB | All 8 platforms | Power users, agencies |
| SocialMonkey for Twitter | ~100KB | Twitter only | Twitter-focused users |
| SocialMonkey for Facebook | ~100KB | Facebook only | Facebook-focused users |
| SocialMonkey for Instagram | ~100KB | Instagram only | Instagram influencers |
| ... (8 more) | ... | ... | ... |

### Benefits:

**SEO/Discovery**:
- "Twitter scheduler" → finds your Twitter extension
- "Instagram automation" → finds your Instagram extension
- "Social media all-in-one" → finds master extension

**Trust**:
- Users see smaller permission requests
- Twitter extension only asks for Twitter access
- More likely to install

**Performance**:
- Lighter extensions load faster
- Less memory usage
- Better user experience

## Development Workflow

### 1. Develop
```bash
# Edit content scripts
code content_scripts/twitter/twitter.js

# Test in Chrome
chrome://extensions → Load unpacked
```

### 2. Build Individual Extensions
```bash
node build-extensions.js

# Creates:
# builds/twitter/     (Twitter-only extension)
# builds/facebook/    (Facebook-only extension)
# ... etc
```

### 3. Package
```bash
# Zip each folder
cd builds/twitter
zip -r twitter-extension.zip .

# Upload to Chrome Web Store
```

### 4. Publish
- Upload to Chrome Web Store Developer Console
- Fill in details (name, description, screenshots)
- Submit for review
- Publish!

## Communication Between Components

### Content Script → Background
```javascript
// In twitter.js
chrome.runtime.sendMessage({
  action: 'schedulePost',
  data: { ... }
});
```

### Background → Content Script
```javascript
// In background.js
chrome.tabs.sendMessage(tabId, {
  action: 'fillPost',
  content: 'Tweet text'
});
```

### Background → Your API
```javascript
// In background.js
fetch('https://api.socialmonkey.com/schedule', {
  method: 'POST',
  body: JSON.stringify(postData)
});
```

### Content Script → Your API (Direct)
```javascript
// In twitter.js
fetch('https://api.socialmonkey.com/analytics', {
  method: 'POST',
  body: JSON.stringify(engagement)
});
```

## Security Considerations

### ✅ Best Practices
- Never store passwords in extension
- Use HTTPS for all API calls
- Validate all user input
- Rate limit automated actions
- Ask for minimal permissions
- Clear sensitive data on logout

### ⚠️ Avoid
- Don't spam actions (auto-follow 100 people/sec)
- Don't scrape excessively
- Don't violate platform terms of service
- Don't collect data without consent
- Don't inject malicious code

## Platform-Specific Notes

### Twitter/X
- Use `data-testid` attributes to find elements
- Composer: `[data-testid="tweetTextarea_0"]`
- Tweet button: `[data-testid="tweetButtonInline"]`
- Tweets: `[data-testid="tweet"]`

### Facebook
- Uses dynamic class names
- Use `role` attributes: `[role="textbox"]`
- Structure changes frequently
- Need robust selectors

### Instagram
- Heavy use of React
- Elements load dynamically
- Need MutationObserver
- Limited web features (mostly mobile)

### LinkedIn
- Professional network
- Use `.share-box` classes
- Post composer: `.share-creation-state__text-editor`

## Next Steps

1. ✅ **Test Master Extension**
   - Load in Chrome
   - Visit Twitter/Facebook
   - See features appear

2. ✅ **Build Individual Extensions**
   - Run `node build-extensions.js`
   - Test each platform extension

3. ✅ **Connect to Backend**
   - Add your API endpoints to background.js
   - Test scheduling, analytics

4. ✅ **Add Icons**
   - Create 16x16, 48x48, 128x128 icons
   - Platform-specific icons for each extension

5. ✅ **Publish**
   - Package each extension
   - Submit to Chrome Web Store
   - Launch!

---

## Questions?

**Q: Can the extension see everything on the social media page?**
**A**: Yes! Full DOM access. It's like you wrote JavaScript that runs on their page.

**Q: Can it click buttons automatically?**
**A**: Yes! `document.querySelector('button').click()`

**Q: Can it read private messages?**
**A**: Yes, if they're visible in the DOM and user is logged in.

**Q: Can it post automatically?**
**A**: Yes! Fill text, upload images, click post button.

**Q: Does each extension work independently?**
**A**: Yes! Each platform extension is standalone.

**Q: Can they communicate with each other?**
**A**: Yes, through the background script or your backend API.

You now have a complete understanding of how your Chrome extensions work! 🚀

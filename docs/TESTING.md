# Testing Your SocialMonkey Extension

## Quick Start Testing

### 1. Load the Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top right)
3. Click **"Load unpacked"**
4. Select the `SocialMonkey_Extension` folder
5. You should see "SocialMonkey - All Platforms" appear

### 2. Test on Twitter/X

1. Go to [https://twitter.com](https://twitter.com) or [https://x.com](https://x.com)
2. You should see:
   - A notification "SocialMonkey is ready on Twitter!"
   - A floating panel in bottom-right with SocialMonkey actions
   - A schedule button next to the Tweet button when you try to compose a tweet

### 3. Open Developer Console

Press `F12` or `Ctrl+Shift+I` to open DevTools:

```
Console output should show:
✅ SocialMonkey Background Service Worker Started
✅ SocialMonkey - Twitter extension loaded
✅ [SocialMonkey - Twitter] Initializing Twitter integration
```

### 4. Test Content Script Features

#### Test 1: Extract Tweet Data
```javascript
// In DevTools Console, run:
SocialMonkeyTwitter.extractTweetContent()

// You'll see all tweets on the page with:
// - Author names
// - Tweet text
// - Engagement metrics
// - Hashtags
// - Media URLs
```

#### Test 2: Auto-Fill Tweet
```javascript
// Click "What's happening?" to open tweet composer
// Then in console:
SocialMonkeyTwitter.fillTweetComposer("Testing SocialMonkey! 🐵")

// The text should appear in the composer!
```

#### Test 3: Get Current Draft
```javascript
// Type something in the tweet composer
// Then run:
SocialMonkeyTwitter.getCurrentDraft()

// You'll see your draft content
```

#### Test 4: Schedule a Tweet
```javascript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

SocialMonkeyTwitter.scheduleTweet(
  "This is a scheduled tweet!",
  tomorrow.toISOString()
);

// You should see a notification confirming the schedule
```

### 5. Test Background Communication

#### Check Storage
```javascript
// In DevTools Console:
chrome.storage.local.get(null, (data) => {
  console.log('All stored data:', data);
});

// You'll see:
// - Scheduled posts
// - Saved drafts
// - Engagement metrics
```

#### Send Message to Background
```javascript
chrome.runtime.sendMessage(
  { action: 'getPostSchedules', platform: 'twitter' },
  (response) => {
    console.log('Scheduled posts:', response.schedules);
  }
);
```

### 6. Test Right-Click Context Menu

1. Select any text on Twitter
2. Right-click
3. You should see:
   - "Schedule with SocialMonkey"
   - "Analyze with SocialMonkey AI"

Click either option to test!

### 7. Test on Other Platforms

#### Facebook
- Go to [https://www.facebook.com](https://www.facebook.com)
- Look for SocialMonkey panel in bottom-right
- Try composing a post - schedule button should appear

#### Instagram
- Go to [https://www.instagram.com](https://www.instagram.com)
- Look for "Schedule with SocialMonkey" button
- Should see tips when creating a post

#### LinkedIn
- Go to [https://www.linkedin.com](https://www.linkedin.com)
- Schedule button should appear in post composer
- Professional tips panel in bottom-right

## Testing Individual Platform Extensions

### Build Individual Extensions
```bash
node build-extensions.js
```

### Load Individual Extension
1. Go to `chrome://extensions/`
2. Click "Load unpacked"
3. Select `builds/twitter/` folder
4. Now only Twitter features will be active
5. Extension only requests Twitter permissions

## Common Issues & Solutions

### Issue: "Extension didn't load"
**Solution**:
- Check DevTools console for errors
- Make sure all file paths in manifest.json are correct
- Verify icons folder exists

### Issue: "Content script not injecting"
**Solution**:
- Reload the extension
- Hard refresh the social media page (Ctrl+Shift+R)
- Check host_permissions in manifest.json

### Issue: "Background script not working"
**Solution**:
- Go to `chrome://extensions/`
- Click "Inspect views: service worker" under your extension
- Check console for errors

### Issue: "Storage not persisting"
**Solution**:
- Make sure storage permission is granted
- Use chrome.storage.sync for sync across devices
- Use chrome.storage.local for device-specific data

## Debugging Tips

### 1. Content Script Debugging
```javascript
// Add to any content script:
console.log('Content script loaded on:', window.location.href);

// Log all DOM queries:
const element = document.querySelector('[data-testid="tweet"]');
console.log('Found element:', element);
```

### 2. Background Script Debugging
```javascript
// In background.js:
console.log('Background event triggered:', eventName);

// Log all messages:
chrome.runtime.onMessage.addListener((msg) => {
  console.log('Message received:', msg);
});
```

### 3. Storage Debugging
```javascript
// Watch storage changes:
chrome.storage.onChanged.addListener((changes, area) => {
  console.log('Storage changed:', changes, 'in', area);
});
```

### 4. Network Debugging
```javascript
// Log API calls:
fetch(url)
  .then(res => {
    console.log('API Response:', res);
    return res.json();
  })
  .catch(err => console.error('API Error:', err));
```

## Performance Testing

### Check Extension Impact
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Inspect views: service worker"
4. Go to Performance tab
5. Record and analyze

### Memory Usage
```javascript
// In background.js:
setInterval(() => {
  if (performance.memory) {
    console.log('Memory usage:', {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
      total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB'
    });
  }
}, 10000); // Every 10 seconds
```

## Testing Automation Features

### Test Auto-Like (Use with caution!)
```javascript
// Auto-like tweets with "AI" keyword
SocialMonkeyTwitter.autoLikeTweetsWithKeywords(['AI']);

// Watch console for likes being triggered
```

### Test Auto-Save Drafts
1. Start typing a tweet
2. Wait 30 seconds
3. Check storage:
```javascript
chrome.storage.local.get(['drafts'], (data) => {
  console.log('Saved drafts:', data.drafts);
});
```

## User Acceptance Testing

### Checklist for Each Platform

- [ ] Extension loads without errors
- [ ] Notification appears on page load
- [ ] Custom UI elements appear
- [ ] Buttons are clickable and functional
- [ ] Schedule feature works
- [ ] Data is captured correctly
- [ ] Storage persists across sessions
- [ ] Extension doesn't break platform functionality
- [ ] Performance is acceptable
- [ ] No console errors

## Before Publishing

### Final Checks
- [ ] All icons are present (16x16, 48x48, 128x128)
- [ ] Manifest version and description are correct
- [ ] All permissions are necessary and documented
- [ ] Privacy policy is written
- [ ] Terms of service are clear
- [ ] Screenshots are prepared
- [ ] Demo video is recorded
- [ ] Code is minified (optional)
- [ ] Testing on multiple Chrome versions
- [ ] Testing on Windows, Mac, Linux

### Package for Chrome Web Store
1. Remove any test/debug code
2. Update version in manifest.json
3. Zip the extension folder
4. Upload to Chrome Web Store Developer Dashboard

## Need Help?

- Check [CAPABILITIES.md](CAPABILITIES.md) for what's possible
- Read [README.md](README.md) for architecture overview
- Look at content scripts for platform-specific examples
- Check background.js for cross-platform coordination

Happy testing! 🚀

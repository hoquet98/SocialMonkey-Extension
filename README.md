# SocialMonkey Chrome Extensions

Schedule and automate posts across all your social media platforms with AI-powered content generation.

## Architecture Overview

This repository contains **9 Chrome extensions**:

1. **Master Extension** - All 8 platforms in one extension
2. **8 Individual Platform Extensions** - One for each social media platform

### Supported Platforms

- **Twitter/X** - Tweet scheduling, automation, X.com monitoring & replies
- **Facebook** - Facebook posting, multi-page support
- **Instagram** - Instagram posting, AI image generation
- **TikTok** - TikTok posting, video optimization
- **LinkedIn** - LinkedIn posting, professional content
- **YouTube** - YouTube scheduling, video scheduling
- **Reddit** - Reddit posting, subreddit targeting
- **Snapchat** - Snapchat automation, story scheduling

## Project Structure

```
SocialMonkey_Extension/
├── manifest.json                    # Master extension (all platforms)
├── popup.html                       # Extension popup UI
├── popup.css                        # Popup styling (light/dark theme)
├── popup.js                         # Popup functionality
├── icons/                           # Extension icons
├── content_scripts/
│   ├── shared/
│   │   └── utils.js                 # Shared utilities for all platforms
│   ├── twitter/
│   │   └── twitter.js               # Twitter-specific content script
│   ├── facebook/
│   │   └── facebook.js              # Facebook-specific content script
│   ├── instagram/
│   │   └── instagram.js             # Instagram-specific content script
│   ├── tiktok/
│   │   └── tiktok.js                # TikTok-specific content script
│   ├── linkedin/
│   │   └── linkedin.js              # LinkedIn-specific content script
│   ├── youtube/
│   │   └── youtube.js               # YouTube-specific content script
│   ├── reddit/
│   │   └── reddit.js                # Reddit-specific content script
│   └── snapchat/
│       └── snapchat.js              # Snapchat-specific content script
└── builds/
    ├── twitter/
    │   └── manifest.json            # Twitter-only extension manifest
    ├── facebook/
    │   └── manifest.json            # Facebook-only extension manifest
    ├── instagram/
    │   └── manifest.json            # Instagram-only extension manifest
    ├── tiktok/
    │   └── manifest.json            # TikTok-only extension manifest
    ├── linkedin/
    │   └── manifest.json            # LinkedIn-only extension manifest
    ├── youtube/
    │   └── manifest.json            # YouTube-only extension manifest
    ├── reddit/
    │   └── manifest.json            # Reddit-only extension manifest
    └── snapchat/
        └── manifest.json            # Snapchat-only extension manifest
```

## Development

### Testing the Master Extension (All Platforms)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `SocialMonkey_Extension` folder
5. The extension will work on all 8 platforms

### Building Individual Platform Extensions

Run the build script to create packaged versions of each platform extension:

```bash
node build-extensions.js
```

This will copy all necessary files to each platform's build directory in `builds/<platform>/`.

### Testing Individual Extensions

1. Navigate to `chrome://extensions/`
2. Click "Load unpacked"
3. Select a specific platform folder from `builds/<platform>/`
4. The extension will only work on that specific platform

## Features by Platform

### Twitter/X
- Schedule button in tweet composer
- Quick actions panel (Analytics, Schedule, AI Generate)
- AI enhancement button for tweets
- Real-time monitoring and reply suggestions

### Facebook
- Schedule button in post composer
- Multi-page support
- Floating action panel

### Instagram
- Schedule posts with image optimization
- Image size and hashtag tips
- Best posting time recommendations

### TikTok
- Video scheduling
- Trending hashtag suggestions
- Optimal posting times

### LinkedIn
- Professional content scheduling
- Industry-specific tips
- Engagement optimization

### YouTube
- Video scheduling
- Analytics integration
- Upload time recommendations

### Reddit
- Subreddit-aware scheduling
- Karma and engagement tips
- Rule compliance reminders

### Snapchat
- Story scheduling
- Optimal posting times

## Publishing to Chrome Web Store

### Strategy: 9 Separate Listings

You can publish **9 different extensions** to the Chrome Web Store:

1. **SocialMonkey - All Platforms** (master extension)
2. **SocialMonkey for Twitter/X**
3. **SocialMonkey for Facebook**
4. **SocialMonkey for Instagram**
5. **SocialMonkey for TikTok**
6. **SocialMonkey for LinkedIn**
7. **SocialMonkey for YouTube**
8. **SocialMonkey for Reddit**
9. **SocialMonkey for Snapchat**

### Benefits of This Approach

**Discovery & SEO**: Each platform gets its own listing, improving searchability
- Users searching "Twitter scheduler extension" find your Twitter extension
- Users searching "Instagram automation" find your Instagram extension

**Permissions**: Individual extensions request fewer permissions
- Twitter extension only needs access to twitter.com/x.com
- More trust from users who only use one platform

**Performance**: Lighter extensions with only one platform's code
- Faster load times
- Less memory usage

**User Choice**: Users can install only what they need
- Privacy-conscious users prefer minimal permissions
- Power users can install the master extension

### Publishing Steps

1. **Prepare Icons**: Create 16x16, 48x48, and 128x128 PNG icons for each extension

2. **Build Extensions**: Run `node build-extensions.js`

3. **Create ZIP Files**: Zip each platform's build folder

4. **Chrome Web Store Developer Dashboard**:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Click "New Item"
   - Upload ZIP file for each extension
   - Fill in store listing details (name, description, screenshots)
   - Submit for review

5. **Pricing Strategy**:
   - Offer free versions with limited features
   - Premium versions with full scheduling and AI features
   - Or make extensions free and monetize through your web app

## Customization

### Update Brand Colors

Edit [popup.css](popup.css) to change theme colors:

```css
:root {
  --accent-primary: #6366f1;  /* Your brand color */
  --accent-hover: #4f46e5;
}
```

### Modify Content Scripts

Each platform's content script is in `content_scripts/<platform>/<platform>.js`. Customize features per platform as needed.

### Shared Utilities

Common functions are in [content_scripts/shared/utils.js](content_scripts/shared/utils.js), including:
- `createButton()` - Create branded buttons
- `showNotification()` - Display notifications
- `waitForElement()` - Wait for DOM elements
- `isUserLoggedIn()` - Check authentication status

## Future Enhancements

- Background service worker for scheduled posts
- OAuth integration with social platforms
- AI content generation integration
- Analytics dashboard
- Cross-posting between platforms
- Team collaboration features

## License

Copyright © 2024 SocialMonkey. All rights reserved.

## Support

For issues or feature requests, visit [socialmonkey.com/support](https://socialmonkey.com/support)

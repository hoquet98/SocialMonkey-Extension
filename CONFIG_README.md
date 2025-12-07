# Configuration Guide

## Overview

The `config.js` file centralizes all API URLs and feature flags for the SocialMonkey extension. This makes it easy to switch between development and production environments.

## Quick Start

### Switching Between Environments

**Development (Current):**
```javascript
API_BASE_URL: 'https://b97bdf83-839c-4546-95ce-99da2e78b918-00-12ls58ikhbzj5.spock.replit.dev',
```

**Production:**
```javascript
API_BASE_URL: 'https://socialmonkey.ai',
```

### After Changing the Config

1. Edit `config.js` and change the `API_BASE_URL`
2. **IMPORTANT**: Also update the same configuration in `background.js` (lines 7-24)
   - The config is duplicated because Manifest V3 service workers don't support loading local files
   - Keep both files in sync when changing API URLs or endpoints
3. Rebuild the extension:
   ```bash
   node build-extensions.js twitter
   ```
4. Reload the extension in Chrome (`chrome://extensions/` → Reload button)

## Configuration Options

### API_BASE_URL
The base URL for all API requests. Change this to point to your dev or production server.

### ENDPOINTS
Relative paths for each API endpoint. These are appended to `API_BASE_URL`:
- `EVALUATE_POSTS` - High-Impact tweet evaluation
- `REPLY_STARTERS` - AI reply suggestions
- `EXCHANGE_CODE` - OAuth code exchange
- `OAUTH_CALLBACK` - OAuth redirect URL

### FEATURES
Feature flags to enable/disable functionality:
- `HIGH_IMPACT_SCANNING` - Enable tweet evaluation
- `REPLY_STARTERS` - Enable AI reply suggestions
- `DEBUG_MODE` - Enable console logging

### SETTINGS
Runtime configuration:
- `NOTIFICATION_DURATION` - How long notifications show (ms)
- `CACHE_EXPIRY` - How long to cache API responses (ms)

## Important Notes

### Configuration Files
The configuration is maintained in TWO places:
1. **`config.js`** - Used by content scripts (loaded via manifest.json)
2. **`background.js`** (lines 7-24) - Used by the service worker

**Always update both files when changing API URLs!** They must be kept in sync.

### Host Permissions
When adding a new API URL, make sure to update `manifest.json` → `host_permissions`:

```json
"host_permissions": [
  "https://socialmonkey.ai/*",
  "https://*.replit.dev/*"  // For Replit dev servers
]
```

### OAuth Callback URL
When changing environments, update your OAuth app settings to match the new callback URL:
- Dev: `https://b97bdf83-839c-4546-95ce-99da2e78b918-00-12ls58ikhbzj5.spock.replit.dev/extension/connected`
- Prod: `https://socialmonkey.ai/extension/connected`

## Testing Different Environments

You can temporarily override the API URL in the console for testing:

```javascript
// In browser console (content script context)
window.SOCIALMONKEY_CONFIG.API_BASE_URL = 'http://localhost:3000';
```

Note: This only affects the current tab and is reset on page reload.

## Deployment Checklist

Before deploying to production:

1. ✅ Change `API_BASE_URL` to `https://socialmonkey.ai` in **both** `config.js` AND `background.js`
2. ✅ Set `DEBUG_MODE` to `false` (optional, to reduce console logs) in **both** files
3. ✅ Rebuild extension: `node build-extensions.js twitter`
4. ✅ Test OAuth flow on production
5. ✅ Test all API endpoints
6. ✅ Verify manifest version is updated

## Troubleshooting

### "Failed to fetch" errors
- Check that `API_BASE_URL` is correct
- Verify `host_permissions` includes the API domain
- Check browser console for CORS errors

### OAuth not working
- Verify callback URL matches in both config and OAuth app settings
- Check that the API server is running
- Look for state mismatch errors in console

### API calls going to wrong server
- Reload the extension after changing config
- Check background service worker console: `chrome://extensions/` → "service worker" link
- Look for "API Base URL:" log message

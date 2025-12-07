# Build System Guide

## Quick Start

### Install Dependencies
```bash
pnpm install
```

### Build Commands

#### Build All Platforms
```bash
pnpm run build
```

#### Build Specific Platform
```bash
pnpm run build:twitter
pnpm run build:facebook
pnpm run build:instagram
# ... etc
```

#### Build Master Extension (All Platforms)
```bash
pnpm run build:master
```

#### Development with Watch Mode
```bash
# Watch all platforms
pnpm run watch

# Watch specific platform (recommended for development)
pnpm run watch:twitter

# Alias for watch:twitter
pnpm run dev
```

#### Clean Build Directory
```bash
pnpm run clean
```

---

## Build Output

All builds are output to the `builds/` directory:

```
builds/
├── twitter/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   ├── icons/
│   └── content_scripts/
│       ├── shared/
│       │   └── utils.js
│       └── twitter/
│           ├── twitter.js
│           └── twitter-advanced.js
├── facebook/
├── instagram/
└── ... (other platforms)
```

---

## Loading Extension in Chrome

### Method 1: Load from Build Directory (Recommended)

1. Build the extension:
   ```bash
   pnpm run build:twitter
   ```

2. Open Chrome and go to: `chrome://extensions/`

3. Enable **"Developer mode"** (toggle in top-right)

4. Click **"Load unpacked"**

5. Select the build directory: `builds/twitter/`

6. Extension is now installed!

### Method 2: Development with Auto-Reload

1. Start watch mode:
   ```bash
   pnpm run watch:twitter
   ```

2. Load extension from `builds/twitter/` as above

3. Edit any source file in `content_scripts/` or `popup.*`

4. The build will automatically regenerate

5. Click the **reload icon** in Chrome extensions page to reload the extension

---

## Build System Features

### ✅ Modular Architecture
- Separate builds for each platform
- Shared utilities across all platforms
- Platform-specific features (e.g., twitter-advanced.js)

### ✅ Watch Mode
- Auto-rebuild on file changes
- Uses `chokidar` for efficient file watching
- Fallback to native `fs.watch` if chokidar not available

### ✅ Clean Builds
- `pnpm run clean` removes all build artifacts
- Fresh builds every time

### ✅ Advanced Features
The build system automatically copies platform-specific advanced features:

```javascript
// In build-extensions.js
const advancedFeatures = {
  twitter: ['twitter-advanced.js'],
  // Add more as you build them:
  // facebook: ['facebook-analytics.js'],
  // instagram: ['instagram-auto-reply.js']
};
```

---

## Project Structure

### Source Files (You Edit These)
```
content_scripts/
├── shared/
│   └── utils.js                    # Shared utilities
├── twitter/
│   ├── twitter.js                  # Twitter bootstrap
│   └── twitter-advanced.js         # Feature #1
├── facebook/
│   └── facebook.js
└── ... (other platforms)

popup.html, popup.css, popup.js       # Extension popup UI
background.js                         # Background service worker
manifest.json                         # Master manifest (all platforms)
builds/twitter/manifest.json          # Twitter-specific manifest
```

### Build Output (Generated, Don't Edit)
```
builds/
├── twitter/                        # Built Twitter extension
├── facebook/                       # Built Facebook extension
└── ...
```

---

## Development Workflow

### Typical Development Session

1. **Start watch mode:**
   ```bash
   pnpm run dev
   ```

2. **Load extension in Chrome:**
   - Go to `chrome://extensions/`
   - Load unpacked from `builds/twitter/`

3. **Make changes:**
   - Edit `content_scripts/twitter/twitter-advanced.js`
   - Build automatically regenerates

4. **Test changes:**
   - Go to Twitter
   - Reload extension in Chrome (click reload icon)
   - Check DevTools console for logs

5. **Iterate:**
   - Make more changes
   - Auto-rebuild triggers
   - Reload extension
   - Test

---

## Troubleshooting

### Build fails with "manifest not found"
**Solution:** Make sure `builds/twitter/manifest.json` exists. This file should be manually created for each platform.

### Watch mode not detecting changes
**Solution:** Install chokidar for better watching:
```bash
pnpm install -D chokidar
```

### Extension not updating in Chrome
**Solution:** After build, you must manually reload the extension:
1. Go to `chrome://extensions/`
2. Click the reload icon on your extension
3. Or toggle the extension off and on

### Twitter advanced features not loading
**Solution:** Check that:
1. `twitter-advanced.js` exists in `content_scripts/twitter/`
2. Build completed successfully
3. `builds/twitter/content_scripts/twitter/twitter-advanced.js` exists after build
4. Manifest includes the script in the correct order

---

## Packaging for Chrome Web Store

When ready to publish:

1. **Build the platform:**
   ```bash
   pnpm run build:twitter
   ```

2. **Create ZIP:**
   ```bash
   cd builds/twitter
   zip -r ../../twitter-extension.zip .
   ```

3. **Upload to Chrome Web Store:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Upload `twitter-extension.zip`
   - Fill out store listing
   - Submit for review

---

## Adding New Platforms

To add a new platform (e.g., "threads"):

1. **Create content script:**
   ```bash
   mkdir content_scripts/threads
   echo "logDebug('Threads', '✓ Content script loaded');" > content_scripts/threads/threads.js
   ```

2. **Create manifest:**
   ```bash
   mkdir -p builds/threads
   # Copy and modify manifest.json for threads
   ```

3. **Add to build system:**
   Edit `build-extensions.js`:
   ```javascript
   const platforms = [..., 'threads'];
   ```

4. **Build:**
   ```bash
   pnpm run build:threads
   ```

---

## npm vs pnpm vs yarn

This project uses **pnpm** but works with npm or yarn too:

```bash
# pnpm (recommended - faster, more efficient)
pnpm install
pnpm run build

# npm
npm install
npm run build

# yarn
yarn install
yarn build
```

If you don't have pnpm installed:
```bash
npm install -g pnpm
```

---

## Advanced: Custom Build Scripts

You can run the build script directly with more control:

```bash
# Build specific platform
node build-extensions.js twitter

# Watch mode
node build-extensions.js twitter --watch

# Clean
node build-extensions.js --clean

# Build all
node build-extensions.js
```

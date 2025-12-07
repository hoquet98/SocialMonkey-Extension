# SocialMonkey Twitter Extension - Quick Start

## ✅ Build Complete!

Your Twitter extension with Feature #1 is ready to test.

---

## Step 1: Load Extension in Chrome

1. **Open Chrome Extensions:**
   - Go to: `chrome://extensions/`
   - Or click: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode:**
   - Toggle "Developer mode" switch in the top-right corner

3. **Load the Extension:**
   - Click **"Load unpacked"** button
   - Navigate to and select: `C:\Users\hoque\SocialMonkey_Extension\builds\twitter`
   - Click "Select Folder"

4. **Verify Installation:**
   - You should see "SocialMonkey Twitter" appear in your extensions list
   - Extension should be enabled (toggle switch is blue)

---

## Step 2: Test on Twitter

1. **Go to Twitter:**
   - Visit https://twitter.com or https://x.com
   - Make sure you're logged in

2. **Open DevTools Console:**
   - Press **F12** (or Ctrl+Shift+I)
   - Click the **"Console"** tab

3. **Check for Initialization Logs:**
   You should see:
   ```
   [SocialMonkey:Twitter] ✓ Content script loaded and running
   [SocialMonkey:Twitter:Feature1] ✓ High-Impact Reply Scanner initializing...
   [SocialMonkey:Twitter:Feature1] Setting up MutationObserver for tweet feed...
   [SocialMonkey:Twitter:Feature1] Found X existing tweets to scan
   [SocialMonkey:Twitter:Feature1] MutationObserver attached to feed container
   [SocialMonkey:Twitter:Feature1] ✓ Feature initialized successfully
   [SocialMonkey:Twitter:Feature1] ✓ Module loaded
   ```

4. **Look for High-Impact Badges:**
   - Scroll through your Twitter feed
   - Look for tweets with a purple **"✨ High-Impact (score)"** badge in the top-right
   - These are high-engagement tweet opportunities

5. **Hover for Details:**
   - Hover your mouse over any badge
   - A tooltip will appear showing:
     - Why the tweet scored high
     - Engagement breakdown (likes, replies, retweets)
     - Recency bonus
     - Reply ratio bonus

---

## Step 3: Watch Console for Activity

As you scroll, you'll see debug logs like:

```
[SocialMonkey:Twitter:Feature1:Extract] Extracted tweet data {id: "...", author: "...", ...}
[SocialMonkey:Twitter:Feature1:Score] Tweet scored: 45/100 {reasons: [...]}
[SocialMonkey:Twitter:Feature1:HighImpact] ✨ High-impact tweet found! Score: 85 {...}
[SocialMonkey:Twitter:Feature1:Badge] ✓ Badge injected successfully {...}
```

These logs help you understand:
- Which tweets are being scanned
- How they're being scored
- Why certain tweets are marked as high-impact

---

## What to Look For

### High-Impact Tweets Typically Have:

1. **High Reply Count:** Lots of active conversation (3 points per reply)
2. **Recent Posts:** Tweets less than 2 hours old get recency bonus
3. **High Reply Ratio:** Many replies relative to likes (indicates engagement)
4. **Viral Potential:** Good mix of retweets and likes

### Badge Appearance:

```
┌─────────────────────────┐
│ ✨ High-Impact (85)     │  ← Purple gradient badge
└─────────────────────────┘
         ↓ Hover to see tooltip
┌──────────────────────────────┐
│ Why this is high-impact:     │
│ • 120 likes (+30 pts)        │
│ • 25 replies (+40 pts)       │
│ • 15 retweets (+30 pts)      │
│ • Posted 0.5h ago (+10 pts)  │
│                              │
│ 💡 High engagement + recency │
│ = great reply opportunity    │
└──────────────────────────────┘
```

---

## Adjusting the Threshold

If you're seeing **too many** or **too few** badges:

1. **Open the source file:**
   `content_scripts/twitter/twitter-advanced.js`

2. **Find the CONFIG object (line 24):**
   ```javascript
   const CONFIG = {
     HIGH_IMPACT_THRESHOLD: 70, // ← Change this number
     // ...
   };
   ```

3. **Adjust the threshold:**
   - **Lower value (e.g., 50):** More badges, easier to qualify
   - **Higher value (e.g., 85):** Fewer badges, only very high engagement

4. **Rebuild and reload:**
   ```bash
   pnpm run build:twitter
   ```
   Then reload the extension in Chrome (click reload icon)

---

## Development Workflow

### Making Changes:

1. **Start watch mode:**
   ```bash
   pnpm run watch:twitter
   ```

2. **Edit source files:**
   - Make changes to `content_scripts/twitter/twitter-advanced.js`
   - The build automatically regenerates

3. **Reload extension:**
   - Go to `chrome://extensions/`
   - Click the reload icon on SocialMonkey Twitter
   - Or toggle it off and on

4. **Refresh Twitter:**
   - Reload the Twitter page (Ctrl+R or F5)
   - Check console for new behavior

---

## Troubleshooting

### ❌ No badges appearing?

**Check these:**

1. **Console logs present?**
   - If no logs, extension didn't load
   - Try reloading extension in Chrome

2. **Tweets have enough engagement?**
   - Minimum 5 total engagement required
   - Score must be ≥ 70
   - Try lowering threshold to 30 for testing

3. **On correct page?**
   - Must be on twitter.com or x.com
   - Works on /home, /explore, profiles, etc.

### ❌ Extension not loading?

**Solutions:**

1. **Check manifest errors:**
   - Go to `chrome://extensions/`
   - Look for red error messages
   - Click "Errors" button if present

2. **Rebuild:**
   ```bash
   pnpm run clean
   pnpm run build:twitter
   ```

3. **Verify files exist:**
   - `builds/twitter/manifest.json` ✓
   - `builds/twitter/content_scripts/twitter/twitter-advanced.js` ✓

### ❌ Badge positioning weird?

**Twitter's DOM may have changed:**

1. Inspect a tweet element in DevTools
2. Find the best parent container
3. Update `markTweetAsHighImpact()` function in twitter-advanced.js
4. See [TWITTER_DOM_SELECTORS.md](TWITTER_DOM_SELECTORS.md) for guidance

---

## Next Steps

### ✅ Feature #1 is Complete

You now have a working high-impact reply opportunity scanner!

### What's Next?

Consider adding:

1. **Feature #2:** Click badge to generate AI reply
2. **Feature #3:** Track which tweets you replied to
3. **Feature #4:** Custom filters (only show badges for specific topics)
4. **Feature #5:** Analytics dashboard in popup
5. **Other platforms:** Adapt Feature #1 for Facebook, LinkedIn, etc.

---

## Resources

- **Full Documentation:** See [FEATURE1_IMPLEMENTATION.md](FEATURE1_IMPLEMENTATION.md)
- **DOM Selectors:** See [TWITTER_DOM_SELECTORS.md](TWITTER_DOM_SELECTORS.md)
- **Build System:** See [BUILD.md](BUILD.md)
- **Architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Support

If you encounter issues:

1. Check the console for error messages
2. Review documentation files
3. Verify Twitter hasn't changed their DOM structure
4. Test with threshold set to 30 to ensure system is working

---

**🎉 Congratulations! Your extension is ready to use.**

Happy testing! 🐵✨

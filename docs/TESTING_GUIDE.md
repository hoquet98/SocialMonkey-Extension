# SocialMonkey Extension - Testing Guide

## Quick Start: Testing Engagement Highlights

The extension is now in **MOCK MODE** so you can see the visual highlights without needing the backend API ready.

### What You'll See

When you scroll Twitter/X, tweets with high engagement will get:

1. **Blue "High-Impact" Badge** - Local scoring (always works)
2. **Colored Icon Highlights** - AI recommendations (currently using mock data):
   - 💬 **Purple Reply Icon** - "should_reply" recommendation
   - 🔄 **Green Retweet Icon** - "should_retweet" recommendation
   - ❤️ **Orange Like Icon** - "should_like" recommendation

All icons pulse gently and show tooltips with mock reasons when you hover.

---

## Step-by-Step Testing

### 1. Install/Reload Extension

```bash
# Rebuild (already done)
node build-extensions.js twitter

# In Chrome:
1. Go to chrome://extensions/
2. Click "Reload" button on SocialMonkey extension
3. Open new tab to https://x.com or https://twitter.com
```

### 2. Test in Limited Mode (No Login)

**Purpose:** Verify local features work without backend

1. Make sure you're **not connected** to SocialMonkey
2. Scroll your Twitter feed
3. **Expected behavior:**
   - ✅ Blue "High-Impact (XX)" badges appear on engaging tweets
   - ❌ NO purple/green/orange icon highlights (need connection)

### 3. Test in Connected Mode (With Mock Backend)

**Purpose:** See all features including AI highlight mockups

1. **Connect your SocialMonkey account:**
   - Click extension icon in toolbar
   - Click "Connect SocialMonkey Account"
   - Log in to socialmonkey.ai
   - Extension should show "Connected" status

2. **Open DevTools Console:**
   - Press `F12` or right-click → Inspect
   - Go to "Console" tab
   - Filter by typing: `Twitter:Eval`

3. **Scroll Twitter feed slowly:**
   - Watch console for evaluation logs
   - After ~1.5 seconds, you should see:
     ```
     [Twitter:Eval:Schedule] Debounce timer fired, sending X tweets
     [Twitter:Eval:Send] ⚠️ MOCK MODE - Using fake backend response
     [Twitter:Eval:Response] Mock response generated: X results
     [Twitter:Eval:Apply] Applying recommendations for tweet...
     [Twitter:Eval:Highlight] Reply icon highlighted
     [Twitter:Eval:Highlight] Like icon highlighted
     ```

4. **Visual verification:**
   - Scroll back up to see processed tweets
   - Look for **purple reply icons** (most common)
   - Look for **orange like/heart icons** (common)
   - Look for **green retweet icons** (less common)
   - Icons should **pulse gently**
   - **Hover over highlighted icons** → See tooltip with reason

---

## Understanding the Mock Mode

### Current Configuration

Location: `content_scripts/twitter/twitter-config.js`

```javascript
USE_MOCK_BACKEND: true  // ← Change to false when real backend is ready
```

### Mock Response Logic

The mock generates random recommendations with these probabilities:
- **should_reply:** 70% chance (most tweets)
- **should_like:** 60% chance
- **should_retweet:** 40% chance (least common)

Each tweet gets at least one recommendation, and reason summaries are randomly selected from:
- "Strong niche fit (AI tools) and high engagement"
- "Influential author in your target audience"
- "Viral potential - great opportunity for visibility"
- "Active discussion thread - good conversation starter"
- "Trending topic relevant to your interests"

---

## Switching to Real Backend

When your backend API is ready:

### 1. Update Configuration

Edit `content_scripts/twitter/twitter-config.js`:

```javascript
USE_MOCK_BACKEND: false  // ← Switch to production mode
```

### 2. Rebuild Extension

```bash
node build-extensions.js twitter
```

### 3. Test Real API

1. Reload extension in Chrome
2. Open DevTools Network tab
3. Scroll Twitter feed
4. Look for POST requests to:
   ```
   https://socialmonkey.ai/api/twitter/evaluate-posts
   ```
5. Verify request body contains tweet batch
6. Verify response matches expected format

---

## Visual Reference

### Icon Highlight Examples

#### Reply Recommendation (Purple)
```
Color: #a855f7
Effect: Purple glow + pulse animation
Tooltip: "💬 Recommended: [reason]"
```

#### Retweet Recommendation (Green)
```
Color: #22c55e
Effect: Green glow + pulse animation
Tooltip: "🔄 Recommended: [reason]"
```

#### Like Recommendation (Orange)
```
Color: #f97316
Effect: Orange glow + pulse animation
Tooltip: "❤️ Recommended: [reason]"
```

---

## Troubleshooting

### Problem: No highlights appearing

**Check:**
1. Are you connected? (Extension popup should say "Connected")
2. Are there high-impact tweets? (Need score ≥ 60)
3. Console errors? (Check for JavaScript errors)
4. CSS loaded? (Inspect element, look for `.sm-recommend-reply` class)

**Debug:**
```javascript
// In Console tab, run:
console.log('Queue length:', evalQueue.length);
console.log('Queued IDs:', evalQueuedIds.size);
console.log('Element map:', tweetElementMap.size);
```

### Problem: Console shows "No access token"

**Solution:** You're not connected. Click extension icon → Connect account

### Problem: Icons not glowing

**Check:**
1. Inspect the icon element
2. Look for classes: `sm-recommend-reply`, `sm-recommend-retweet`, `sm-recommend-like`
3. If classes are there but no glow, check if CSS was injected:
   ```javascript
   // In Console:
   document.querySelector('style[data-sm]');  // Should exist
   ```

### Problem: Tooltips not showing

**Check:**
1. Hover slowly over highlighted icon
2. Look for `title` attribute:
   ```javascript
   // Inspect element in DevTools
   // Should have: title="💬 Recommended: ..."
   ```

---

## Performance Monitoring

### Expected Metrics

- **Batch size:** 20 tweets per request
- **Debounce delay:** 1.5 seconds
- **API calls:** ~1 call per 20 high-impact tweets
- **Mock response time:** ~300ms
- **Real response time:** TBD (depends on backend)

### Memory Usage

Check in DevTools → Memory tab:
- `evalQueue`: Should be small (max 20 items)
- `evalQueuedIds`: Grows with scrolling (~50 bytes per tweet ID)
- `tweetElementMap`: Grows with scrolling (cleaned by garbage collector)

---

## Next Steps

1. ✅ Test mock mode (this guide)
2. ⏳ Implement backend `/api/twitter/evaluate-posts` endpoint
3. ⏳ Switch `USE_MOCK_BACKEND: false`
4. ⏳ Test with real backend
5. ⏳ Fine-tune recommendation logic based on user feedback

---

## Screenshots to Take

For documentation/marketing:

1. **High-Impact Badge** - Blue badge on engaging tweet
2. **Purple Reply Highlight** - Reply icon glowing purple with pulse
3. **Multiple Highlights** - Tweet with reply + like both highlighted
4. **Tooltip** - Hover state showing recommendation reason
5. **Console Logs** - DevTools showing evaluation flow

---

## Contact

If you encounter issues or have questions:
- Check console for `Twitter:Eval:Error` logs
- Review [BACKEND_EVALUATION.md](BACKEND_EVALUATION.md) for technical details
- Backend team: Review [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) for API specs

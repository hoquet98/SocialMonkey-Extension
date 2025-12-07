# Reply Starters V2 - Native Integration

## What Changed

The Reply Starters feature has been completely refactored to integrate natively into Twitter's reply flow:

### Before (V1)
- ❌ Purple button next to High-Impact badges in feed
- ❌ Accordion shown in tweet feed
- ❌ Not contextual to actual replying

### After (V2)
- ✅ Button integrated into Twitter's reply dialog toolbar
- ✅ Styled to match native Twitter buttons (round icon button)
- ✅ Dropdown appears below button (not in feed)
- ✅ Only visible when user is actually replying
- ✅ **Accordion with expandable categories** included

## User Flow

1. **User clicks Reply on any tweet** → Twitter's reply dialog opens (modal or inline)
2. **SocialMonkey button appears** → Round icon button with 🐵 in toolbar (next to emoji/GIF/etc buttons)
3. **User clicks SocialMonkey button** → Dropdown appears below with categories
4. **User clicks category** → Expands to show 3 suggestions (accordion style!)
5. **User clicks suggestion** → Text inserted into reply box
6. **User manually clicks Reply** → Tweet sent

## Technical Implementation

### New Functions

#### 1. Reply Dialog Detection ([twitter-advanced.js:1062-1102](content_scripts/twitter/twitter-advanced.js#L1062-L1102))
```javascript
function initReplyDialogWatcher()
```
- Uses MutationObserver to detect when reply dialogs open
- Watches for `data-testid="tweetTextarea_0"` appearing in DOM
- Handles both modal and inline reply boxes

#### 2. Toolbar Button Injection ([twitter-advanced.js:1180-1258](content_scripts/twitter/twitter-advanced.js#L1180-L1258))
```javascript
function injectReplyStartersButton(toolbar, replyTextarea, tweetData)
```
- Creates native-style round button (34x34px)
- Adds to toolbar at beginning (before emoji button)
- Blue hover effect matching Twitter's style
- Uses 🐵 emoji as icon (can be replaced with SVG logo)

#### 3. Dropdown Management ([twitter-advanced.js:1267-1359](content_scripts/twitter/twitter-advanced.js#L1267-L1359))
```javascript
async function handleReplyStartersToolbarClick(button, replyTextarea, tweetData)
```
- Creates dropdown with Twitter's native styling
- Positioned absolutely below button
- Handles auth check, caching, loading states
- Auto-closes when clicking outside

#### 4. Accordion Rendering ([twitter-advanced.js:1379-1505](content_scripts/twitter/twitter-advanced.js#L1379-L1505))
```javascript
function renderReplyStartersDropdown(dropdown, data, replyTextarea, tweetData)
```
- **Renders categories as expandable accordions** ✅
- Each category has toggle button with ▼ icon
- Clicking category expands to show suggestions
- Categories use Twitter's color scheme

#### 5. Direct Text Insertion ([twitter-advanced.js:1512-1532](content_scripts/twitter/twitter-advanced.js#L1512-L1532))
```javascript
function insertReplyTextDirectly(replyTextarea, text)
```
- No need to open reply box (already open)
- Directly inserts text into existing textarea
- Triggers input events for Twitter's state

## Visual Design

### Button Style
```css
Width: 34px
Height: 34px
Border-radius: 9999px (fully round)
Background: transparent (hover: rgba(29, 155, 240, 0.1))
Icon: 🐵 emoji, 20x20px
Color: rgb(29, 155, 240) (Twitter blue)
```

### Dropdown Style
```css
Position: absolute below button
Background: white
Border: 1px solid rgb(207, 217, 222)
Border-radius: 16px
Box-shadow: Twitter's native shadow
Max-width: 400px
Min-width: 300px
Max-height: 400px (scrollable)
Padding: 12px
```

### Category Accordion Style
```css
Background: rgb(247, 249, 249) (Twitter gray)
Border-radius: 12px
Padding: 12px
Hover: rgb(239, 243, 244) (darker gray)
Icon: ▼ (rotates 180° when expanded)
```

### Suggestion Style
```css
Background: white
Border: 1px solid rgb(207, 217, 222)
Border-radius: 12px
Padding: 12px
Font-size: 14px
Hover: Blue border + light gray background
Selected: Blue border + gray background
```

## Testing Checklist

### Basic Functionality
- [x] Open Twitter/X in browser
- [ ] Click Reply on any tweet
- [ ] Verify 🐵 button appears in toolbar
- [ ] Button should be first icon (before emoji)
- [ ] Hover button → Light blue background
- [ ] Click button → Dropdown appears below

### Dropdown Interaction
- [ ] Dropdown positioned correctly below button
- [ ] Shows loading state initially
- [ ] After load, shows categories
- [ ] Click category → Expands to show 3 suggestions
- [ ] Click category again → Collapses
- [ ] Click outside dropdown → Closes

### Suggestion Selection
- [ ] Click a suggestion → Inserts text into reply box
- [ ] Selected suggestion highlights in blue
- [ ] Dropdown closes after selection
- [ ] Reply button (Twitter's) becomes active
- [ ] Text appears in reply textarea
- [ ] User can edit text before sending

### Edge Cases
- [ ] Modal reply dialog (clicking Reply button)
- [ ] Inline reply box (some tweets)
- [ ] No auth → Shows "Connect Required" message
- [ ] API error → Shows error message
- [ ] Cache works → Second click loads instantly
- [ ] Multiple reply boxes open → Each gets own button

## Files Changed

### [content_scripts/twitter/twitter-advanced.js](content_scripts/twitter/twitter-advanced.js)

**Removed:**
- Line 967: `addReplyStartersButton()` call from feed badges (removed)
- Lines 1066-1110: Old feed button injection function (replaced)

**Added:**
- Lines 1062-1102: `initReplyDialogWatcher()` - MutationObserver for reply dialogs
- Lines 1109-1127: `findReplyToolbar()` - Find toolbar in reply dialog
- Lines 1135-1155: `extractTweetDataFromReplyDialog()` - Get tweet context
- Lines 1162-1171: `findParentTweet()` - Helper to find tweet element
- Lines 1180-1258: `injectReplyStartersButton()` - Inject native-style button
- Lines 1267-1359: `handleReplyStartersToolbarClick()` - Handle button clicks
- Lines 1366-1370: `positionDropdownBelowButton()` - Position dropdown
- Lines 1379-1505: `renderReplyStartersDropdown()` - **Render accordion dropdown**
- Lines 1512-1532: `insertReplyTextDirectly()` - Insert text without opening box
- Lines 1846, 1851: `initReplyDialogWatcher()` - Initialize on load
- Line 1855: Debug log for module load

## Accordion Implementation

Yes, the dropdown includes **accordion expand for categories**! Here's how it works:

### Category Structure
```html
<button class="sm-category-toggle-dropdown">
  <div>
    <div>💡 Insightful</div>
    <div>Share expertise and add value</div>
  </div>
  <span class="toggle-icon-dropdown">▼</span>
</button>
<div class="sm-category-content-dropdown" style="display: none;">
  <!-- Suggestions appear here when expanded -->
</div>
```

### Toggle Behavior
- Default: All categories collapsed (display: none)
- Click category → Expands (display: block) + Icon rotates 180°
- Click again → Collapses (display: none) + Icon rotates back
- Each category independent (can have multiple open)

### Visual Feedback
- Icon rotation animation (0.2s transition)
- Background color change on hover
- Smooth expand/collapse

## API Integration

No changes to backend contract. Still uses:

**Endpoint:** `POST https://socialmonkey.ai/api/twitter/reply-starters`

**Request:**
```json
{
  "platform": "twitter",
  "tweet": {
    "id": "1234567890",
    "text": "...",
    "author_handle": "username",
    "permalink": "https://x.com/username/status/1234567890",
    "metrics": {"likes": 150, "replies": 12, "retweets": 8}
  }
}
```

**Response:**
```json
{
  "tweet_id": "1234567890",
  "categories": [
    {
      "type": "insightful",
      "label": "💡 Insightful",
      "description": "Share expertise and add value",
      "suggestions": [
        {"id": "sugg_1", "text": "..."},
        {"id": "sugg_2", "text": "..."},
        {"id": "sugg_3", "text": "..."}
      ]
    }
  ]
}
```

## Advantages Over V1

1. **Less Visual Clutter** - No purple buttons in feed
2. **Better Context** - Only shows when user is replying
3. **Native Feel** - Matches Twitter's design language
4. **Cleaner UX** - Dropdown doesn't interfere with feed
5. **More Discoverable** - Icon in toolbar is intuitive
6. **Accordion Included** - Categories expand/collapse elegantly ✅

## Next Steps

1. **Test Extension:**
   - Load in Chrome: `chrome://extensions/` → Reload
   - Open Twitter and click Reply on any tweet
   - Verify button appears and dropdown works

2. **Replace Emoji Icon:**
   - Create SVG logo for SocialMonkey
   - Replace lines 1226-1228 in `injectReplyStartersButton()`
   - Use proper SVG path instead of emoji

3. **Refine Styling:**
   - Adjust dropdown positioning if needed
   - Tweak colors to match brand
   - Add animations for smooth interactions

4. **Deploy Backend:**
   - Ensure `/api/twitter/reply-starters` is live
   - Test with real tweet data
   - Monitor response times

## Troubleshooting

### Button Not Appearing
- **Check:** Is reply dialog open? (Not just hovering)
- **Check:** Console errors? (Look for `[SocialMonkey ReplyStarters]`)
- **Check:** Is toolbar found? (Add console.log in `findReplyToolbar()`)

### Dropdown Not Positioning Correctly
- **Issue:** Dropdown might be off-screen on small windows
- **Fix:** Add viewport boundary detection in `positionDropdownBelowButton()`

### Categories Not Expanding
- **Check:** Event listeners attached? (Console log in toggle handler)
- **Check:** Category IDs unique? (Should include tweet ID)
- **Check:** Icon rotation working? (Inspect element for transform style)

### Text Not Inserting
- **Check:** Is `replyTextarea` the correct element?
- **Check:** Are input events firing? (Add console.log)
- **Check:** Is textarea focused? (Should focus before inserting)

## Screenshots to Take

For documentation:

1. **Button in Toolbar** - Show 🐵 icon next to emoji/GIF buttons
2. **Dropdown Closed** - Category headers visible, collapsed
3. **Dropdown Expanded** - One category open showing 3 suggestions
4. **Hover State** - Blue border on suggestion hover
5. **Selected State** - Gray background on selected suggestion
6. **Text Inserted** - Reply box with inserted suggestion text

## Conclusion

The Reply Starters feature is now fully integrated into Twitter's native reply flow with:
- ✅ Native-style toolbar button
- ✅ Dropdown below button (not in feed)
- ✅ **Accordion expand/collapse for categories**
- ✅ Direct text insertion
- ✅ Twitter's visual design language
- ✅ Better UX and discoverability

Ready for testing!

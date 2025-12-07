# Twitter/X DOM Selector Reference

This document explains the DOM selectors used in the SocialMonkey Twitter extension and assumptions about Twitter's structure (as of January 2025).

---

## Critical Selectors

### Tweet Container
```javascript
document.querySelectorAll('[data-testid="tweet"]')
```
- **Purpose:** Main wrapper for each tweet in the feed
- **Assumptions:**
  - Each tweet has exactly one element with `data-testid="tweet"`
  - This is the top-level container for a single tweet
  - Contains all tweet content, author info, and engagement buttons

**If this breaks:** Twitter may have renamed this test ID. Inspect a tweet and look for the outermost container element.

---

### Tweet Text Content
```javascript
tweetElement.querySelector('[data-testid="tweetText"]')
```
- **Purpose:** The actual text content of the tweet
- **Returns:** Element containing the tweet text
- **Note:** This is different from the user name or metadata

**If this breaks:** Look for a `<div>` with `dir="auto"` that contains the tweet text. Twitter may have changed the test ID.

---

### Engagement Buttons

#### Like Button
```javascript
tweetElement.querySelector('[data-testid="like"]')
// OR
tweetElement.querySelector('[data-testid="unlike"]')
```
- **Purpose:** Get like count from aria-label
- **Note:** Test ID changes to "unlike" if you've already liked the tweet
- **Aria-label format:** "42 likes" or "1 like"

#### Reply Button
```javascript
tweetElement.querySelector('[data-testid="reply"]')
```
- **Aria-label format:** "15 replies" or "1 reply"

#### Retweet Button
```javascript
tweetElement.querySelector('[data-testid="retweet"]')
```
- **Aria-label format:** "8 retweets" or "1 retweet"

**Extracting the number:**
```javascript
const ariaLabel = button.getAttribute('aria-label');
// "42 likes" → extract "42"
const match = ariaLabel.match(/^(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/);
const number = parseEngagementNumber(match[1]); // Handles K, M, B suffixes
```

**If this breaks:** Twitter may have moved engagement counts elsewhere. Look for elements with `role="button"` and aria-labels containing "likes", "replies", or "retweets".

---

### Author/User Information
```javascript
tweetElement.querySelector('[data-testid="User-Name"]')
```
- **Purpose:** Container for author name and handle
- **Contains:** Display name, handle (@username), verified badge

**Extracting the handle:**
```javascript
const handleElement = userNameElement.querySelector('[href^="/"]');
const href = handleElement.getAttribute('href'); // "/elonmusk"
const handle = href.split('/')[1]; // "elonmusk"
```

**If this breaks:** Look for `<a>` tags with `href` starting with "/" inside the user info area. The handle is typically the first path segment.

---

### Timestamp
```javascript
tweetElement.querySelector('time')
```
- **Purpose:** Get when the tweet was posted
- **Attribute:** `datetime` contains ISO 8601 timestamp
- **Example:** `<time datetime="2025-01-13T15:30:00.000Z">3h</time>`

**Extracting:**
```javascript
const timeElement = tweetElement.querySelector('time');
const timestamp = new Date(timeElement.getAttribute('datetime'));
```

**If this breaks:** Twitter should always have a `<time>` element. If not, look for text like "3h ago" and try to parse it (less reliable).

---

### Tweet URL/ID
```javascript
tweetElement.querySelector('a[href*="/status/"]')
```
- **Purpose:** Get permanent link to tweet
- **Format:** `https://twitter.com/username/status/1234567890`

**Extracting ID:**
```javascript
const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
const href = tweetLink.href; // "https://twitter.com/user/status/1234567890?s=20"
const id = href.split('/status/')[1].split('?')[0]; // "1234567890"
```

**If this breaks:** The ID might be in a `data-` attribute on the tweet container. Inspect and look for a long numeric ID.

---

## Feed/Timeline Selectors

### Primary Timeline Container
```javascript
document.querySelector('[aria-label="Home timeline"]')
// OR
document.querySelector('[data-testid="primaryColumn"]')
```
- **Purpose:** Main feed container for observing new tweets
- **Fallback:** If neither exists, use `document.body`

**Why multiple options?**
- Twitter uses different selectors on different pages
- "Home timeline" for /home
- "primaryColumn" for other feeds
- Body fallback ensures MutationObserver always works

---

## Engagement Number Parsing

Twitter formats large numbers with suffixes:
- `"42"` → 42
- `"1.2K"` → 1,200
- `"3.5M"` → 3,500,000
- `"1B"` → 1,000,000,000

**Parsing logic:**
```javascript
function parseEngagementNumber(str) {
  str = str.replace(/,/g, ''); // Remove commas

  if (str.endsWith('K')) return parseFloat(str) * 1000;
  if (str.endsWith('M')) return parseFloat(str) * 1000000;
  if (str.endsWith('B')) return parseFloat(str) * 1000000000;

  return parseInt(str) || 0;
}
```

---

## Common Breakage Scenarios

### 1. Twitter Redesign
**Symptoms:** No tweets detected, badges don't appear
**Fix:**
1. Open DevTools on Twitter
2. Inspect a tweet element
3. Look for new `data-testid` values
4. Update selectors in `twitter-advanced.js`

### 2. A/B Testing
**Symptoms:** Works for some users, not others
**Cause:** Twitter often A/B tests UI changes
**Fix:** Add fallback selectors (already implemented where possible)

### 3. Localization
**Symptoms:** Engagement parsing fails in non-English
**Cause:** `aria-label` might be in different language
**Fix:** Current regex `^(\d+...)` should work for all languages since it only looks for numbers

### 4. Rate Limiting
**Symptoms:** Metrics show as 0 even though visible
**Cause:** Twitter hiding engagement counts
**Fix:** Code already handles this gracefully (returns 0)

---

## Testing Selectors

### Quick Console Test
Open DevTools on Twitter and run:

```javascript
// Test tweet detection
console.log('Tweets found:', document.querySelectorAll('[data-testid="tweet"]').length);

// Test engagement extraction
const tweet = document.querySelector('[data-testid="tweet"]');
console.log('Like button:', tweet?.querySelector('[data-testid="like"]'));
console.log('Reply button:', tweet?.querySelector('[data-testid="reply"]'));
console.log('User name:', tweet?.querySelector('[data-testid="User-Name"]'));
console.log('Tweet text:', tweet?.querySelector('[data-testid="tweetText"]')?.textContent);
```

If any of these return `null`, the selector has broken.

---

## Badge Injection Target

The badge is injected into:
```javascript
const tweetContent = tweetElement
  .querySelector('[data-testid="tweetText"]')
  ?.closest('div[dir="auto"]')
  ?.parentElement;

if (tweetContent) {
  const parent = tweetContent.parentElement;
  parent.style.position = 'relative'; // Required for absolute positioning
  parent.appendChild(badge);
}
```

**Assumptions:**
1. Tweet text is inside a `div[dir="auto"]`
2. That div's parent is a good container for the badge
3. That container can be set to `position: relative`

**If badge positioning breaks:**
- Inspect the tweet text element
- Walk up the DOM tree to find a suitable container
- Update the selector chain in `markTweetAsHighImpact()`

---

## Alternative Selectors (If Main Ones Break)

### Tweet Container Alternatives
```javascript
// Try these in order:
'[data-testid="tweet"]'
'article[role="article"]'  // Twitter often uses article tags
'[data-tweet-id]'          // May have data attribute with ID
'div[class*="tweet"]'      // Class names might contain "tweet"
```

### Engagement Alternatives
```javascript
// Look for:
'button[aria-label*="like"]'    // Any button with "like" in label
'button[aria-label*="reply"]'
'button[aria-label*="retweet"]'
'[role="group"] button'         // Buttons in action group
```

---

## Maintenance Checklist

When Twitter updates their UI:

- [ ] Test all selectors in console
- [ ] Verify tweet detection works
- [ ] Check engagement extraction
- [ ] Confirm author/handle extraction
- [ ] Test timestamp parsing
- [ ] Verify badge injection position
- [ ] Test on both twitter.com and x.com
- [ ] Update selectors in code
- [ ] Update this document
- [ ] Test with different tweet types (text, media, quotes, etc.)

---

## Notes on Twitter's DOM

### Dynamic Content
- Twitter uses infinite scroll
- Tweets are added/removed dynamically
- MutationObserver is essential for real-time detection

### React Components
- Twitter is built with React
- DOM structure can change without page reload
- Selectors should be resilient to React updates

### Lazy Loading
- Not all content loads immediately
- Some elements appear on scroll
- Wait for elements with `MutationObserver` or `waitForElement()`

### Shadow DOM
- Twitter doesn't currently use Shadow DOM
- But be aware for future updates
- If they do, selectors will need `shadowRoot` access

---

## Performance Notes

### Efficient Queries
```javascript
// ✅ Good - query within tweet element
tweetElement.querySelector('[data-testid="like"]')

// ❌ Bad - query entire document
document.querySelector('[data-testid="like"]') // Returns first like button, not this tweet's
```

### Minimize DOM Traversal
```javascript
// ✅ Cache selectors when possible
const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
const text = textElement?.textContent;

// ❌ Don't repeat queries
const text1 = tweetElement.querySelector('[data-testid="tweetText"]').textContent;
const text2 = tweetElement.querySelector('[data-testid="tweetText"]').length;
```

---

This document should be updated whenever Twitter changes their DOM structure or you discover new selector patterns.

// Twitter Inspirations - Save tweets as inspiration
// Adds a lightbulb icon to tweet engagement bars

// SocialMonkey brand blue color
const SM_BRAND_BLUE = 'rgb(29, 155, 240)';
const SM_BRAND_BLUE_HOVER = 'rgb(26, 140, 216)';
const SM_BRAND_BLUE_LIGHT = 'rgba(29, 155, 240, 0.1)';

// Lightbulb SVG icons
const LIGHTBULB_OUTLINE = `
<svg viewBox="0 0 24 24" aria-hidden="true" style="width: 18.75px; height: 18.75px;">
  <g>
    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" fill="currentColor"/>
  </g>
</svg>
`;

const LIGHTBULB_FILLED = `
<svg viewBox="0 0 24 24" aria-hidden="true" style="width: 18.75px; height: 18.75px;">
  <g>
    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" fill="currentColor"/>
  </g>
</svg>
`;

/**
 * Get access token from storage
 */
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['smAccessToken'], (result) => {
      resolve(result.smAccessToken || null);
    });
  });
}

/**
 * Get the current logged-in Twitter username from the page
 * Uses the same detection logic as twitter-followers.js
 * @returns {string|null} - Username if detected, null otherwise
 */
function getCurrentTwitterUsername() {
  try {
    // Method 1: Look for Profile link href (most reliable)
    const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href');
      if (href && href.startsWith('/') && href.length > 1) {
        const username = href.substring(1).split('/')[0].split('?')[0];
        if (username && username.length > 0) {
          return username;
        }
      }
    }

    // Method 2: Look for UserAvatar-Container data-testid (very reliable)
    const avatarContainer = document.querySelector('[data-testid^="UserAvatar-Container-"]');
    if (avatarContainer) {
      const testId = avatarContainer.getAttribute('data-testid');
      if (testId && testId.startsWith('UserAvatar-Container-')) {
        const username = testId.replace('UserAvatar-Container-', '');
        if (username && username.length > 0) {
          return username;
        }
      }
    }

    // Method 3: Check account switcher for @handle
    const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (accountSwitcher) {
      const handleMatch = accountSwitcher.textContent.match(/@([a-zA-Z0-9_]+)/);
      if (handleMatch) {
        return handleMatch[1];
      }
    }

    // Method 4: Parse from navigation links
    const navLinks = document.querySelectorAll('nav a[href^="/"]');
    for (const link of navLinks) {
      const href = link.getAttribute('href');
      const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
      if (match && !['home', 'explore', 'notifications', 'messages', 'compose', 'i', 'search', 'settings'].includes(match[1])) {
        return match[1];
      }
    }

    return null;
  } catch (e) {
    console.error('[SM Inspirations] Error detecting Twitter username:', e);
    return null;
  }
}

/**
 * Extract complete tweet data from tweet element for inspiration saving
 * @param {HTMLElement} tweetElement - The tweet DOM element
 * @param {string} status - The inspiration status ('idea', 'viral', etc.)
 */
function extractInspirationData(tweetElement, status = 'idea') {
  try {
    // Extract tweet ID and author from permalink
    let tweetId = null;
    let authorHandle = null;
    let authorName = null;
    let authorId = null;

    const permalinks = tweetElement.querySelectorAll('a[href*="/status/"]');
    for (const link of permalinks) {
      const match = link.href.match(/\/([^\/]+)\/status\/(\d+)/);
      if (match) {
        authorHandle = match[1];
        tweetId = match[2];
        break;
      }
    }

    if (!tweetId) {
      return null;
    }

    // Extract author name
    const authorNameEl = tweetElement.querySelector('[data-testid="User-Name"]');
    if (authorNameEl) {
      const spans = authorNameEl.querySelectorAll('span');
      if (spans.length > 0) {
        authorName = spans[0].textContent;
      }
    }

    // Extract author ID from avatar container if available
    const avatarContainer = tweetElement.querySelector('[data-testid^="UserAvatar-Container-"]');
    if (avatarContainer) {
      const testId = avatarContainer.getAttribute('data-testid');
      if (testId) {
        authorId = testId.replace('UserAvatar-Container-', '');
      }
    }

    // Extract tweet text
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const text = textElement ? textElement.textContent : '';

    // Extract metrics
    const metricsContainer = tweetElement.querySelector('[role="group"]');
    let likes = 0, replies = 0, retweets = 0, views = 0;

    if (metricsContainer) {
      // First, check the group's own aria-label which often contains views
      // Format: "1 like, 24 views" or "13 views"
      const groupAriaLabel = metricsContainer.getAttribute('aria-label') || '';
      if (groupAriaLabel) {
        const viewsMatch = groupAriaLabel.match(/([\d,]+)\s+views?/i);
        if (viewsMatch) {
          views = parseInt(viewsMatch[1].replace(/,/g, ''));
        }
      }
      
      // Extract other metrics from buttons
      const buttons = metricsContainer.querySelectorAll('[role="button"]');
      buttons.forEach(button => {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        const count = match ? parseInt(match[1].replace(/,/g, '')) : 0;

        if (ariaLabel.toLowerCase().includes('like')) likes = count;
        else if (ariaLabel.toLowerCase().includes('repl')) replies = count;
        else if (ariaLabel.toLowerCase().includes('repost') || ariaLabel.toLowerCase().includes('retweet')) retweets = count;
      });
    }

    // Extract media (images/videos)
    const media = [];
    const images = tweetElement.querySelectorAll('img[src*="media"]');
    images.forEach(img => {
      if (!img.src.includes('profile_images')) {
        media.push({
          type: 'photo',
          url: img.src
        });
      }
    });

    const videos = tweetElement.querySelectorAll('video');
    videos.forEach(video => {
      media.push({
        type: 'video',
        url: video.src || video.poster
      });
    });

    // Extract timestamp if available
    let createdAt = null;
    const timeElement = tweetElement.querySelector('time');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        createdAt = datetime;
      }
    }

    // Get the current user's Twitter username
    const twitterUsername = getCurrentTwitterUsername();

    return {
      platform: 'twitter',
      twitter_username: twitterUsername,
      status: status,
      tweet: {
        id: tweetId,
        text: text,
        author_id: authorId,
        author_handle: authorHandle,
        author_name: authorName || authorHandle,
        permalink: `https://x.com/${authorHandle}/status/${tweetId}`,
        created_at: createdAt,
        metrics: {
          likes,
          replies,
          retweets,
          views
        },
        media: media.length > 0 ? media : undefined
      },
      saved_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[SM Inspirations] Error extracting tweet data:', error);
    return null;
  }
}

/**
 * Save tweet as inspiration via backend API
 */
async function saveAsInspiration(tweetData, iconButton) {
  // Validate tweetData
  if (!tweetData || !tweetData.tweet || !tweetData.tweet.id) {
    console.error('[SM Inspirations] Invalid tweet data:', tweetData);
    return false;
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    // Could show a tooltip here: "Connect SocialMonkey to save inspirations"
    return false;
  }

  try {
    const API_BASE_URL = window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai';
    const url = `${API_BASE_URL}/api/extension/twitter/inspirations`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    });

    if (!response.ok) {
      console.error('[SM Inspirations] Failed to save inspiration:', response.status);
      return false;
    }

    const result = await response.json();

    if (result.success) {
      return true;
    } else {
      console.error('[SM Inspirations] Backend returned error:', result.error);
      return false;
    }
  } catch (error) {
    console.error('[SM Inspirations] Error saving inspiration:', error);
    return false;
  }
}

/**
 * Handle lightbulb icon click
 */
async function handleLightbulbClick(event, tweetElement, iconButton, iconDiv) {
  event.preventDefault();
  event.stopPropagation();

  // Check if already saved
  if (tweetElement.hasAttribute('data-sm-inspiration-saved')) {
    return;
  }

  // Extract tweet data with 'idea' status
  const tweetData = extractInspirationData(tweetElement, 'idea');

  if (!tweetData) {
    return;
  }

  // Save to backend
  const success = await saveAsInspiration(tweetData, iconButton);

  if (success) {
    // Mark as saved
    tweetElement.setAttribute('data-sm-inspiration-saved', 'true');

    // Switch to filled icon
    iconDiv.innerHTML = LIGHTBULB_FILLED;

    // Keep the color filled
    iconDiv.style.color = SM_BRAND_BLUE;
    iconButton.style.backgroundColor = SM_BRAND_BLUE_LIGHT;

    // Update aria-label
    iconButton.setAttribute('aria-label', 'Saved as inspiration');
  }
}

/**
 * Check if tweet should be auto-saved as viral and save it
 */
async function checkAndSaveViralPost(tweetElement) {
  // Skip if already saved as viral
  if (tweetElement.hasAttribute('data-sm-viral-saved')) {
    return;
  }

  // Get viral threshold from config
  const viralThreshold = window.TWITTER_CONFIG?.VIRAL_POST_VIEW_THRESHOLD || 20000;
  
  // Skip if threshold is 0 (feature disabled)
  if (viralThreshold === 0) {
    return;
  }

  // Extract tweet data to check views
  const tweetData = extractInspirationData(tweetElement, 'viral');
  if (!tweetData || !tweetData.tweet) {
    return;
  }

  // Check if views meet threshold
  const views = tweetData.tweet.metrics?.views || 0;
  
  // Debug log to see what we're comparing
  console.log(`[SM Inspirations] Viral check - views: ${views} (${typeof views}), threshold: ${viralThreshold} (${typeof viralThreshold}), meets threshold: ${views >= viralThreshold}`);
  
  if (views < viralThreshold) {
    return;
  }

  // Save as viral inspiration
  console.log(`[SM Inspirations] Auto-saving viral post with ${views.toLocaleString()} views (threshold: ${viralThreshold.toLocaleString()})`);
  
  const success = await saveAsInspiration(tweetData, null);
  
  if (success) {
    // Mark as viral-saved to prevent duplicate saves
    tweetElement.setAttribute('data-sm-viral-saved', 'true');
    console.log(`[SM Inspirations] Viral post saved successfully: ${tweetData.tweet.permalink}`);
  }
}

/**
 * Add lightbulb icon to tweet engagement bar
 */
function addLightbulbIcon(tweetElement) {
  // Skip if already processed
  if (tweetElement.hasAttribute('data-sm-inspiration-processed')) {
    return;
  }

  // Find the engagement bar (role="group")
  const engagementBar = tweetElement.querySelector('[role="group"]');
  if (!engagementBar) {
    return;
  }

  // Find the bookmark button to insert before it
  // Bookmark button typically has aria-label="Bookmark"
  const bookmarkButton = Array.from(engagementBar.querySelectorAll('[role="button"]'))
    .find(btn => {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      return ariaLabel.toLowerCase().includes('bookmark');
    });

  if (!bookmarkButton) {
    return;
  }

  // Create lightbulb button container (matches Twitter's structure)
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l';

  // Create the button
  const iconButton = document.createElement('button');
  iconButton.setAttribute('aria-label', 'Save as inspiration');
  iconButton.setAttribute('role', 'button');
  iconButton.setAttribute('type', 'button');
  iconButton.className = 'css-175oi2r r-sdzlij r-1phboty r-rs99b7 r-lrvibr r-2yi16 r-1qi8awa r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l';
  iconButton.style.cssText = 'background-color: rgba(0, 0, 0, 0); border-color: rgba(0, 0, 0, 0);';

  // Create icon wrapper div
  const iconDiv = document.createElement('div');
  iconDiv.setAttribute('dir', 'ltr');
  iconDiv.className = 'css-146c3p1 r-bcqeeo r-qvutc0 r-37j5jr r-q4m81j r-a023e6 r-rjixqe r-b88u0q r-1awozwy r-6koalj r-18u37iz r-16y2uox r-1777fci';
  iconDiv.style.color = SM_BRAND_BLUE;
  iconDiv.innerHTML = LIGHTBULB_OUTLINE;

  iconButton.appendChild(iconDiv);
  buttonContainer.appendChild(iconButton);

  // Add hover effects
  iconButton.addEventListener('mouseenter', () => {
    if (!tweetElement.hasAttribute('data-sm-inspiration-saved')) {
      iconDiv.style.color = SM_BRAND_BLUE_HOVER;
      iconButton.style.backgroundColor = SM_BRAND_BLUE_LIGHT;
    }
  }, { passive: true });

  iconButton.addEventListener('mouseleave', () => {
    if (!tweetElement.hasAttribute('data-sm-inspiration-saved')) {
      iconDiv.style.color = SM_BRAND_BLUE;
      iconButton.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    }
  }, { passive: true });

  // Add click handler
  iconButton.addEventListener('click', (e) => handleLightbulbClick(e, tweetElement, iconButton, iconDiv));

  // Insert before bookmark button
  bookmarkButton.parentElement.parentElement.insertBefore(buttonContainer, bookmarkButton.parentElement);

  // Mark as processed
  tweetElement.setAttribute('data-sm-inspiration-processed', 'true');
  
  // Check if this post should be auto-saved as viral
  checkAndSaveViralPost(tweetElement);
}

/**
 * Initialize inspirations feature
 */
function initInspirations() {
  // Observe for new tweets
  const observer = new MutationObserver(() => {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach(tweet => {
      addLightbulbIcon(tweet);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Process existing tweets
  const existingTweets = document.querySelectorAll('article[data-testid="tweet"]');
  existingTweets.forEach(tweet => {
    addLightbulbIcon(tweet);
  });
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.SM_Inspirations = {
    init: initInspirations,
    extractInspirationData: extractInspirationData
  };
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInspirations);
} else {
  initInspirations();
}

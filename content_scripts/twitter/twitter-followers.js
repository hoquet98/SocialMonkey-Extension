// ==========================================
// SOCIALMONKEY FOLLOWER GLOW V1
// ==========================================
// Tracks followers and highlights their tweets with avatar glows
// - Blue glow: Regular followers
// - Green glow: New followers (within 7 days)
// - Combines backend data + DOM detection ("Follows you" label)

const SM_FOLLOWERS_KEY = 'smFollowers';
const DAYS_NEW_FOLLOWER = 7;

// ==========================================
// DATA MODEL & STORAGE
// ==========================================

/**
 * Get stored follower data from chrome.storage.local
 * @returns {Promise<StoredFollowers>}
 */
function getStoredFollowers() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SM_FOLLOWERS_KEY], (result) => {
      const data = result[SM_FOLLOWERS_KEY];
      if (!data) {
        const initial = { followers: {}, lastSync: null };
        resolve(initial);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Save follower data to chrome.storage.local
 * @param {StoredFollowers} data
 * @returns {Promise<void>}
 */
function setStoredFollowers(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SM_FOLLOWERS_KEY]: data }, () => resolve());
  });
}

// ==========================================
// BACKEND API CALLS
// ==========================================

/**
 * Get access token for API calls
 * @returns {Promise<string|null>}
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
 * Tries multiple detection methods
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
          console.log('[SM Followers] ✅ Detected username (Profile Link):', username);
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
          console.log('[SM Followers] ✅ Detected username (Avatar Container):', username);
          return username;
        }
      }
    }

    // Method 3: Check account switcher for @handle
    const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (accountSwitcher) {
      const handleMatch = accountSwitcher.textContent.match(/@([a-zA-Z0-9_]+)/);
      if (handleMatch) {
        const username = handleMatch[1];
        console.log('[SM Followers] ✅ Detected username (Account Switcher):', username);
        return username;
      }
    }

    // Method 4: Parse from navigation links
    const navLinks = document.querySelectorAll('nav a[href^="/"]');
    for (const link of navLinks) {
      const href = link.getAttribute('href');
      const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
      if (match && !['home', 'explore', 'notifications', 'messages', 'compose', 'i', 'search', 'settings'].includes(match[1])) {
        const username = match[1];
        console.log('[SM Followers] ✅ Detected username (Nav Links):', username);
        return username;
      }
    }

    console.log('[SM Followers] Could not detect Twitter username - DOM may not be ready yet');
    return null;
  } catch (e) {
    console.error('[SM Followers] Error detecting Twitter username:', e);
    return null;
  }
}

/**
 * Wait for the Twitter username to be available in the DOM
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {Promise<string|null>} - Username if detected, null if timed out
 */
async function waitForTwitterUsername(maxAttempts = 10, delayMs = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    const username = getCurrentTwitterUsername();
    if (username) {
      return username;
    }

    if (i < maxAttempts - 1) {
      console.log(`[SM Followers] Username not detected yet, retrying in ${delayMs}ms... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.warn('[SM Followers] Failed to detect Twitter username after', maxAttempts, 'attempts');
  return null;
}

/**
 * Fetch initial follower snapshot from backend (called once on first load)
 * @returns {Promise<StoredFollowers>}
 */
async function ensureInitialFollowersLoaded() {
  const stored = await getStoredFollowers();

  // Already synced at least once
  if (stored.lastSync) {
    console.log('[SM Followers] Initial sync already completed at:', stored.lastSync);
    console.log('[SM Followers] Total followers in cache:', Object.keys(stored.followers).length);
    return stored;
  }

  const token = await getAccessToken();
  if (!token) {
    console.log('[SM Followers] No access token - using DOM-only detection');
    return stored;
  }

  // Wait for Twitter username to be available in DOM
  const twitterUsername = await waitForTwitterUsername();
  if (!twitterUsername) {
    console.log('[SM Followers] Could not detect Twitter username - using DOM-only detection');
    return stored;
  }

  console.log('[SM Followers] Fetching initial follower snapshot from backend...');
  console.log('[SM Followers] Twitter account:', twitterUsername);

  try {
    const API_BASE_URL = window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai';
    const url = new URL(`${API_BASE_URL}/api/extension/twitter/followers/initial`);
    url.searchParams.set('twitter_username', twitterUsername);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.log('[SM Followers] Initial sync endpoint not ready (status:', res.status, ') - using DOM-only detection for now');
      return stored;
    }

    const json = await res.json();

    if (!json.success) {
      console.log('[SM Followers] Initial sync failed:', json);
      return stored;
    }

    const nowFollowers = { ...stored.followers };
    const now = new Date().toISOString();

    (json.followers || []).forEach((f) => {
      const key = f.id || f.handle;
      if (!key) return;

      if (!nowFollowers[key]) {
        // Ensure handle is properly formatted (add @ if missing)
        let handle = f.handle || '';
        if (handle && !handle.startsWith('@')) {
          handle = '@' + handle;
        }

        nowFollowers[key] = {
          handle: handle || `@user_${f.id}`,
          firstSeenAt: f.followed_at || now,
          source: 'backend'
        };
      }
    });

    const updated = {
      followers: nowFollowers,
      lastSync: new Date().toISOString() // Use current time as sync timestamp
    };

    await setStoredFollowers(updated);
    console.log('[SM Followers] ✅ Initial sync complete. Total followers:', Object.keys(updated.followers).length);

    return updated;
  } catch (err) {
    console.log('[SM Followers] Backend follower endpoint not available yet - using DOM-only detection for now');
    return stored;
  }
}

/**
 * Fetch new followers since last sync (called periodically)
 * @returns {Promise<StoredFollowers>}
 */
async function syncNewFollowersIfNeeded() {
  const stored = await getStoredFollowers();
  const token = await getAccessToken();

  if (!token || !stored.lastSync) {
    console.log('[SM Followers] Skipping diff sync - no token or no baseline');
    return stored;
  }

  // Wait for Twitter username to be available in DOM
  const twitterUsername = await waitForTwitterUsername();
  if (!twitterUsername) {
    console.log('[SM Followers] Could not detect Twitter username - skipping diff sync');
    return stored;
  }

  console.log('[SM Followers] Checking for new followers since:', stored.lastSync);
  console.log('[SM Followers] Twitter account:', twitterUsername);

  try {
    const API_BASE_URL = window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai';
    const url = new URL(`${API_BASE_URL}/api/extension/twitter/followers/diff`);
    url.searchParams.set('twitter_username', twitterUsername);
    url.searchParams.set('since', stored.lastSync);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.log('[SM Followers] Diff sync endpoint not ready (status:', res.status, ') - will retry later');
      return stored;
    }

    const json = await res.json();

    if (!json.success) {
      console.log('[SM Followers] Diff sync failed:', json);
      return stored;
    }

    const newFollowersCount = json.new_followers?.length || 0;

    if (newFollowersCount > 0) {
      console.log('[SM Followers] 🎉 Found', newFollowersCount, 'new followers!');
    }

    const nowFollowers = { ...stored.followers };

    (json.new_followers || []).forEach((f) => {
      const key = f.id || f.handle;
      if (!nowFollowers[key]) {
        nowFollowers[key] = {
          handle: f.handle,
          firstSeenAt: f.followed_at || new Date().toISOString(),
          source: 'backend'
        };
      }
    });

    const updated = {
      followers: nowFollowers,
      lastSync: new Date().toISOString() // Use current time as sync timestamp
    };

    await setStoredFollowers(updated);
    console.log('[SM Followers] ✅ Diff sync complete. Total followers:', Object.keys(updated.followers).length);

    return updated;
  } catch (err) {
    console.log('[SM Followers] Backend follower diff endpoint not available yet - will retry later');
    return stored;
  }
}

// ==========================================
// DOM-BASED FOLLOWER DETECTION
// ==========================================

/**
 * Check if tweet DOM shows "Follows you" label
 * @param {HTMLElement} tweetElement
 * @returns {boolean}
 */
function domIndicatesFollower(tweetElement) {
  try {
    const nameBlock = tweetElement.querySelector('[data-testid="User-Name"]');
    if (!nameBlock) return false;
    const text = nameBlock.textContent || '';
    return text.includes('Follows you');
  } catch {
    return false;
  }
}

/**
 * Add follower to storage based on DOM detection
 * @param {string|null} authorIdOrHandle
 * @param {string} handle
 * @returns {Promise<StoredFollowers>}
 */
async function markFollowerFromDom(authorIdOrHandle, handle) {
  const stored = await getStoredFollowers();
  const key = authorIdOrHandle || handle;
  if (!key) return stored;

  if (!stored.followers[key]) {
    console.log('[SM Followers] DOM detected new follower:', handle || key);
    stored.followers[key] = {
      handle: handle || key,
      firstSeenAt: new Date().toISOString(),
      source: 'dom'
    };
    await setStoredFollowers(stored);
  }

  return stored;
}

// ==========================================
// FOLLOWER STATUS DETECTION
// ==========================================

/**
 * Check if a tweet author is a follower and if they're new
 * @param {string|null} authorId - Twitter user ID (preferred)
 * @param {string} authorHandle - Twitter handle (e.g., "@username")
 * @param {HTMLElement} tweetElement - Tweet DOM element
 * @returns {Promise<{isFollower: boolean, isNewFollower: boolean}>}
 */
async function isAuthorFollower(authorId, authorHandle, tweetElement) {
  // 1. Check DOM first (fast, real-time)
  if (domIndicatesFollower(tweetElement)) {
    await markFollowerFromDom(authorId || authorHandle, authorHandle);
    return { isFollower: true, isNewFollower: false }; // We don't mark DOM detections as "new"
  }

  // 2. Check local storage (backend + previous DOM detections)
  const stored = await getStoredFollowers();

  // Try lookup by ID first, then by handle
  let entry = null;
  if (authorId) {
    entry = stored.followers[authorId];
  }

  // If not found by ID, try looking up by handle (normalize handle format)
  if (!entry && authorHandle) {
    // Normalize handle: remove @ prefix and try both with and without @
    const normalizedHandle = authorHandle.startsWith('@') ? authorHandle.substring(1) : authorHandle;
    const withAt = '@' + normalizedHandle;

    // Try to find by handle in all follower entries
    for (const [key, followerData] of Object.entries(stored.followers)) {
      if (followerData.handle === withAt ||
          followerData.handle === normalizedHandle ||
          followerData.handle === '@' + normalizedHandle ||
          key === normalizedHandle ||
          key === withAt) {
        entry = followerData;
        break;
      }
    }
  }

  if (!entry) {
    return { isFollower: false, isNewFollower: false };
  }

  // 3. Compute "new follower" status (within DAYS_NEW_FOLLOWER days)
  let isNewFollower = false;
  try {
    const firstSeen = new Date(entry.firstSeenAt).getTime();
    const now = Date.now();
    const diffDays = (now - firstSeen) / (1000 * 60 * 60 * 24);
    isNewFollower = diffDays <= DAYS_NEW_FOLLOWER;
  } catch (e) {
    isNewFollower = false;
  }

  return { isFollower: true, isNewFollower };
}

// ==========================================
// UI: AVATAR GLOW
// ==========================================

/**
 * Inject CSS for follower glows (called once on init)
 */
function injectFollowerStyles() {
  if (document.getElementById('sm-follower-styles')) return;

  console.log('[SM Followers] Injecting follower glow styles...');

  const style = document.createElement('style');
  style.id = 'sm-follower-styles';
  style.textContent = `
    /* Regular follower: Blue glow (using stronger hover effect as base) */
    .sm-follower-glow {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 1), 0 0 14px rgba(59, 130, 246, 0.9) !important;
      border-radius: 9999px;
      transition: box-shadow 0.2s ease;
    }

    /* New follower (within 7 days): Green glow (using stronger hover effect as base) */
    .sm-new-follower-glow {
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 1), 0 0 18px rgba(16, 185, 129, 1) !important;
      border-radius: 9999px;
      animation: sm-pulse-glow 2s ease-in-out infinite;
      transition: box-shadow 0.2s ease;
    }

    /* Subtle pulse animation for new followers */
    @keyframes sm-pulse-glow {
      0%, 100% {
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 1), 0 0 18px rgba(16, 185, 129, 1);
      }
      50% {
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 1), 0 0 22px rgba(16, 185, 129, 1);
      }
    }

    /* Hover effects - even stronger */
    .sm-follower-glow:hover {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 1), 0 0 18px rgba(59, 130, 246, 1) !important;
    }

    .sm-new-follower-glow:hover {
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 1), 0 0 22px rgba(16, 185, 129, 1) !important;
    }
  `;
  document.head.appendChild(style);

  console.log('[SM Followers] ✅ Follower styles injected');
}

/**
 * Apply follower glow to tweet avatar
 * @param {HTMLElement} tweetElement
 * @param {string|null} authorId
 * @param {string} authorHandle
 */
async function decorateTweetFollowerState(tweetElement, authorId, authorHandle) {
  // Skip if already processed
  if (tweetElement.hasAttribute('data-sm-follower-processed')) {
    return;
  }

  // Find avatar - try multiple selectors
  let avatarWrapper = null;

  // Method 1: Look for the circular avatar container by data-testid pattern
  // This is the most reliable - it's the div with data-testid="UserAvatar-Container-{username}"
  const avatarContainerByTestId = tweetElement.querySelector(`[data-testid^="UserAvatar-Container-"]`);
  if (avatarContainerByTestId) {
    avatarWrapper = avatarContainerByTestId;
  }

  // Method 2: Look for Tweet-User-Avatar and find the round container inside
  if (!avatarWrapper) {
    const tweetUserAvatar = tweetElement.querySelector('[data-testid="Tweet-User-Avatar"]');
    if (tweetUserAvatar) {
      // Find the container with inline style width/height (the circular wrapper)
      const roundContainer = tweetUserAvatar.querySelector('div[style*="width"][style*="height"]');
      if (roundContainer) {
        avatarWrapper = roundContainer;
      }
    }
  }

  // Method 3: Find by profile image URL
  if (!avatarWrapper) {
    const profileImg = tweetElement.querySelector('img[src*="profile_images"]');
    if (profileImg) {
      // Walk up to find a container with fixed width/height (the circular wrapper)
      let parent = profileImg.parentElement;
      for (let i = 0; i < 10 && parent; i++) {
        const style = parent.getAttribute('style');
        if (style && style.includes('width') && style.includes('height')) {
          avatarWrapper = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }
  }

  if (!avatarWrapper) {
    return;
  }

  // Check follower status
  const { isFollower, isNewFollower } = await isAuthorFollower(authorId, authorHandle, tweetElement);

  // Remove existing glow classes
  avatarWrapper.classList.remove('sm-follower-glow', 'sm-new-follower-glow');

  // Apply appropriate glow
  if (isFollower) {
    if (isNewFollower) {
      avatarWrapper.classList.add('sm-new-follower-glow');
    } else {
      avatarWrapper.classList.add('sm-follower-glow');
    }

    // Add tooltip attribute
    const label = isNewFollower ? '🌟 New Follower' : '✨ Follows You';
    avatarWrapper.setAttribute('title', label);
  }

  // Mark as processed
  tweetElement.setAttribute('data-sm-follower-processed', 'true');
}

// ==========================================
// INITIALIZATION & SYNC MANAGEMENT
// ==========================================

/**
 * Initialize follower tracking system
 */
async function initFollowerTracking() {
  console.log('[SM Followers] ========================================');
  console.log('[SM Followers] Initializing Follower Glow v1');
  console.log('[SM Followers] ========================================');

  // Inject styles
  injectFollowerStyles();

  // Load initial followers
  await ensureInitialFollowersLoaded();

  // Sync new followers (optional, can be called periodically)
  // For now, we'll just do it once on load
  await syncNewFollowersIfNeeded();

  // Log summary
  const stored = await getStoredFollowers();
  console.log('[SM Followers] ✅ Follower tracking initialized');
  console.log('[SM Followers] Total followers:', Object.keys(stored.followers).length);
}

/**
 * Extract author info from tweet element
 * @param {HTMLElement} tweetElement
 * @returns {{authorId: string|null, authorHandle: string|null}}
 */
function extractAuthorInfo(tweetElement) {
  try {
    // Try to find author handle from links
    const userNameBlock = tweetElement.querySelector('[data-testid="User-Name"]');
    if (!userNameBlock) return { authorId: null, authorHandle: null };

    // Find profile link
    const profileLink = userNameBlock.querySelector('a[href^="/"]');
    if (!profileLink) return { authorId: null, authorHandle: null };

    const href = profileLink.getAttribute('href') || '';
    const match = href.match(/^\/([^\/]+)/);
    const handle = match ? match[1] : null;

    // Twitter doesn't expose user IDs in DOM easily, so we'll use handle as key
    return {
      authorId: null, // We don't have access to numeric ID from DOM
      authorHandle: handle
    };
  } catch (e) {
    console.error('[SM Followers] Error extracting author info:', e);
    return { authorId: null, authorHandle: null };
  }
}

// ==========================================
// EXPORT FOR USE IN MAIN TWITTER SCRIPT
// ==========================================

// Make functions available globally for twitter-advanced.js to call
if (typeof window !== 'undefined') {
  window.SM_FollowerGlow = {
    init: initFollowerTracking,
    decorateTweet: decorateTweetFollowerState,
    extractAuthorInfo: extractAuthorInfo,
    syncNewFollowers: syncNewFollowersIfNeeded,

    // Debug functions
    clearCache: async () => {
      return new Promise((resolve) => {
        chrome.storage.local.remove('smFollowers', () => {
          console.log('[SM Followers] ✅ Cleared follower cache');
          resolve();
        });
      });
    },

    viewCache: async () => {
      const stored = await getStoredFollowers();
      console.log('[SM Followers] Current cache:', stored);
      console.log('[SM Followers] Total followers:', Object.keys(stored.followers).length);
      return stored;
    },

    forceRefresh: async () => {
      console.log('[SM Followers] Forcing refresh...');
      await window.SM_FollowerGlow.clearCache();
      await initFollowerTracking();
    }
  };
}

// Debug commands available via window.SM_FollowerGlow:
// - await window.SM_FollowerGlow.clearCache()
// - await window.SM_FollowerGlow.viewCache()
// - await window.SM_FollowerGlow.forceRefresh()

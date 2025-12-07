/**
 * SocialMonkey Twitter Reply Tracker
 *
 * Tracks which tweets the user has replied to by monitoring Reply button clicks.
 * Stores up to 500 tweet IDs with timestamps in chrome.storage.local.
 * Visually marks replied tweets with filled purple reply icons in the feed.
 */

logDebug('Twitter:ReplyTracker', '✓ Reply Tracker module loading...');

// Storage key
const SM_REPLIED_TWEETS_KEY = 'smRepliedTweets';

// Configuration
const REPLY_TRACKER_CONFIG = {
  MAX_STORED_REPLIES: 500,  // Maximum number of replied tweets to store
  PURPLE_COLOR: 'rgb(168, 85, 247)',  // Purple color for filled icons
  DEBUG: true
};

// In-memory cache for fast lookup
let repliedTweetsCache = new Set();
let isCacheInitialized = false;

// ==========================================
// STORAGE FUNCTIONS
// ==========================================

/**
 * Get all stored replied tweets from chrome.storage.local
 * @returns {Promise<Array>} Array of {id, timestamp} objects
 */
async function getStoredReplies() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SM_REPLIED_TWEETS_KEY], (result) => {
      const replies = result[SM_REPLIED_TWEETS_KEY] || [];

      if (REPLY_TRACKER_CONFIG.DEBUG) {
        logDebug('Twitter:ReplyTracker:Storage', `Retrieved ${replies.length} replied tweets from storage`);
      }

      resolve(replies);
    });
  });
}

/**
 * Save replied tweets array to chrome.storage.local
 * @param {Array} replies - Array of {id, timestamp} objects
 * @returns {Promise<void>}
 */
async function saveReplies(replies) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SM_REPLIED_TWEETS_KEY]: replies }, () => {
      if (REPLY_TRACKER_CONFIG.DEBUG) {
        logDebug('Twitter:ReplyTracker:Storage', `Saved ${replies.length} replied tweets to storage`);
      }
      resolve();
    });
  });
}

/**
 * Add a tweet ID to the replied tweets list
 * Maintains rolling storage of max 500 entries (newest first)
 * @param {string} tweetId - The tweet ID to mark as replied
 * @returns {Promise<void>}
 */
async function addRepliedTweet(tweetId) {
  if (!tweetId || tweetId.startsWith('temp_')) {
    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:Add', 'Skipping temporary or invalid tweet ID:', tweetId);
    }
    return;
  }

  // Get current replies
  const replies = await getStoredReplies();

  // Check if already exists
  const existingIndex = replies.findIndex(r => r.id === tweetId);
  if (existingIndex !== -1) {
    // Update timestamp of existing entry
    replies[existingIndex].timestamp = Date.now();

    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:Add', `Updated timestamp for existing tweet: ${tweetId}`);
    }
  } else {
    // Add new entry at the beginning
    replies.unshift({
      id: tweetId,
      timestamp: Date.now()
    });

    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:Add', `Added new replied tweet: ${tweetId}`);
    }
  }

  // Clean old entries (keep newest 500)
  const cleanedReplies = cleanOldReplies(replies);

  // Save to storage
  await saveReplies(cleanedReplies);

  // Update cache
  repliedTweetsCache.add(tweetId);

  if (REPLY_TRACKER_CONFIG.DEBUG) {
    logDebug('Twitter:ReplyTracker:Add', `Total replied tweets: ${cleanedReplies.length}`);
  }
}

/**
 * Keep only the newest MAX_STORED_REPLIES entries
 * @param {Array} replies - Array of {id, timestamp} objects
 * @returns {Array} Cleaned array
 */
function cleanOldReplies(replies) {
  // Sort by timestamp DESC (newest first)
  replies.sort((a, b) => b.timestamp - a.timestamp);

  // Keep only first MAX_STORED_REPLIES entries
  const cleaned = replies.slice(0, REPLY_TRACKER_CONFIG.MAX_STORED_REPLIES);

  if (REPLY_TRACKER_CONFIG.DEBUG && replies.length > cleaned.length) {
    logDebug('Twitter:ReplyTracker:Clean', `Removed ${replies.length - cleaned.length} old entries`);
  }

  return cleaned;
}

/**
 * Check if a tweet has been replied to
 * @param {string} tweetId - The tweet ID to check
 * @returns {Promise<boolean>}
 */
async function hasReplied(tweetId) {
  // Ensure cache is initialized
  if (!isCacheInitialized) {
    await initializeCache();
  }

  return repliedTweetsCache.has(tweetId);
}

/**
 * Initialize the in-memory cache from storage
 * @returns {Promise<void>}
 */
async function initializeCache() {
  const replies = await getStoredReplies();

  repliedTweetsCache = new Set(replies.map(r => r.id));
  isCacheInitialized = true;

  if (REPLY_TRACKER_CONFIG.DEBUG) {
    logDebug('Twitter:ReplyTracker:Cache', `Initialized cache with ${repliedTweetsCache.size} tweet IDs`);
  }
}

// ==========================================
// CLICK HANDLER INTEGRATION
// ==========================================

/**
 * Attach click handlers to all Reply buttons in the feed
 */
function attachReplyClickHandlers() {
  const observer = new MutationObserver(() => {
    // Find all reply buttons not yet tracked
    const replyButtons = document.querySelectorAll('[data-testid="reply"]:not(.sm-reply-tracked)');

    replyButtons.forEach(button => {
      // Mark as tracked to avoid duplicate handlers
      button.classList.add('sm-reply-tracked');

      // Add click listener
      button.addEventListener('click', async (e) => {
        // Find parent tweet element
        const tweetElement = button.closest('[data-testid="tweet"]');
        if (!tweetElement) {
          if (REPLY_TRACKER_CONFIG.DEBUG) {
            logDebug('Twitter:ReplyTracker:Click', 'Could not find parent tweet element');
          }
          return;
        }

        // Extract tweet ID
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        const tweetId = tweetLink?.href.split('/status/')[1]?.split('?')[0];

        if (tweetId) {
          if (REPLY_TRACKER_CONFIG.DEBUG) {
            logDebug('Twitter:ReplyTracker:Click', `Reply button clicked for tweet: ${tweetId}`);
          }

          // Store the replied tweet
          await addRepliedTweet(tweetId);

          // Immediately update UI
          markReplyIconAsFilled(button);
        } else {
          if (REPLY_TRACKER_CONFIG.DEBUG) {
            logDebug('Twitter:ReplyTracker:Click', 'Could not extract tweet ID from element');
          }
        }
      }, { passive: true });
    });

    if (REPLY_TRACKER_CONFIG.DEBUG && replyButtons.length > 0) {
      logDebug('Twitter:ReplyTracker:Handlers', `Attached handlers to ${replyButtons.length} new reply buttons`);
    }
  });

  // Observe the entire document for new reply buttons
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  logDebug('Twitter:ReplyTracker', 'Reply click handlers observer started');
}

// ==========================================
// VISUAL INDICATOR
// ==========================================

/**
 * Mark a reply icon as filled (purple) to indicate the user has replied
 * @param {Element} replyButton - The reply button element
 */
function markReplyIconAsFilled(replyButton) {
  if (!replyButton) return;

  // Find the SVG icon inside the button
  const replyIcon = replyButton.querySelector('svg');
  if (!replyIcon) {
    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:Visual', 'Could not find SVG icon in reply button');
    }
    return;
  }

  // Skip if already filled
  if (replyIcon.classList.contains('sm-replied-filled')) {
    return;
  }

  // Add filled class
  replyIcon.classList.add('sm-replied-filled');

  // Inject CSS if not already present
  injectRepliedStyles();

  if (REPLY_TRACKER_CONFIG.DEBUG) {
    logDebug('Twitter:ReplyTracker:Visual', 'Marked reply icon as filled (purple)');
  }
}

/**
 * Inject CSS styles for filled reply icons
 */
function injectRepliedStyles() {
  // Check if styles already injected
  if (document.getElementById('sm-replied-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'sm-replied-styles';
  style.textContent = `
    /* Filled purple reply icon for tweets user has replied to */
    .sm-replied-filled {
      fill: ${REPLY_TRACKER_CONFIG.PURPLE_COLOR} !important;
      opacity: 1 !important;
    }

    .sm-replied-filled path {
      fill: ${REPLY_TRACKER_CONFIG.PURPLE_COLOR} !important;
    }
  `;

  document.head.appendChild(style);

  if (REPLY_TRACKER_CONFIG.DEBUG) {
    logDebug('Twitter:ReplyTracker:CSS', 'Injected replied icon styles');
  }
}

/**
 * Check if a tweet element should have a filled reply icon
 * Called by processTweetElement() in twitter-advanced.js
 * @param {Element} tweetElement - The tweet container element
 * @param {Object} tweetData - The extracted tweet data with id
 */
async function checkAndMarkRepliedTweet(tweetElement, tweetData) {
  if (!tweetData || !tweetData.id) {
    return;
  }

  // Check if user has replied to this tweet
  const replied = await hasReplied(tweetData.id);

  if (replied) {
    // Find and mark the reply button
    const replyButton = tweetElement.querySelector('[data-testid="reply"]');
    if (replyButton) {
      markReplyIconAsFilled(replyButton);
    }
  }
}

// ==========================================
// STORAGE CHANGE LISTENER
// ==========================================

/**
 * Listen for storage changes in other tabs/windows
 * Update cache and UI when replied tweets change
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[SM_REPLIED_TWEETS_KEY]) {
    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:StorageChange', 'Replied tweets changed in another tab, updating cache');
    }

    // Reinitialize cache
    initializeCache().then(() => {
      // Re-scan visible tweets and update UI
      const visibleTweets = document.querySelectorAll('[data-testid="tweet"]');
      visibleTweets.forEach(async (tweetElement) => {
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        const tweetId = tweetLink?.href.split('/status/')[1]?.split('?')[0];

        if (tweetId) {
          const replied = await hasReplied(tweetId);
          if (replied) {
            const replyButton = tweetElement.querySelector('[data-testid="reply"]');
            if (replyButton) {
              markReplyIconAsFilled(replyButton);
            }
          }
        }
      });
    });
  }
});

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize the reply tracker module
 */
async function initReplyTracker() {
  logDebug('Twitter:ReplyTracker', 'Initializing reply tracker...');

  // Initialize cache from storage
  await initializeCache();

  // Attach click handlers to reply buttons
  attachReplyClickHandlers();

  logDebug('Twitter:ReplyTracker', '✓ Reply tracker initialized');
}

// ==========================================
// GLOBAL EXPORT
// ==========================================

// Export to window for access from other modules
window.SM_ReplyTracker = {
  hasReplied,
  checkAndMarkRepliedTweet,
  addRepliedTweet,
  getStoredReplies
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReplyTracker);
} else {
  initReplyTracker();
}

logDebug('Twitter:ReplyTracker', '✓ Reply Tracker module loaded');

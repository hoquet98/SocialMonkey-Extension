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
  GREEN_COLOR: 'rgb(0, 186, 124)',  // Green checkmark color
  DEBUG: true
};

// Green checkmark SVG
const GREEN_CHECKMARK_SVG = `
  <svg viewBox="0 0 24 24" width="20" height="20" style="display: block;">
    <circle cx="12" cy="12" r="10" fill="rgb(0, 186, 124)" />
    <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

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
    try {
      chrome.storage.local.get([SM_REPLIED_TWEETS_KEY], (result) => {
        // Ensure we always get an array, even if storage is empty
        const replies = Array.isArray(result[SM_REPLIED_TWEETS_KEY])
          ? result[SM_REPLIED_TWEETS_KEY]
          : [];

        if (REPLY_TRACKER_CONFIG.DEBUG) {
          logDebug('Twitter:ReplyTracker:Storage', `Retrieved ${replies.length} replied tweets from storage`);
        }

        resolve(replies);
      });
    } catch (error) {
      console.error('[SM ReplyTracker] Error getting storage:', error);
      resolve([]); // Return empty array on error
    }
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
  try {
    const replies = await getStoredReplies();

    // Ensure replies is an array before mapping
    if (Array.isArray(replies)) {
      repliedTweetsCache = new Set(replies.map(r => r.id));
    } else {
      console.error('[SM ReplyTracker] Retrieved replies is not an array:', replies);
      repliedTweetsCache = new Set();
    }

    isCacheInitialized = true;

    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:Cache', `Initialized cache with ${repliedTweetsCache.size} tweet IDs`);
    }
  } catch (error) {
    console.error('[SM ReplyTracker] Error initializing cache:', error);
    repliedTweetsCache = new Set();
    isCacheInitialized = true;
  }
}

// ==========================================
// CLICK HANDLER INTEGRATION  
// ==========================================

/**
 * Attach click handlers to the "Reply" button in the compose dialog
 * This fires when user actually submits a reply, not when they open the dialog
 */
function attachReplySubmitHandlers() {
  const observer = new MutationObserver(() => {
    // Find the Reply submit button in dialogs (not feed buttons)
    const replyDialogs = document.querySelectorAll('[role="dialog"]');
    
    replyDialogs.forEach(dialog => {
      // Find the Reply button in this dialog
      const replyButton = dialog.querySelector('[data-testid="tweetButton"]:not(.sm-reply-tracked)');
      
      if (replyButton) {
        // Mark as tracked
        replyButton.classList.add('sm-reply-tracked');
        
        // Add click listener
        replyButton.addEventListener('click', (e) => {
          // Find the original tweet in the dialog (the one being replied to)
          const originalTweet = dialog.querySelector('[data-testid="tweet"]');
          
          if (!originalTweet) {
            if (REPLY_TRACKER_CONFIG.DEBUG) {
              logDebug('Twitter:ReplyTracker:Submit', 'Could not find original tweet in dialog');
            }
            return;
          }
          
          // Extract tweet ID from the original tweet
          const tweetLink = originalTweet.querySelector('a[href*="/status/"]');
          const tweetId = tweetLink?.href.split('/status/')[1]?.split('?')[0];
          
          if (tweetId) {
            if (REPLY_TRACKER_CONFIG.DEBUG) {
              logDebug('Twitter:ReplyTracker:Submit', `Reply submitted for tweet: ${tweetId}`);
            }
            
            // Store the replied tweet
            addRepliedTweet(tweetId).then(() => {
              // Update cache immediately
              repliedTweetsCache.add(tweetId);
              
              // Find and mark the reply button in the feed
              setTimeout(() => {
                const feedTweet = document.querySelector(`[data-testid="tweet"] a[href*="/status/${tweetId}"]`)?.closest('[data-testid="tweet"]');
                if (feedTweet) {
                  const feedReplyButton = feedTweet.querySelector('[data-testid="reply"]');
                  if (feedReplyButton) {
                    markReplyIconAsFilled(feedReplyButton);
                  }
                }
              }, 100);
              
              if (REPLY_TRACKER_CONFIG.DEBUG) {
                logDebug('Twitter:ReplyTracker:Submit', `Stored replied tweet: ${tweetId}`);
              }
            }).catch(err => {
              console.error('[SM ReplyTracker] Failed to store replied tweet:', err);
            });
          } else {
            if (REPLY_TRACKER_CONFIG.DEBUG) {
              logDebug('Twitter:ReplyTracker:Submit', 'Could not extract tweet ID from dialog');
            }
          }
        }, { passive: true });
        
        if (REPLY_TRACKER_CONFIG.DEBUG) {
          logDebug('Twitter:ReplyTracker:Handlers', 'Attached handler to Reply submit button');
        }
      }
    });
  });

  // Observe the entire document for new dialogs
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  logDebug('Twitter:ReplyTracker', 'Reply submit handlers observer started');
}

/**
 * Check all visible tweets and mark replied ones on page load/scroll
 */
function checkVisibleTweets() {
  const visibleTweets = document.querySelectorAll('[data-testid="tweet"]');
  
  visibleTweets.forEach(async (tweetElement) => {
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    const tweetId = tweetLink?.href.split('/status/')[1]?.split('?')[0];
    
    if (tweetId && repliedTweetsCache.has(tweetId)) {
      const replyButton = tweetElement.querySelector('[data-testid="reply"]');
      if (replyButton && !replyButton.querySelector('.sm-replied-checkmark')) {
        markReplyIconAsFilled(replyButton);
      }
    }
  });
}

/**
 * Observe feed for new tweets and mark replied ones
 */
function observeFeedForRepliedTweets() {
  const observer = new MutationObserver(() => {
    checkVisibleTweets();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial check
  checkVisibleTweets();
  
  logDebug('Twitter:ReplyTracker', 'Feed observer started');
}

// ==========================================
// VISUAL INDICATOR
// ==========================================

/**
 * Mark a reply button with a green checkmark to indicate the user has replied
 * @param {Element} replyButton - The reply button element
 */
function markReplyIconAsFilled(replyButton) {
  if (!replyButton) return;

  // Skip if already marked
  if (replyButton.querySelector('.sm-replied-checkmark')) {
    return;
  }

  // Find the reply SVG icon
  const replyIcon = replyButton.querySelector('svg');
  if (!replyIcon) {
    if (REPLY_TRACKER_CONFIG.DEBUG) {
      logDebug('Twitter:ReplyTracker:Visual', 'Could not find SVG icon in reply button');
    }
    return;
  }

  // Create checkmark overlay
  const checkmarkContainer = document.createElement('div');
  checkmarkContainer.className = 'sm-replied-checkmark';
  checkmarkContainer.innerHTML = GREEN_CHECKMARK_SVG;
  checkmarkContainer.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Position the reply icon's parent relatively
  const iconParent = replyIcon.parentElement;
  if (iconParent) {
    const parentStyle = window.getComputedStyle(iconParent);
    if (parentStyle.position === 'static') {
      iconParent.style.position = 'relative';
    }
    iconParent.appendChild(checkmarkContainer);
  }

  if (REPLY_TRACKER_CONFIG.DEBUG) {
    logDebug('Twitter:ReplyTracker:Visual', 'Added green checkmark overlay on reply icon');
  }
}

/**
 * Inject CSS styles for replied tweets (minimal now, just for positioning)
 */
function injectRepliedStyles() {
  // Check if styles already injected
  if (document.getElementById('sm-replied-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'sm-replied-styles';
  style.textContent = `
    /* Green checkmark indicator */
    .sm-replied-checkmark {
      z-index: 10;
    }
  `;

  document.head.appendChild(style);

  if (REPLY_TRACKER_CONFIG.DEBUG) {
    logDebug('Twitter:ReplyTracker:CSS', 'Injected replied styles');
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
      // Re-check all visible tweets
      checkVisibleTweets();
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

  // Attach click handlers to Reply submit buttons in dialogs
  attachReplySubmitHandlers();
  
  // Observe feed and mark replied tweets
  observeFeedForRepliedTweets();

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

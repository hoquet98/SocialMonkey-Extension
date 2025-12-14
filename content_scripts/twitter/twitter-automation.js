/**
 * SocialMonkey Twitter Automation (EXPERIMENTAL)
 * 
 * Automated engagement bot that:
 * - Scans posts on page for backend evaluations
 * - Processes posts sequentially (no simultaneous actions)
 * - Performs actions: like, reply (in order)
 * - Waits 1-2 minutes between each POST (not each action)
 * - Toggle on/off with Ctrl+Shift+M or Ctrl+Alt+M
 */

logDebug('Twitter:Automation', '✓ Automation module loading...');

// Automation state
let isAutomationRunning = false;
let automationTimeout = null;
let lastActionTime = 0;
let isProcessingPost = false; // Prevent simultaneous actions
let processedPostIds = new Set(); // Track which posts we've already processed

// Detailed logging system
const automationLog = [];
function logAutomation(message, data = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    message,
    ...data
  };
  automationLog.push(entry);
  
  // Keep only last 200 entries
  if (automationLog.length > 200) {
    automationLog.shift();
  }
  
  // Save to localStorage
  try {
    localStorage.setItem('sm_automation_log', JSON.stringify(automationLog));
  } catch (e) {
    console.error('Failed to save automation log:', e);
  }
  
  // Also log to console
  logDebug('Twitter:Automation', message, data);
}

// Download logs as a file
function downloadAutomationLogs() {
  const logs = JSON.parse(localStorage.getItem('sm_automation_log') || '[]');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sm-automation-log-${timestamp}.json`;
  
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log(`Automation logs downloaded as ${filename}`);
}

// Make download function globally accessible
window.downloadAutomationLogs = downloadAutomationLogs;

// Configuration - pull from SOCIALMONKEY_CONFIG
const AUTOMATION_CONFIG = {
  MIN_DELAY_MS: (window.SOCIALMONKEY_CONFIG?.AUTOMATION?.DELAY_RANGE_START_SECONDS || 60) * 1000,
  MAX_DELAY_MS: (window.SOCIALMONKEY_CONFIG?.AUTOMATION?.DELAY_RANGE_END_SECONDS || 120) * 1000,
  SCROLL_DELAY_MS: (window.SOCIALMONKEY_CONFIG?.AUTOMATION?.SCROLL_DELAY_SECONDS || 3) * 1000,
  INDICATOR_ID: 'sm-automation-indicator'
};

/**
 * Get random delay between min and max (in milliseconds)
 */
function getRandomDelay() {
  const min = AUTOMATION_CONFIG.MIN_DELAY_MS;
  const max = AUTOMATION_CONFIG.MAX_DELAY_MS;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Format milliseconds to human-readable time
 */
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Create visual indicator showing automation is running
 */
function createAutomationIndicator() {
  // Remove existing indicator
  const existing = document.getElementById(AUTOMATION_CONFIG.INDICATOR_ID);
  if (existing) {
    existing.remove();
  }

  const indicator = document.createElement('div');
  indicator.id = AUTOMATION_CONFIG.INDICATOR_ID;
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease-out;
  `;

  indicator.innerHTML = `
    <div style="
      width: 8px;
      height: 8px;
      background: #4ade80;
      border-radius: 50%;
      animation: pulse 2s infinite;
    "></div>
    <span>🤖 Automation Running</span>
    <div style="
      font-size: 11px;
      opacity: 0.8;
      margin-left: 8px;
      font-weight: 400;
    " id="sm-automation-timer">Next: --</div>
  `;

  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(1.5);
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(indicator);
  return indicator;
}

/**
 * Remove automation indicator
 */
function removeAutomationIndicator() {
  const indicator = document.getElementById(AUTOMATION_CONFIG.INDICATOR_ID);
  if (indicator) {
    indicator.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => indicator.remove(), 300);
  }
}

/**
 * Update timer display in indicator
 */
function updateTimerDisplay(nextActionTime) {
  const timerEl = document.getElementById('sm-automation-timer');
  if (!timerEl || !isAutomationRunning) return;

  const now = Date.now();
  const remaining = Math.max(0, nextActionTime - now);
  timerEl.textContent = `Next: ${formatTime(remaining)}`;

  if (remaining > 0) {
    setTimeout(() => updateTimerDisplay(nextActionTime), 1000);
  }
}

/**
 * Get a unique ID for a tweet element
 */
function getTweetId(tweetElement) {
  // Try to get tweet ID from the element's links
  const links = tweetElement.querySelectorAll('a[href*="/status/"]');
  for (const link of links) {
    const match = link.href.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }
  // Fallback: use element's position in DOM
  const allTweets = document.querySelectorAll('[data-testid="tweet"]');
  return 'pos-' + Array.from(allTweets).indexOf(tweetElement).toString();
}

/**
 * Get tweet author name for logging
 */
function getTweetAuthor(tweetElement) {
  const authorLink = tweetElement.querySelector('[data-testid="User-Name"] a');
  if (authorLink) {
    const match = authorLink.href.match(/twitter\.com\/([^/]+)|x\.com\/([^/]+)/);
    return match ? (match[1] || match[2]) : 'unknown';
  }
  return 'unknown';
}

/**
 * Get tweet text snippet for logging
 */
function getTweetText(tweetElement) {
  const tweetText = tweetElement.querySelector('[data-testid="tweetText"]');
  if (tweetText) {
    return tweetText.textContent.substring(0, 80) + '...';
  }
  return 'no text';
}

/**
 * Scan all visible posts and collect those that need actions
 * Returns array of posts with their required actions
 */
function scanPostsForActions() {
  const postsToProcess = [];
  const allTweets = document.querySelectorAll('[data-testid="tweet"]');
  
  logAutomation(`SCAN: Found ${allTweets.length} visible tweets on page`);
  
  allTweets.forEach((tweet, index) => {
    const tweetId = getTweetId(tweet);
    const author = getTweetAuthor(tweet);
    const text = getTweetText(tweet);
    
    // Skip if already processed
    if (processedPostIds.has(tweetId)) {
      logAutomation(`SCAN: Skipping tweet ${index} - already processed`, { tweetId, author });
      return;
    }
    
    const actions = {
      tweetId,
      tweet,
      author,
      text,
      shouldLike: false,
      shouldReply: false
    };
    
    // Check if backend recommended a like (icon has sm-recommend-like class)
    const hasRecommendedLike = tweet.querySelector('.sm-recommend-like');
    if (hasRecommendedLike) {
      actions.shouldLike = true;
      logAutomation(`SCAN: Tweet ${index} (@${author}) - LIKE RECOMMENDED`, { tweetId, text });
    }
    
    // Check if backend recommended a reply (icon has sm-recommend-reply class)
    const hasRecommendedReply = tweet.querySelector('.sm-recommend-reply');
    if (hasRecommendedReply) {
      actions.shouldReply = true;
      logAutomation(`SCAN: Tweet ${index} (@${author}) - REPLY RECOMMENDED`, { tweetId, text });
    }
    
    // Only add to list if there's at least one action to perform
    if (actions.shouldLike || actions.shouldReply) {
      postsToProcess.push(actions);
      logAutomation(`SCAN: Tweet ${index} (@${author}) - ADDED TO QUEUE`, { 
        tweetId, 
        shouldLike: actions.shouldLike, 
        shouldReply: actions.shouldReply,
        text 
      });
    } else {
      logAutomation(`SCAN: Tweet ${index} (@${author}) - NO ACTIONS NEEDED`, { tweetId });
    }
  });
  
  logAutomation(`SCAN COMPLETE: ${postsToProcess.length} posts queued for processing`);
  return postsToProcess;
}

/**
 * Perform like action on a tweet
 */
async function performLike(tweet, tweetId, author) {
  try {
    logAutomation(`ACTION: Starting LIKE on @${author}`, { tweetId });
    
    const likeButton = tweet.querySelector('[data-testid="like"]');
    if (!likeButton) {
      logAutomation(`ACTION: LIKE FAILED - button not found on @${author}`, { tweetId });
      return false;
    }
    
    likeButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logAutomation(`ACTION: LIKE COMPLETE on @${author}`, { tweetId });
    return true;
  } catch (error) {
    logAutomation(`ACTION: LIKE ERROR on @${author}`, { tweetId, error: error.message });
    return false;
  }
}

/**
 * Perform reply action on a tweet
 * Opens dialog, waits for Reply Starter, selects reply, sends
 */
async function performReply(tweet, tweetId, author) {
  try {
    logAutomation(`ACTION: Starting REPLY on @${author}`, { tweetId });
    
    // Step 1: Click reply button to open dialog
    const replyButton = tweet.querySelector('[data-testid="reply"]');
    if (!replyButton) {
      logAutomation(`ACTION: REPLY FAILED - reply button not found on @${author}`, { tweetId });
      return false;
    }
    
    replyButton.click();
    logAutomation(`ACTION: Reply dialog opened for @${author}`, { tweetId });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Find and click Reply Starter button
    const replyStarterBtn = document.querySelector('.socialmonkey-reply-starters-icon button');
    if (!replyStarterBtn) {
      logAutomation(`ACTION: REPLY FAILED - Reply Starter button not found for @${author}`, { tweetId });
      closeReplyDialog();
      return false;
    }
    
    replyStarterBtn.click();
    const replyWaitTime = (window.SOCIALMONKEY_CONFIG?.AUTOMATION?.REPLY_STARTER_WAIT_SECONDS || 15) * 1000;
    logAutomation(`ACTION: Reply Starter clicked for @${author}, waiting ${replyWaitTime/1000}s`, { tweetId });
    await new Promise(resolve => setTimeout(resolve, replyWaitTime));
    
    // Step 3: Expand the first category
    const categoryToggles = document.querySelectorAll('.sm-category-toggle');
    if (categoryToggles.length === 0) {
      logAutomation(`ACTION: REPLY FAILED - No categories found for @${author}`, { tweetId });
      closeReplyDialog();
      return false;
    }
    
    const firstCategory = categoryToggles[0];
    const categoryName = firstCategory.querySelector('[style*="font-weight: 600"]')?.textContent || 'unknown';
    firstCategory.click();
    logAutomation(`ACTION: Category "${categoryName}" expanded for @${author}`, { tweetId });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 4: Find suggestions in the first category
    const categoryId = firstCategory.getAttribute('data-category-id');
    const categoryContent = document.getElementById(categoryId);
    if (!categoryContent) {
      logAutomation(`ACTION: REPLY FAILED - Category content not found for @${author}`, { tweetId });
      closeReplyDialog();
      return false;
    }
    
    const suggestions = categoryContent.querySelectorAll('.sm-suggestion');
    if (suggestions.length === 0) {
      logAutomation(`ACTION: REPLY FAILED - No suggestions in category for @${author}`, { tweetId });
      closeReplyDialog();
      return false;
    }
    
    // Step 5: Select random suggestion from top 3
    const maxIndex = Math.min(2, suggestions.length - 1);
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    const selectedSuggestion = suggestions[randomIndex];
    const replyText = selectedSuggestion.textContent.substring(0, 60) + '...';
    
    selectedSuggestion.click();
    logAutomation(`ACTION: Suggestion #${randomIndex + 1} selected for @${author}`, { tweetId, replyText });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 6: Find and click Tweet button to send
    const tweetButton = document.querySelector('[data-testid="tweetButton"]');
    if (!tweetButton || tweetButton.disabled) {
      logAutomation(`ACTION: REPLY FAILED - Tweet button not found/disabled for @${author}`, { tweetId });
      closeReplyDialog();
      return false;
    }
    
    tweetButton.click();
    logAutomation(`ACTION: Reply sent to @${author}`, { tweetId });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 7: Close dialog if still open
    closeReplyDialog();
    
    logAutomation(`ACTION: REPLY COMPLETE on @${author}`, { tweetId });
    return true;
  } catch (error) {
    logAutomation(`ACTION: REPLY ERROR on @${author}`, { tweetId, error: error.message });
    closeReplyDialog();
    return false;
  }
}

/**
 * Close the reply dialog
 */
function closeReplyDialog() {
  const closeButton = document.querySelector('[data-testid="app-bar-close"]');
  if (closeButton) {
    closeButton.click();
    logDebug('Twitter:Automation', '🚪 Reply dialog closed');
  }
}

/**
 * Scroll feed down to load more tweets
 */
function scrollFeed() {
  window.scrollBy({
    top: 400,
    behavior: 'smooth'
  });
  logDebug('Twitter:Automation', '📜 Scrolling feed...');
}

/**
 * Process a single post with all its required actions
 * Performs actions sequentially: like first, then reply
 */
async function processPost(postData) {
  if (isProcessingPost) {
    logAutomation('PROCESS: Already processing another post, skipping');
    return false;
  }
  
  isProcessingPost = true;
  const { tweetId, tweet, author, text, shouldLike, shouldReply } = postData;
  
  try {
    logAutomation(`PROCESS: Starting processing for @${author}`, { 
      tweetId, 
      shouldLike, 
      shouldReply,
      text
    });
    
    // Action 1: Like (if needed)
    if (shouldLike === true) {
      logAutomation(`PROCESS: Executing LIKE for @${author}`, { tweetId });
      const likeSuccess = await performLike(tweet, tweetId, author);
      if (!likeSuccess) {
        logAutomation(`PROCESS: Like failed for @${author}, continuing...`, { tweetId });
      }
    } else {
      logAutomation(`PROCESS: Skipping LIKE for @${author} (not recommended)`, { tweetId });
    }
    
    // Action 2: Reply (if needed)
    if (shouldReply === true) {
      logAutomation(`PROCESS: Executing REPLY for @${author}`, { tweetId });
      const replySuccess = await performReply(tweet, tweetId, author);
      if (!replySuccess) {
        logAutomation(`PROCESS: Reply failed for @${author}`, { tweetId });
      }
    } else {
      logAutomation(`PROCESS: Skipping REPLY for @${author} (not high-impact)`, { tweetId });
    }
    
    // Mark this post as processed
    processedPostIds.add(tweetId);
    logAutomation(`PROCESS: COMPLETE for @${author} - marked as processed`, { tweetId });
    
    // Scroll after processing to load new content for evaluation
    scrollFeed();
    
    return true;
  } catch (error) {
    logAutomation(`PROCESS: ERROR for @${author}`, { tweetId, error: error.message });
    return false;
  } finally {
    isProcessingPost = false;
  }
}

/**
 * Main automation loop - simplified sequential processing
 */
async function runAutomationCycle() {
  if (!isAutomationRunning) return;
  if (isProcessingPost) {
    logAutomation('CYCLE: Still processing previous post, waiting 5s...');
    automationTimeout = setTimeout(() => runAutomationCycle(), 5000);
    return;
  }
  
  try {
    logAutomation('CYCLE: ========== NEW CYCLE STARTING ==========');
    
    // Scan all visible posts
    const postsToProcess = scanPostsForActions();
    
    if (postsToProcess.length === 0) {
      logAutomation('CYCLE: No posts to process, scrolling for more content');
      scrollFeed();
      
      // Try again after scroll delay
      if (isAutomationRunning) {
        automationTimeout = setTimeout(() => runAutomationCycle(), AUTOMATION_CONFIG.SCROLL_DELAY_MS);
      }
      return;
    }
    
    // Process the FIRST post in the list
    const firstPost = postsToProcess[0];
    logAutomation(`CYCLE: Processing first queued post - @${firstPost.author}`, {
      tweetId: firstPost.tweetId,
      shouldLike: firstPost.shouldLike,
      shouldReply: firstPost.shouldReply
    });
    
    await processPost(firstPost);
    
    // Schedule next post processing with random delay (1-2 minutes)
    if (isAutomationRunning) {
      const delay = getRandomDelay();
      const nextActionTime = Date.now() + delay;
      
      logAutomation(`CYCLE: Next cycle in ${formatTime(delay)}`, { delayMs: delay });
      updateTimerDisplay(nextActionTime);
      
      lastActionTime = Date.now();
      automationTimeout = setTimeout(() => runAutomationCycle(), delay);
    }
  } catch (error) {
    logAutomation('CYCLE: ERROR occurred', { error: error.message });
    
    // Retry in 30 seconds if error occurs
    if (isAutomationRunning) {
      automationTimeout = setTimeout(() => runAutomationCycle(), 30000);
    }
  }
}

/**
 * Start automation
 */
function startAutomation() {
  if (isAutomationRunning) {
    logDebug('Twitter:Automation', '⚠️ Automation already running');
    return;
  }
  
  isAutomationRunning = true;
  logDebug('Twitter:Automation', '🚀 Starting automation...');
  
  // Show indicator
  createAutomationIndicator();
  
  // Start automation cycle
  runAutomationCycle();
  
  // Show notification
  if (chrome && chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'SocialMonkey Automation Started',
      message: 'Auto-engagement is now running. Press Ctrl+Shift+M or Ctrl+Alt+M to stop.'
    });
  }
}

/**
 * Stop automation
 */
function stopAutomation() {
  if (!isAutomationRunning) {
    logDebug('Twitter:Automation', '⚠️ Automation not running');
    return;
  }
  
  isAutomationRunning = false;
  isProcessingPost = false;
  logDebug('Twitter:Automation', '🛑 Stopping automation...');
  
  // Clear timeout
  if (automationTimeout) {
    clearTimeout(automationTimeout);
    automationTimeout = null;
  }
  
  // Clear processed posts tracking
  processedPostIds.clear();
  
  // Remove indicator
  removeAutomationIndicator();
  
  // Show notification
  if (chrome && chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'SocialMonkey Automation Stopped',
      message: 'Auto-engagement has been disabled.'
    });
  }
}

/**
 * Toggle automation on/off
 */
function toggleAutomation() {
  if (isAutomationRunning) {
    stopAutomation();
  } else {
    startAutomation();
  }
}

/**
 * Listen for keyboard shortcuts (Ctrl+Shift+M or Ctrl+Alt+M)
 */
document.addEventListener('keydown', (event) => {
  // Ctrl+Shift+M or Ctrl+Alt+M
  if (event.ctrlKey && (event.shiftKey || event.altKey) && event.key === 'M') {
    event.preventDefault();
    toggleAutomation();
  }
}, { passive: false });

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleAutomation') {
    toggleAutomation();
    sendResponse({ running: isAutomationRunning });
  } else if (message.action === 'getAutomationStatus') {
    sendResponse({ running: isAutomationRunning });
  }
  return true;
});

// Log that automation is ready
logDebug('Twitter:Automation', '✓ Automation ready. Press Ctrl+Shift+M or Ctrl+Alt+M to start/stop');

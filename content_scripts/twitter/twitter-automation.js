/**
 * SocialMonkey Twitter Automation (EXPERIMENTAL)
 * 
 * Automated engagement bot that:
 * - Scans posts on page for backend evaluations
 * - Processes posts sequentially (no simultaneous actions)
 * - Performs actions: like, reply (in order)
 * - Waits 1-2 minutes between each POST (not each action)
 * - Toggle on/off with Ctrl+Alt+M
 */

logDebug('Twitter:Automation', '✓ Automation module loading...');

// Automation state
let isAutomationRunning = false;
let automationTimeout = null;
let lastActionTime = 0;
let isProcessingPost = false; // Prevent simultaneous actions
let processedPostIds = new Set(); // Track which posts we've already processed

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
  return Array.from(allTweets).indexOf(tweetElement).toString();
}

/**
 * Scan all visible posts and collect those that need actions
 * Returns array of posts with their required actions
 */
function scanPostsForActions() {
  const postsToProcess = [];
  const allTweets = document.querySelectorAll('[data-testid="tweet"]');
  
  logDebug('Twitter:Automation', `📊 Scanning ${allTweets.length} visible posts...`);
  
  allTweets.forEach(tweet => {
    const tweetId = getTweetId(tweet);
    
    // Skip if already processed
    if (processedPostIds.has(tweetId)) {
      return;
    }
    
    const actions = {
      tweetId,
      tweet,
      shouldLike: false,
      shouldReply: false
    };
    
    // Check if backend recommended a like (icon has sm-recommend-like class)
    const hasRecommendedLike = tweet.querySelector('.sm-recommend-like');
    if (hasRecommendedLike) {
      actions.shouldLike = true;
    }
    
    // Check if backend marked as high-impact (should reply)
    const hasHighImpact = tweet.querySelector('.sm-high-impact-badge');
    if (hasHighImpact) {
      actions.shouldReply = true;
    }
    
    // Only add to list if there's at least one action to perform
    if (actions.shouldLike || actions.shouldReply) {
      postsToProcess.push(actions);
    }
  });
  
  logDebug('Twitter:Automation', `✅ Found ${postsToProcess.length} posts with actions`);
  return postsToProcess;
}

/**
 * Perform like action on a tweet
 */
async function performLike(tweet) {
  try {
    logDebug('Twitter:Automation', '👍 Performing like...');
    
    const likeButton = tweet.querySelector('[data-testid="like"]');
    if (!likeButton) {
      logDebug('Twitter:Automation', '⚠️ Like button not found');
      return false;
    }
    
    likeButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logDebug('Twitter:Automation', '✅ Like completed');
    return true;
  } catch (error) {
    console.error('[SM Automation] Like failed:', error);
    return false;
  }
}

/**
 * Perform reply action on a tweet
 * Opens dialog, waits for Reply Starter, selects reply, sends
 */
async function performReply(tweet) {
  try {
    logDebug('Twitter:Automation', '💬 Performing reply...');
    
    // Step 1: Click reply button to open dialog
    const replyButton = tweet.querySelector('[data-testid="reply"]');
    if (!replyButton) {
      logDebug('Twitter:Automation', '⚠️ Reply button not found');
      return false;
    }
    
    replyButton.click();
    logDebug('Twitter:Automation', '⏳ Waiting for reply dialog...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Find and click Reply Starter button
    const replyStarterBtn = document.querySelector('.socialmonkey-reply-starters-icon button');
    if (!replyStarterBtn) {
      logDebug('Twitter:Automation', '⚠️ Reply Starter button not found, closing dialog');
      closeReplyDialog();
      return false;
    }
    
    replyStarterBtn.click();
    logDebug('Twitter:Automation', '⏳ Waiting for AI replies to load (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 3: Find and select a reply option
    const replyOptions = document.querySelectorAll('.sm-reply-option');
    if (replyOptions.length === 0) {
      logDebug('Twitter:Automation', '⚠️ No reply options found, closing dialog');
      closeReplyDialog();
      return false;
    }
    
    // Select random reply from top 3
    const maxIndex = Math.min(2, replyOptions.length - 1);
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    const selectedReply = replyOptions[randomIndex];
    
    selectedReply.click();
    logDebug('Twitter:Automation', '⏳ Reply selected, waiting for insertion...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Step 4: Find and click Tweet button to send
    const tweetButton = document.querySelector('[data-testid="tweetButton"]');
    if (!tweetButton || tweetButton.disabled) {
      logDebug('Twitter:Automation', '⚠️ Tweet button not found or disabled, closing dialog');
      closeReplyDialog();
      return false;
    }
    
    tweetButton.click();
    logDebug('Twitter:Automation', '⏳ Sending reply...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Close dialog if still open
    closeReplyDialog();
    
    logDebug('Twitter:Automation', '✅ Reply completed');
    return true;
  } catch (error) {
    console.error('[SM Automation] Reply failed:', error);
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
    top: 800,
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
    logDebug('Twitter:Automation', '⚠️ Already processing a post, skipping');
    return false;
  }
  
  isProcessingPost = true;
  const { tweetId, tweet, shouldLike, shouldReply } = postData;
  
  try {
    logDebug('Twitter:Automation', `📝 Processing post ${tweetId} - Like: ${shouldLike}, Reply: ${shouldReply}`);
    
    // Action 1: Like (if needed)
    if (shouldLike) {
      const likeSuccess = await performLike(tweet);
      if (!likeSuccess) {
        logDebug('Twitter:Automation', '⚠️ Like failed, but continuing...');
      }
    }
    
    // Action 2: Reply (if needed)
    if (shouldReply) {
      const replySuccess = await performReply(tweet);
      if (!replySuccess) {
        logDebug('Twitter:Automation', '⚠️ Reply failed');
      }
    }
    
    // Mark this post as processed
    processedPostIds.add(tweetId);
    logDebug('Twitter:Automation', `✅ Post ${tweetId} processing complete`);
    
    return true;
  } catch (error) {
    console.error('[SM Automation] Post processing error:', error);
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
    logDebug('Twitter:Automation', '⚠️ Still processing previous post, waiting...');
    automationTimeout = setTimeout(() => runAutomationCycle(), 5000);
    return;
  }
  
  try {
    logDebug('Twitter:Automation', '🔄 Running automation cycle...');
    
    // Scan all visible posts
    const postsToProcess = scanPostsForActions();
    
    if (postsToProcess.length === 0) {
      logDebug('Twitter:Automation', '📜 No posts to process, scrolling...');
      scrollFeed();
      
      // Try again after scroll delay
      if (isAutomationRunning) {
        automationTimeout = setTimeout(() => runAutomationCycle(), AUTOMATION_CONFIG.SCROLL_DELAY_MS);
      }
      return;
    }
    
    // Process the FIRST post in the list
    const firstPost = postsToProcess[0];
    await processPost(firstPost);
    
    // Schedule next post processing with random delay (1-2 minutes)
    if (isAutomationRunning) {
      const delay = getRandomDelay();
      const nextActionTime = Date.now() + delay;
      
      logDebug('Twitter:Automation', `⏰ Next post in ${formatTime(delay)}`);
      updateTimerDisplay(nextActionTime);
      
      lastActionTime = Date.now();
      automationTimeout = setTimeout(() => runAutomationCycle(), delay);
    }
  } catch (error) {
    console.error('[SM Automation] Cycle error:', error);
    
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
      message: 'Auto-engagement is now running. Press Ctrl+Alt+M to stop.'
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
 * Listen for keyboard shortcut (Ctrl+Alt+M)
 */
document.addEventListener('keydown', (event) => {
  // Ctrl+Alt+M
  if (event.ctrlKey && event.altKey && event.key === 'm') {
    event.preventDefault();
    toggleAutomation();
  }
}, { passive: false });

// Log that automation is ready
logDebug('Twitter:Automation', '✓ Automation ready. Press Ctrl+Alt+M to start/stop');

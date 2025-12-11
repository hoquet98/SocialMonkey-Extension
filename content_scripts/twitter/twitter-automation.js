/**
 * SocialMonkey Twitter Automation (EXPERIMENTAL)
 * 
 * Automated engagement bot that:
 * - Auto-likes posts marked for liking
 * - Auto-replies to posts marked for replying (using AI reply starters)
 * - Scrolls feed automatically
 * - Random delays between actions (1-2 minutes)
 * - Toggle on/off with Ctrl+Alt+M
 */

logDebug('Twitter:Automation', '✓ Automation module loading...');

// Automation state
let isAutomationRunning = false;
let automationTimeout = null;
let lastActionTime = 0;

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
 * Find tweets marked for liking (has Brand Relevance indicators)
 */
function findTweetsToLike() {
  // Look for tweets with like icons highlighted by backend
  const tweets = [];
  const allTweets = document.querySelectorAll('[data-testid="tweet"]');
  
  allTweets.forEach(tweet => {
    // Check if already processed
    if (tweet.hasAttribute('data-sm-auto-liked')) return;
    
    // Check if tweet has the sm-recommend-like class (added by backend evaluation)
    const hasRecommendedLike = tweet.querySelector('.sm-recommend-like');
    if (!hasRecommendedLike) return;
    
    // Find like button
    const likeButton = tweet.querySelector('[data-testid="like"]');
    if (likeButton) {
      tweets.push({ tweet, likeButton, action: 'like' });
    }
  });
  
  return tweets;
}

/**
 * Find tweets marked for replying (has High-Impact or reply indicators)
 */
function findTweetsToReply() {
  const tweets = [];
  const allTweets = document.querySelectorAll('[data-testid="tweet"]');
  
  allTweets.forEach(tweet => {
    // Check if already processed
    if (tweet.hasAttribute('data-sm-auto-replied')) return;
    
    // Check if tweet has High-Impact badge
    const hasHighImpact = tweet.querySelector('.sm-high-impact-badge');
    if (!hasHighImpact) return;
    
    // Find reply button
    const replyButton = tweet.querySelector('[data-testid="reply"]');
    if (replyButton) {
      tweets.push({ tweet, replyButton, action: 'reply' });
    }
  });
  
  return tweets;
}

/**
 * Click like button on a tweet
 */
async function performLike(tweetData) {
  try {
    logDebug('Twitter:Automation', '👍 Auto-liking tweet...');
    
    const { tweet, likeButton } = tweetData;
    
    // Click like button
    likeButton.click();
    
    // Mark as processed
    tweet.setAttribute('data-sm-auto-liked', 'true');
    
    logDebug('Twitter:Automation', '✅ Like completed');
    return true;
  } catch (error) {
    console.error('[SM Automation] Like failed:', error);
    return false;
  }
}

/**
 * Click reply button and wait for reply dialog, then select AI reply
 */
async function performReply(tweetData) {
  try {
    logDebug('Twitter:Automation', '💬 Auto-replying to tweet...');
    
    const { tweet, replyButton } = tweetData;
    
    // Click reply button to open dialog
    replyButton.click();
    
    // Wait for reply dialog to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find Reply Starter button
    const replyStarterBtn = document.querySelector('.socialmonkey-reply-starters-icon button');
    if (!replyStarterBtn) {
      logDebug('Twitter:Automation', '⚠️ Reply Starter button not found');
      return false;
    }
    
    // Click Reply Starter button
    replyStarterBtn.click();
    
    // Wait for AI replies to load from backend (10 seconds)
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Find first category's first 3 replies
    const replyOptions = document.querySelectorAll('.sm-reply-option');
    if (replyOptions.length === 0) {
      logDebug('Twitter:Automation', '⚠️ No reply options found');
      return false;
    }
    
    // Randomly select one of the top 3 replies
    const maxIndex = Math.min(2, replyOptions.length - 1);
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    const selectedReply = replyOptions[randomIndex];
    
    // Click the selected reply
    selectedReply.click();
    
    // Wait a bit for reply to be inserted
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find and click the Tweet button to send
    const tweetButton = document.querySelector('[data-testid="tweetButton"]');
    if (tweetButton && !tweetButton.disabled) {
      tweetButton.click();
      logDebug('Twitter:Automation', '✅ Reply sent');
      
      // Wait for reply to be sent and dialog to close
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to close the dialog if still open
      const closeButton = document.querySelector('[data-testid="app-bar-close"]');
      if (closeButton) {
        closeButton.click();
      }
      
      // Mark as processed
      tweet.setAttribute('data-sm-auto-replied', 'true');
      return true;
    } else {
      logDebug('Twitter:Automation', '⚠️ Tweet button not found or disabled');
      return false;
    }
  } catch (error) {
    console.error('[SM Automation] Reply failed:', error);
    return false;
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
 * Main automation loop
 */
async function runAutomationCycle() {
  if (!isAutomationRunning) return;
  
  try {
    logDebug('Twitter:Automation', '🔄 Running automation cycle...');
    
    // Find actions to perform
    const tweetsToLike = findTweetsToLike();
    const tweetsToReply = findTweetsToReply();
    
    logDebug('Twitter:Automation', `Found: ${tweetsToLike.length} to like, ${tweetsToReply.length} to reply`);
    
    let actionPerformed = false;
    
    // Priority: Reply first (more valuable), then like the same tweet if recommended
    if (tweetsToReply.length > 0) {
      const randomTweet = tweetsToReply[Math.floor(Math.random() * tweetsToReply.length)];
      actionPerformed = await performReply(randomTweet);
      
      // After replying, check if we should also like the same tweet
      if (actionPerformed) {
        const shouldAlsoLike = randomTweet.tweet.querySelector('.sm-recommend-like');
        const notYetLiked = !randomTweet.tweet.hasAttribute('data-sm-auto-liked');
        
        if (shouldAlsoLike && notYetLiked) {
          logDebug('Twitter:Automation', '👍 Also liking this tweet...');
          const likeButton = randomTweet.tweet.querySelector('[data-testid="like"]');
          if (likeButton) {
            await performLike({ tweet: randomTweet.tweet, likeButton });
          }
        }
      }
    } else if (tweetsToLike.length > 0) {
      const randomTweet = tweetsToLike[Math.floor(Math.random() * tweetsToLike.length)];
      actionPerformed = await performLike(randomTweet);
    }
    
    // If no actions performed, scroll to find more content
    if (!actionPerformed) {
      scrollFeed();
      // Schedule next cycle sooner (3 seconds)
      if (isAutomationRunning) {
        automationTimeout = setTimeout(() => runAutomationCycle(), AUTOMATION_CONFIG.SCROLL_DELAY_MS);
      }
      return;
    }
    
    // Schedule next action with random delay
    if (isAutomationRunning) {
      const delay = getRandomDelay();
      const nextActionTime = Date.now() + delay;
      
      logDebug('Twitter:Automation', `⏰ Next action in ${formatTime(delay)}`);
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
  logDebug('Twitter:Automation', '🛑 Stopping automation...');
  
  // Clear timeout
  if (automationTimeout) {
    clearTimeout(automationTimeout);
    automationTimeout = null;
  }
  
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

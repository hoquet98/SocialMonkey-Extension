/**
 * SocialMonkey Twitter Feature #1: High-Impact Reply Opportunity Scanner
 *
 * This module scans tweets in the feed, scores them for engagement potential,
 * and highlights high-impact reply opportunities directly in the UI.
 *
 * DOM Selectors (as of 2025):
 * - Tweet container: [data-testid="tweet"]
 * - Tweet text: [data-testid="tweetText"]
 * - Like button/count: [data-testid="like"] or [data-testid="unlike"]
 * - Reply button/count: [data-testid="reply"]
 * - Retweet button/count: [data-testid="retweet"]
 * - User name: [data-testid="User-Name"]
 *
 * These selectors may change if Twitter updates their DOM structure.
 */

logDebug('Twitter:Feature1', '✓ High-Impact Reply Scanner initializing...');

// Track processed tweets to avoid double-processing
const processedTweets = new WeakSet();

// Configuration
const CONFIG = {
  // Scoring thresholds
  HIGH_IMPACT_THRESHOLD: 70, // Score must be >= this to be marked

  // Engagement weights for scoring
  WEIGHTS: {
    likes: 1,
    replies: 3,      // Replies indicate active conversation
    retweets: 2,
    recency: 20,     // Recent tweets get bonus points
  },

  // Recency bonus (tweets posted in last X hours get bonus)
  RECENCY_HOURS: 2,

  // Minimum engagement to consider
  MIN_TOTAL_ENGAGEMENT: 5,
};

// ==========================================
// BACKEND EVALUATION SYSTEM
// ==========================================

/**
 * Backend Evaluation Queue
 *
 * This system batches tweets that pass local high-impact scoring and sends them
 * to the backend for AI-powered evaluation. The backend determines if each tweet
 * is a good candidate for reply, retweet, or like based on niche relevance.
 *
 * Flow:
 * 1. Tweet passes local high-impact threshold (MIN_LOCAL_IMPACT_SCORE_FOR_EVAL)
 * 2. Tweet added to evalQueue (if user is connected via smAccessToken)
 * 3. When batch is full OR debounce timer fires → send to backend
 * 4. Backend returns engagement recommendations (should_reply, should_retweet, should_like)
 * 5. UI updated to highlight recommended actions on the tweet
 */

// Evaluation configuration from twitter-config.js
const EVAL_CONFIG = {
  BATCH_SIZE: 20,                      // Number of tweets to batch before sending
  DEBOUNCE_MS: 1500,                   // Delay if batch isn't full
  MIN_SCORE_FOR_EVAL: 60,              // Local score threshold to queue for backend
  API_ENDPOINT: `${window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai'}${window.SOCIALMONKEY_CONFIG?.ENDPOINTS?.EVALUATE_POSTS || '/api/twitter/evaluate-posts'}`,
  DEBUG: true
};

// Evaluation queue and tracking
const evalQueue = [];                  // Tweets waiting for backend evaluation
const evalQueuedIds = new Set();       // Track IDs to avoid duplicate evaluations
let evalDebounceTimer = null;          // Timer for sending partial batches

// Map to track tweet elements by ID for UI updates after backend response
const tweetElementMap = new Map();     // Map<tweetId, tweetElement>

// Store evaluation results for re-applying when scrolling back
const evaluationResultsCache = new Map(); // Map<tweetId, evalResult>

/**
 * Get the stored access token from chrome.storage
 * @returns {Promise<string|null>} Access token or null if not connected
 */
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['smAccessToken'], (result) => {
      resolve(result.smAccessToken || null);
    });
  });
}

/**
 * Add a tweet to the backend evaluation queue
 * Only queues tweets that:
 * - Have a high enough local impact score
 * - Haven't been queued before
 * - User is connected (has access token)
 *
 * @param {Element} tweetElement - DOM element for the tweet
 * @param {Object} tweetData - Extracted tweet data
 * @param {Object} scoreResult - Local scoring result
 */
async function queueTweetForEvaluation(tweetElement, tweetData, scoreResult) {
  // Check if score meets minimum threshold for backend evaluation
  if (scoreResult.score < EVAL_CONFIG.MIN_SCORE_FOR_EVAL) {
    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Queue', `Tweet score ${scoreResult.score} below threshold ${EVAL_CONFIG.MIN_SCORE_FOR_EVAL}, skipping backend eval`);
    }
    return;
  }

  // Check if user is connected (has access token)
  const accessToken = await getAccessToken();
  if (!accessToken) {
    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Queue', 'No access token - limited mode, skipping backend eval');
    }
    return;
  }

  // Check if already queued
  if (evalQueuedIds.has(tweetData.id)) {
    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Queue', `Tweet ${tweetData.id} already queued`);
    }
    return;
  }

  // Add to queue
  evalQueue.push({
    id: tweetData.id,
    text: tweetData.text,
    authorHandle: tweetData.authorHandle,
    likes: tweetData.likes,
    replies: tweetData.replies,
    retweets: tweetData.retweets,
    timestamp: tweetData.timestamp.toISOString(),
    localScore: scoreResult.score
  });

  evalQueuedIds.add(tweetData.id);

  // Track the tweet element for later UI updates
  tweetElementMap.set(tweetData.id, tweetElement);

  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Queue', `Tweet ${tweetData.id} added to queue (${evalQueue.length}/${EVAL_CONFIG.BATCH_SIZE})`);
  }

  // Schedule batch send
  scheduleEvalBatch();
}

/**
 * Schedule sending evaluation batch to backend
 * Either sends immediately if batch is full, or sets a debounce timer
 */
function scheduleEvalBatch() {
  // If batch is full, send immediately
  if (evalQueue.length >= EVAL_CONFIG.BATCH_SIZE) {
    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Schedule', `Batch full (${evalQueue.length}), sending now`);
    }
    clearTimeout(evalDebounceTimer);
    sendEvalBatchNow();
    return;
  }

  // Otherwise, set/reset debounce timer
  clearTimeout(evalDebounceTimer);
  evalDebounceTimer = setTimeout(() => {
    if (evalQueue.length > 0) {
      if (EVAL_CONFIG.DEBUG) {
        logDebug('Twitter:Eval:Schedule', `Debounce timer fired, sending ${evalQueue.length} tweets`);
      }
      sendEvalBatchNow();
    }
  }, EVAL_CONFIG.DEBOUNCE_MS);
}

/**
 * Send current batch of tweets to backend for evaluation
 * Backend response format:
 * {
 *   "results": [
 *     {
 *       "id": "123",
 *       "priority_score": 87,
 *       "should_reply": true,
 *       "should_retweet": false,
 *       "should_like": true,
 *       "reason_summary": "Strong niche fit (AI tools) and high engagement."
 *     },
 *     ...
 *   ]
 * }
 */
async function sendEvalBatchNow() {
  // Check if queue is empty
  if (evalQueue.length === 0) {
    return;
  }

  // Extract batch (up to BATCH_SIZE tweets)
  const batchTweets = evalQueue.splice(0, EVAL_CONFIG.BATCH_SIZE);

  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Send', `Sending batch of ${batchTweets.length} tweets to backend`);
  }

  // Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    // No token - put tweets back or drop them
    // For now, we'll drop them since user disconnected
    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Send', 'No access token available, dropping batch');
    }
    // Remove from queued IDs since we're not processing them
    batchTweets.forEach(tweet => evalQueuedIds.delete(tweet.id));
    return;
  }

  try {
    // Send batch to backend via background script (avoids CORS)
    const response = await chrome.runtime.sendMessage({
      action: 'evaluateTweets',
      data: {
        platform: 'twitter',
        tweets: batchTweets
      },
      accessToken: accessToken
    });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error from background script');
    }

    const data = response.data;

    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Response', `Received ${data.results?.length || 0} results from backend`);
    }

    // Process results and update UI
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach(result => {
        const tweetElement = tweetElementMap.get(result.id);
        if (tweetElement) {
          applyEngagementRecommendations(tweetElement, result);
        } else {
          if (EVAL_CONFIG.DEBUG) {
            logDebug('Twitter:Eval:Response', `No element found for tweet ${result.id}`);
          }
        }
      });
    }

  } catch (error) {
    logDebug('Twitter:Eval:Error', `Failed to send evaluation batch: ${error.message}`);
    // Remove from queued IDs on error so they can be retried
    batchTweets.forEach(tweet => evalQueuedIds.delete(tweet.id));
  }
}

/**
 * Apply backend engagement recommendations to tweet UI
 * Highlights reply, retweet, and/or like icons based on AI evaluation
 *
 * @param {Element} tweetElement - The tweet DOM element
 * @param {Object} evalResult - Backend evaluation result
 */
function applyEngagementRecommendations(tweetElement, evalResult) {
  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Apply', `Applying recommendations for tweet ${evalResult.id}`, {
      should_reply: evalResult.should_reply,
      should_retweet: evalResult.should_retweet,
      should_like: evalResult.should_like,
      priority_score: evalResult.priority_score
    });
  }

  // Cache the result for re-applying later
  evaluationResultsCache.set(evalResult.id, evalResult);

  // Highlight reply icon if recommended
  if (evalResult.should_reply) {
    highlightReplyIcon(tweetElement, evalResult.reason_summary);
  }

  // Highlight retweet icon if recommended
  if (evalResult.should_retweet) {
    highlightRetweetIcon(tweetElement, evalResult.reason_summary);
  }

  // Highlight like icon if recommended
  if (evalResult.should_like) {
    highlightLikeIcon(tweetElement, evalResult.reason_summary);
  }
}

/**
 * Highlight the reply icon to indicate AI recommendation
 * @param {Element} tweetElement - Tweet container
 * @param {string} reasonSummary - Explanation from backend
 */
function highlightReplyIcon(tweetElement, reasonSummary) {
  const replyButton = tweetElement.querySelector('[data-testid="reply"]');
  if (!replyButton) return;

  // Find the SVG icon inside the button (not the text/number)
  const replyIcon = replyButton.querySelector('svg') || replyButton.querySelector('[class*="r-"]');
  if (!replyIcon) return;

  // Skip if already highlighted
  if (replyIcon.classList.contains('sm-recommend-reply')) {
    return;
  }

  // Add highlight class to the ICON only
  replyIcon.classList.add('sm-recommend-reply');

  // Inject CSS if not already present
  injectRecommendationStyles();

  // Add tooltip with reason
  if (reasonSummary) {
    replyButton.setAttribute('title', `💬 Recommended: ${reasonSummary}`);
  }

  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Highlight', 'Reply icon highlighted');
  }
}

/**
 * Highlight the retweet icon to indicate AI recommendation
 * @param {Element} tweetElement - Tweet container
 * @param {string} reasonSummary - Explanation from backend
 */
function highlightRetweetIcon(tweetElement, reasonSummary) {
  const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
  if (!retweetButton) return;

  // Find the SVG icon inside the button (not the text/number)
  const retweetIcon = retweetButton.querySelector('svg') || retweetButton.querySelector('[class*="r-"]');
  if (!retweetIcon) return;

  // Skip if already highlighted
  if (retweetIcon.classList.contains('sm-recommend-retweet')) {
    return;
  }

  // Add highlight class to the ICON only
  retweetIcon.classList.add('sm-recommend-retweet');

  // Inject CSS if not already present
  injectRecommendationStyles();

  // Add tooltip with reason
  if (reasonSummary) {
    retweetButton.setAttribute('title', `🔄 Recommended: ${reasonSummary}`);
  }

  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Highlight', 'Retweet icon highlighted');
  }
}

/**
 * Highlight the like icon to indicate AI recommendation
 * @param {Element} tweetElement - Tweet container
 * @param {string} reasonSummary - Explanation from backend
 */
function highlightLikeIcon(tweetElement, reasonSummary) {
  const likeButton = tweetElement.querySelector('[data-testid="like"]') ||
                      tweetElement.querySelector('[data-testid="unlike"]');
  if (!likeButton) return;

  // Find the SVG icon inside the button (not the text/number)
  const likeIcon = likeButton.querySelector('svg') || likeButton.querySelector('[class*="r-"]');
  if (!likeIcon) return;

  // Skip if already highlighted
  if (likeIcon.classList.contains('sm-recommend-like')) {
    return;
  }

  // Add highlight class to the ICON only
  likeIcon.classList.add('sm-recommend-like');

  // Inject CSS if not already present
  injectRecommendationStyles();

  // Add tooltip with reason
  if (reasonSummary) {
    likeButton.setAttribute('title', `❤️ Recommended: ${reasonSummary}`);
  }

  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Highlight', 'Like icon highlighted');
  }
}

/**
 * Inject CSS styles for engagement recommendations
 * Only injects once per page load
 */
let recommendationStylesInjected = false;
function injectRecommendationStyles() {
  if (recommendationStylesInjected) return;

  const style = document.createElement('style');
  style.textContent = `
    /* SocialMonkey AI Engagement Recommendations */

    /* Reply recommendation - Purple glow (icon only) */
    .sm-recommend-reply {
      color: #a855f7 !important;
      filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.8)) !important;
      animation: sm-pulse-reply 2s ease-in-out infinite !important;
      transform: scale(1.15) !important;
    }

    /* Retweet recommendation - Green glow (icon only) */
    .sm-recommend-retweet {
      color: #22c55e !important;
      filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.8)) !important;
      animation: sm-pulse-retweet 2s ease-in-out infinite !important;
      transform: scale(1.15) !important;
    }

    /* Like recommendation - Orange/Red glow (icon only) */
    .sm-recommend-like {
      color: #f97316 !important;
      filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.8)) !important;
      animation: sm-pulse-like 2s ease-in-out infinite !important;
      transform: scale(1.15) !important;
    }

    /* Pulse animations - icon glow only */
    @keyframes sm-pulse-reply {
      0%, 100% {
        filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.8));
      }
      50% {
        filter: drop-shadow(0 0 16px rgba(168, 85, 247, 1));
      }
    }

    @keyframes sm-pulse-retweet {
      0%, 100% {
        filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.8));
      }
      50% {
        filter: drop-shadow(0 0 16px rgba(34, 197, 94, 1));
      }
    }

    @keyframes sm-pulse-like {
      0%, 100% {
        filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.8));
      }
      50% {
        filter: drop-shadow(0 0 16px rgba(249, 115, 22, 1));
      }
    }

    /* More dramatic hover effect - icon only */
    .sm-recommend-reply:hover,
    .sm-recommend-retweet:hover,
    .sm-recommend-like:hover {
      filter: drop-shadow(0 0 20px currentColor) !important;
      transform: scale(1.25) !important;
    }
  `;

  document.head.appendChild(style);
  recommendationStylesInjected = true;

  if (EVAL_CONFIG.DEBUG) {
    logDebug('Twitter:Eval:Styles', 'Recommendation styles injected');
  }
}

/**
 * Main initialization - sets up the tweet scanner
 */
function initializeFeature1() {
  logDebug('Twitter:Feature1', 'Setting up MutationObserver for tweet feed...');

  // Initialize follower tracking (if available)
  if (window.SM_FollowerGlow) {
    window.SM_FollowerGlow.init().catch(err => {
      console.error('[SM Twitter] Failed to initialize follower tracking:', err);
    });
  }

  // Start observing the feed for new tweets
  observeFeed();

  // Also scan any tweets already in the DOM
  scanExistingTweets();

  logDebug('Twitter:Feature1', '✓ Feature initialized successfully');
}

/**
 * Scan tweets that are already loaded in the DOM
 */
function scanExistingTweets() {
  const existingTweets = document.querySelectorAll('[data-testid="tweet"]');
  logDebug('Twitter:Feature1', `Found ${existingTweets.length} existing tweets to scan`);

  existingTweets.forEach(tweetElement => {
    processTweetElement(tweetElement);
  });
}

/**
 * Set up MutationObserver to detect new tweets being added to the feed
 */
function observeFeed() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Check if the node itself is a tweet
          if (node.matches && node.matches('[data-testid="tweet"]')) {
            processTweetElement(node);
          }

          // Check for tweets within the added node
          if (node.querySelectorAll) {
            const tweets = node.querySelectorAll('[data-testid="tweet"]');
            tweets.forEach(tweet => processTweetElement(tweet));
          }
        }
      });
    });
  });

  // Observe the main timeline/feed area
  const feedContainer = document.querySelector('[aria-label="Home timeline"]') ||
                        document.querySelector('[data-testid="primaryColumn"]') ||
                        document.body;

  observer.observe(feedContainer, {
    childList: true,
    subtree: true
  });

  logDebug('Twitter:Feature1', 'MutationObserver attached to feed container');
}

/**
 * Process a single tweet element
 */
function processTweetElement(tweetElement) {
  // Skip if already processed
  if (processedTweets.has(tweetElement)) {
    return;
  }

  // Mark as processed
  processedTweets.add(tweetElement);

  // Extract tweet data
  const tweetData = extractTweetData(tweetElement);

  if (!tweetData) {
    logDebug('Twitter:Feature1:Scan', 'Failed to extract data from tweet element');
    return;
  }

  // Process the discovered tweet
  handleDiscoveredTweet(tweetElement, tweetData);

  // Apply follower glow (if available)
  if (window.SM_FollowerGlow) {
    const { authorId, authorHandle } = window.SM_FollowerGlow.extractAuthorInfo(tweetElement);
    if (authorHandle) {
      window.SM_FollowerGlow.decorateTweet(tweetElement, authorId, authorHandle).catch(err => {
        console.error('[SM Twitter] Failed to decorate tweet:', err);
      });
    }
  }
}

/**
 * Extract data from a tweet element
 *
 * @param {Element} tweetElement - The tweet container element
 * @returns {Object|null} Tweet data object or null if extraction fails
 */
function extractTweetData(tweetElement) {
  try {
    // Extract tweet ID (from link if available)
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    const id = tweetLink ? tweetLink.href.split('/status/')[1]?.split('?')[0] : null;

    // Extract author handle
    const userNameElement = tweetElement.querySelector('[data-testid="User-Name"]');
    const authorHandle = userNameElement ? extractHandle(userNameElement) : 'unknown';

    // Extract tweet text
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const text = textElement ? textElement.textContent.trim() : '';

    // Extract engagement metrics
    const likes = extractMetric(tweetElement, 'like') || extractMetric(tweetElement, 'unlike');
    const replies = extractMetric(tweetElement, 'reply');
    const retweets = extractMetric(tweetElement, 'retweet');

    // Try to extract timestamp
    const timeElement = tweetElement.querySelector('time');
    const timestamp = timeElement ? new Date(timeElement.getAttribute('datetime')) : new Date();

    const tweetData = {
      id: id || `temp_${Date.now()}`,
      authorHandle,
      text,
      likes,
      replies,
      retweets,
      timestamp,
    };

    logDebug('Twitter:Feature1:Extract', 'Extracted tweet data', {
      id: tweetData.id,
      author: tweetData.authorHandle,
      engagement: { likes, replies, retweets },
      textPreview: text.substring(0, 50) + '...'
    });

    return tweetData;

  } catch (error) {
    logDebug('Twitter:Feature1:Extract', 'Error extracting tweet data:', error);
    return null;
  }
}

/**
 * Extract username/handle from User-Name element
 */
function extractHandle(userNameElement) {
  const handleElement = userNameElement.querySelector('[href^="/"]');
  if (handleElement) {
    const href = handleElement.getAttribute('href');
    return href.split('/')[1] || 'unknown';
  }
  return 'unknown';
}

/**
 * Extract engagement metric from aria-label
 * Twitter formats these as "X replies", "Y likes", etc.
 */
function extractMetric(tweetElement, testId) {
  const button = tweetElement.querySelector(`[data-testid="${testId}"]`);
  if (!button) return 0;

  const ariaLabel = button.getAttribute('aria-label');
  if (!ariaLabel) return 0;

  // Extract number from aria-label (e.g., "42 likes" -> 42)
  const match = ariaLabel.match(/^(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/);
  if (!match) return 0;

  return parseEngagementNumber(match[1]);
}

/**
 * Parse engagement numbers (handles K, M, B suffixes)
 */
function parseEngagementNumber(str) {
  str = str.replace(/,/g, '');

  if (str.endsWith('K')) {
    return parseFloat(str) * 1000;
  } else if (str.endsWith('M')) {
    return parseFloat(str) * 1000000;
  } else if (str.endsWith('B')) {
    return parseFloat(str) * 1000000000;
  }

  return parseInt(str) || 0;
}

/**
 * Handle a discovered tweet - score it and mark if high-impact
 */
function handleDiscoveredTweet(tweetElement, tweetData) {
  // Score the tweet for engagement potential
  const scoreResult = scoreTweetForEngagement(tweetData);

  logDebug('Twitter:Feature1:Score', `Tweet scored: ${scoreResult.score}/100`, {
    id: tweetData.id,
    reasons: scoreResult.reasons
  });

  // Check if it's a high-impact opportunity
  if (isHighImpactOpportunity(scoreResult)) {
    logDebug('Twitter:Feature1:HighImpact', `✨ High-impact tweet found! Score: ${scoreResult.score}`, {
      id: tweetData.id,
      author: tweetData.authorHandle
    });

    // Mark the tweet visually
    markTweetAsHighImpact(tweetElement, tweetData, scoreResult);
  }

  // Check if we already have evaluation results cached for this tweet
  const cachedResult = evaluationResultsCache.get(tweetData.id);
  if (cachedResult) {
    if (EVAL_CONFIG.DEBUG) {
      logDebug('Twitter:Eval:Cache', `Re-applying cached recommendations for tweet ${tweetData.id}`);
    }
    // Re-apply the cached highlights
    applyEngagementRecommendations(tweetElement, cachedResult);
  } else {
    // Queue for backend evaluation if score meets threshold and user is connected
    // This runs independently of high-impact marking (backend has its own criteria)
    queueTweetForEvaluation(tweetElement, tweetData, scoreResult);
  }
}

/**
 * Score a tweet for engagement potential
 *
 * @param {Object} tweetData - The extracted tweet data
 * @returns {Object} { score: number, reasons: string[] }
 */
function scoreTweetForEngagement(tweetData) {
  const reasons = [];
  let score = 0;

  const { likes, replies, retweets, timestamp } = tweetData;
  const totalEngagement = likes + replies + retweets;

  // Minimum engagement check
  if (totalEngagement < CONFIG.MIN_TOTAL_ENGAGEMENT) {
    return { score: 0, reasons: ['Below minimum engagement threshold'] };
  }

  // === ENGAGEMENT SCORING ===

  // Likes contribute to score
  const likeScore = Math.min(likes * CONFIG.WEIGHTS.likes, 30);
  if (likeScore > 0) {
    score += likeScore;
    reasons.push(`${likes} likes (+${likeScore.toFixed(0)} pts)`);
  }

  // Replies are most valuable (indicates active conversation)
  const replyScore = Math.min(replies * CONFIG.WEIGHTS.replies, 40);
  if (replyScore > 0) {
    score += replyScore;
    reasons.push(`${replies} replies (+${replyScore.toFixed(0)} pts)`);
  }

  // Retweets show viral potential
  const retweetScore = Math.min(retweets * CONFIG.WEIGHTS.retweets, 30);
  if (retweetScore > 0) {
    score += retweetScore;
    reasons.push(`${retweets} retweets (+${retweetScore.toFixed(0)} pts)`);
  }

  // === RECENCY BONUS ===

  const hoursOld = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
  if (hoursOld <= CONFIG.RECENCY_HOURS) {
    const recencyBonus = CONFIG.WEIGHTS.recency * (1 - hoursOld / CONFIG.RECENCY_HOURS);
    score += recencyBonus;
    reasons.push(`Posted ${hoursOld.toFixed(1)}h ago (+${recencyBonus.toFixed(0)} recency pts)`);
  }

  // === ENGAGEMENT RATIO BONUS ===

  // High reply-to-like ratio suggests active discussion
  if (likes > 0) {
    const replyRatio = replies / likes;
    if (replyRatio > 0.1) { // More than 10% reply rate
      const ratioBonus = Math.min(replyRatio * 15, 15);
      score += ratioBonus;
      reasons.push(`High reply ratio: ${(replyRatio * 100).toFixed(1)}% (+${ratioBonus.toFixed(0)} pts)`);
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  return {
    score: Math.round(score),
    reasons
  };
}

/**
 * Determine if a tweet is a high-impact opportunity
 *
 * @param {Object} scoreResult - Result from scoreTweetForEngagement
 * @returns {boolean}
 */
function isHighImpactOpportunity(scoreResult) {
  return scoreResult.score >= CONFIG.HIGH_IMPACT_THRESHOLD;
}

/**
 * Mark a tweet as high-impact by injecting a visual badge
 *
 * @param {Element} tweetElement - The tweet container
 * @param {Object} tweetData - The tweet data
 * @param {Object} scoreResult - The scoring result
 */
function markTweetAsHighImpact(tweetElement, tweetData, scoreResult) {
  // Check if badge already exists
  if (tweetElement.querySelector('.sm-high-impact-badge')) {
    return; // Already marked
  }

  // PATH-BASED SELECTOR: Only inject badges in tweets within the main feed
  // This prevents injection in reply composers, modals, and other UI contexts
  const isInMainFeed = tweetElement.closest('[data-testid="ScrollSnap-List"]') !== null ||
                       tweetElement.closest('[data-testid="primaryColumn"]') !== null;

  if (!isInMainFeed) {
    logDebug('Twitter:Feature1:Badge', '⚠ Tweet not in main feed context, skipping badge injection');
    return;
  }

  // Find the engagement stats row (contains reply, retweet, like, view buttons)
  // Be specific: find the group that contains ALL the engagement buttons
  const engagementGroups = tweetElement.querySelectorAll('[role="group"]');
  let engagementRow = null;

  for (const group of engagementGroups) {
    // The real engagement row has ALL these buttons: reply, retweet, like
    const hasReply = group.querySelector('[data-testid="reply"]');
    const hasRetweet = group.querySelector('[data-testid="retweet"]');
    const hasLike = group.querySelector('[data-testid="like"]') || group.querySelector('[data-testid="unlike"]');

    // Check if already has badge to avoid duplicates across multiple groups
    const alreadyHasBadge = group.querySelector('.sm-high-impact-badge') !== null;

    if (hasReply && hasRetweet && hasLike && !alreadyHasBadge) {
      engagementRow = group;
      logDebug('Twitter:Feature1:Badge', 'Found valid engagement row in main feed', {
        hasReply: !!hasReply,
        hasRetweet: !!hasRetweet,
        hasLike: !!hasLike,
        inScrollSnapList: tweetElement.closest('[data-testid="ScrollSnap-List"]') !== null
      });
      break;
    }
  }

  if (!engagementRow) {
    logDebug('Twitter:Feature1:Badge', '⚠ Could not find valid engagement row');
    return;
  }

  // Double-check: don't inject if this group already has our badge
  if (engagementRow.querySelector('.sm-high-impact-badge')) {
    return;
  }

  // Create badge container (inline with stats) - fixed size
  const badge = document.createElement('div');
  badge.className = 'sm-high-impact-badge';
  badge.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    background: #3b82f6 !important;
    color: white !important;
    padding: 4px 10px !important;
    border-radius: 16px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    margin-left: 12px !important;
    cursor: help !important;
    position: relative !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    transition: transform 0.2s !important;
    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25) !important;
    flex-shrink: 0 !important;
    flex-grow: 0 !important;
    max-width: 150px !important;
    min-width: auto !important;
    height: 24px !important;
    line-height: 1 !important;
    vertical-align: middle !important;
    align-self: center !important;
  `;

  // Create monkey icon element (32x32 PNG with transparent background)
  const monkeyIcon = document.createElement('img');

  // Safely get icon URL with fallback
  try {
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
      monkeyIcon.src = chrome.runtime.getURL('icons/icon32.png');
    }
  } catch (e) {
    // Extension context invalidated (extension was reloaded) - stop processing
    if (e.message && e.message.includes('Extension context invalidated')) {
      console.log('[SocialMonkey] Extension reloaded - please refresh the page');
      return; // Exit early, don't create badge
    }
    console.warn('[SocialMonkey] Could not load icon:', e);
  }

  monkeyIcon.style.cssText = `
    width: 16px;
    height: 16px;
    display: inline-block;
    flex-shrink: 0;
  `;

  const scoreText = document.createElement('span');
  scoreText.style.cssText = `
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  scoreText.textContent = `High-Impact (${scoreResult.score})`;

  badge.appendChild(monkeyIcon);
  badge.appendChild(scoreText);

  // Add hover effect
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.05)';
  }, { passive: true });

  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
  }, { passive: true });

  // Create tooltip with explanation
  const tooltip = createTooltip(scoreResult);
  document.body.appendChild(tooltip); // Append to body for fixed positioning

  // Position and show tooltip on hover
  badge.addEventListener('mouseenter', () => {
    const rect = badge.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
  }, { passive: true });

  badge.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
  }, { passive: true });

  // Clean up tooltip when tweet is removed
  const observer = new MutationObserver(() => {
    if (!document.body.contains(badge)) {
      tooltip.remove();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Inject badge into engagement row
  // Make sure the engagement row can handle overflow for tooltip
  engagementRow.style.overflow = 'visible';

  // Add badge to the end of the engagement row
  engagementRow.appendChild(badge);

  logDebug('Twitter:Feature1:Badge', '✓ Badge injected successfully', {
    tweetId: tweetData.id,
    score: scoreResult.score
  });
}

/**
 * Create tooltip element explaining why the tweet is high-impact
 */
function createTooltip(scoreResult) {
  const tooltip = document.createElement('div');
  tooltip.className = 'sm-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: #1a1f35;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: normal;
    min-width: 250px;
    max-width: 350px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    z-index: 999999;
    line-height: 1.4;
    pointer-events: none;
  `;

  // Build tooltip content
  let tooltipHTML = `
    <div style="font-weight: 600; margin-bottom: 8px; color: #a5b4fc;">
      Why this is high-impact:
    </div>
    <ul style="margin: 0; padding-left: 20px; list-style: disc;">
  `;

  scoreResult.reasons.forEach(reason => {
    tooltipHTML += `<li style="margin-bottom: 4px;">${reason}</li>`;
  });

  tooltipHTML += `</ul>
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #374151; font-size: 12px; color: #9ca3af;">
      💡 High engagement + recency = great reply opportunity
    </div>
  `;

  tooltip.innerHTML = tooltipHTML;

  return tooltip;
}

// Initialize Feature #1 when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeFeature1();
  });
} else {
  // DOM already loaded
  initializeFeature1();
}

logDebug('Twitter:Feature1', '✓ Module loaded');

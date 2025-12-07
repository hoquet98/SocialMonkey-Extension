// Background Service Worker
// This runs persistently and coordinates all extension activities

// Configuration - Centralized API URLs and settings
// NOTE: This is duplicated from config.js because Manifest V3 service workers
// don't support importScripts() for local files. Keep this in sync with config.js
const SOCIALMONKEY_CONFIG = {
  API_BASE_URL: 'https://socialmonkey.ai',
  ENDPOINTS: {
    EVALUATE_POSTS: '/api/extension/twitter/evaluate-posts',
    REPLY_STARTERS: '/api/extension/twitter/reply-starters',
    EXCHANGE_CODE: '/api/extension/exchange-code',
    OAUTH_CALLBACK: '/extension/connected',
  },
  FEATURES: {
    HIGH_IMPACT_SCANNING: true,
    REPLY_STARTERS: true,
    DEBUG_MODE: false,
  },
  SETTINGS: {
    NOTIFICATION_DURATION: 3000,
    CACHE_EXPIRY: 300000,
  },
};

const API_BASE_URL = SOCIALMONKEY_CONFIG.API_BASE_URL;
const ENDPOINTS = SOCIALMONKEY_CONFIG.ENDPOINTS;

console.log('🐵 SocialMonkey Background Service Worker Started');
console.log('🔧 API Base URL:', API_BASE_URL);

// Force service worker to stay active by logging every 20 seconds
setInterval(() => {
  console.log('🐵 SocialMonkey service worker heartbeat');
}, 20000);

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('SocialMonkey installed for the first time');

    // Set default settings
    chrome.storage.sync.set({
      theme: 'dark',
      autoSchedule: true,
      notifications: true,
      platformSettings: {
        twitter: { enabled: true, autoReply: false },
        facebook: { enabled: true, autoPost: false },
        instagram: { enabled: true, autoHashtag: true },
        tiktok: { enabled: true, trendingAlerts: true },
        linkedin: { enabled: true, professionalMode: true },
        youtube: { enabled: true, analytics: true },
        reddit: { enabled: true, karmaTracking: true },
        snapchat: { enabled: true, storyReminders: true }
      }
    });

    // Open welcome page
    chrome.tabs.create({ url: 'https://socialmonkey.com/welcome' });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  switch (request.action) {
    case 'evaluateTweets':
      // Proxy API request to avoid CORS issues
      handleEvaluateTweets(request.data, request.accessToken)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'fetchReplyStarters':
      // Proxy API request to avoid CORS issues
      handleFetchReplyStarters(request.data, request.accessToken)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'capturePostData':
      handleCapturePostData(request.data, sender.tab);
      sendResponse({ success: true });
      break;

    case 'getPostSchedules':
      getPostSchedules(request.platform).then(schedules => {
        sendResponse({ schedules });
      });
      return true; // Keep channel open for async response
      break;

    case 'analyzePost':
      analyzePostContent(request.data).then(analysis => {
        sendResponse({ analysis });
      });
      return true;
      break;

    case 'getSavedDrafts':
      getSavedDrafts(request.platform).then(drafts => {
        sendResponse({ drafts });
      });
      return true;
      break;

    case 'trackEngagement':
      trackEngagement(request.data);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// ==========================================
// TWEET EVALUATION API PROXY
// ==========================================

/**
 * Handle tweet evaluation requests from content script
 * This runs in the background script to avoid CORS issues
 *
 * @param {Object} data - Request data with platform and tweets
 * @param {string} accessToken - User's access token
 * @returns {Promise<Object>} Backend response
 */
async function handleEvaluateTweets(data, accessToken) {
  console.log('[SocialMonkey:Background] Evaluating tweets batch:', data.tweets.length);

  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.EVALUATE_POSTS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[SocialMonkey:Background] Evaluation complete:', result.results?.length || 0, 'results');

    return result;

  } catch (error) {
    console.error('[SocialMonkey:Background] Evaluation error:', error);
    throw error;
  }
}

// ==========================================
// REPLY STARTERS API PROXY
// ==========================================

/**
 * Handle reply starters requests from content script
 * This runs in the background script to avoid CORS issues
 *
 * @param {Object} data - Request data with platform and tweet
 * @param {string} accessToken - User's access token
 * @returns {Promise<Object>} Backend response
 */
async function handleFetchReplyStarters(data, accessToken) {
  console.log('[SocialMonkey:Background] Fetching reply starters for tweet:', data.tweet.id);

  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REPLY_STARTERS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[SocialMonkey:Background] Reply starters received:', result.categories?.length || 0, 'categories');

    return result;

  } catch (error) {
    console.error('[SocialMonkey:Background] Reply starters error:', error);
    throw error;
  }
}

// Capture post data from the page
async function handleCapturePostData(data, tab) {
  console.log('Capturing post data:', data);

  // Save draft
  const drafts = await chrome.storage.local.get(['drafts']) || { drafts: {} };
  drafts.drafts = drafts.drafts || {};
  drafts.drafts[data.platform] = drafts.drafts[data.platform] || [];

  drafts.drafts[data.platform].push({
    id: Date.now(),
    content: data.content,
    media: data.media,
    hashtags: data.hashtags,
    savedAt: new Date().toISOString()
  });

  await chrome.storage.local.set(drafts);
}

// Get scheduled posts for a platform
async function getPostSchedules(platform) {
  const data = await chrome.storage.local.get(['scheduledPosts']);
  const allPosts = data.scheduledPosts || [];

  if (platform) {
    return allPosts.filter(post => post.platform === platform);
  }
  return allPosts;
}

// Analyze post content with AI
async function analyzePostContent(data) {
  // TODO: Connect to your AI API
  // For now, return mock analysis
  return {
    sentiment: 'positive',
    readability: 85,
    suggestedHashtags: ['#socialmedia', '#marketing', '#automation'],
    bestTimeToPost: '2:00 PM',
    engagementPrediction: 'high',
    improvements: [
      'Consider adding a question to boost engagement',
      'Your post length is optimal',
      'Add 2-3 more hashtags for better reach'
    ]
  };
}

// Get saved drafts
async function getSavedDrafts(platform) {
  const data = await chrome.storage.local.get(['drafts']);
  const allDrafts = data.drafts || {};

  if (platform) {
    return allDrafts[platform] || [];
  }
  return allDrafts;
}

// Track engagement metrics
async function trackEngagement(data) {
  console.log('Tracking engagement:', data);

  // Save metrics
  const metrics = await chrome.storage.local.get(['engagementMetrics']) || { engagementMetrics: [] };
  metrics.engagementMetrics = metrics.engagementMetrics || [];

  metrics.engagementMetrics.push({
    platform: data.platform,
    type: data.type, // like, share, comment, view
    timestamp: new Date().toISOString(),
    url: data.url
  });

  await chrome.storage.local.set(metrics);

  // Send to backend
  sendToBackend('/api/track', data);
}

// ==========================================
// BACKEND API HELPER
// ==========================================
// Send data to backend API with authentication

async function sendToBackend(endpoint, data) {
  try {
    // Get access token from storage
    const { smAccessToken } = await chrome.storage.local.get(['smAccessToken']);

    if (!smAccessToken) {
      console.warn('[SocialMonkey] No access token - feature requires authentication');
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${smAccessToken}`
      },
      body: JSON.stringify(data)
    });

    return await response.json();
  } catch (error) {
    console.error('[SocialMonkey] Backend API error:', error);
    return null;
  }
}

// ==========================================
// OAUTH CALLBACK HANDLER
// ==========================================
// Listen for OAuth callback from SocialMonkey
// Exchanges authorization code for access token

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when page fully loaded
  if (changeInfo.status !== 'complete' || !tab.url) return;

  console.log('[SocialMonkey Background] ========================================');
  console.log('[SocialMonkey Background] Tab updated - checking for OAuth callback');
  console.log('[SocialMonkey Background] Timestamp:', new Date().toISOString());
  console.log('[SocialMonkey Background] Tab ID:', tabId);
  console.log('[SocialMonkey Background] Tab URL:', tab.url);
  console.log('[SocialMonkey Background] ========================================');

  try {
    const url = new URL(tab.url);
    console.log('[SocialMonkey Background] Parsed URL components:');
    console.log('[SocialMonkey Background]   Protocol:', url.protocol);
    console.log('[SocialMonkey Background]   Host:', url.host);
    console.log('[SocialMonkey Background]   Origin:', url.origin);
    console.log('[SocialMonkey Background]   Pathname:', url.pathname);
    console.log('[SocialMonkey Background]   Search params:', url.search);

    // Check if this is the OAuth callback
    const callbackOrigin = new URL(API_BASE_URL).origin;
    console.log('[SocialMonkey Background] Expected callback configuration:');
    console.log('[SocialMonkey Background]   API_BASE_URL:', API_BASE_URL);
    console.log('[SocialMonkey Background]   Callback origin:', callbackOrigin);
    console.log('[SocialMonkey Background]   Expected pathname:', ENDPOINTS.OAUTH_CALLBACK);

    console.log('[SocialMonkey Background] Checking callback match:');
    console.log('[SocialMonkey Background]   Origin matches:', url.origin === callbackOrigin, `(${url.origin} === ${callbackOrigin})`);
    console.log('[SocialMonkey Background]   Pathname matches:', url.pathname === ENDPOINTS.OAUTH_CALLBACK, `(${url.pathname} === ${ENDPOINTS.OAUTH_CALLBACK})`);

    if (
      url.origin === callbackOrigin &&
      url.pathname === ENDPOINTS.OAUTH_CALLBACK
    ) {
      console.log('[SocialMonkey Background] ✅ OAuth callback detected!');
      console.log('[SocialMonkey Background] Full callback URL:', tab.url);

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      console.log('[SocialMonkey Background] Extracting OAuth parameters from URL:');
      console.log('[SocialMonkey Background]   Code param:', code ? `${code.substring(0, 20)}... (length: ${code.length})` : '❌ MISSING');
      console.log('[SocialMonkey Background]   State param:', state ? `${state} (length: ${state.length})` : '❌ MISSING');

      if (!code || !state) {
        console.error('[SocialMonkey Background] ❌ OAuth callback missing required parameters!');
        console.error('[SocialMonkey Background]   Has code:', !!code);
        console.error('[SocialMonkey Background]   Has state:', !!state);
        return;
      }

      console.log('[SocialMonkey Background] Retrieving stored state from chrome.storage.local...');

      // Verify state matches what we saved
      chrome.storage.local.get(['smAuthState'], ({ smAuthState }) => {
        console.log('[SocialMonkey Background] ========================================');
        console.log('[SocialMonkey Background] STATE VERIFICATION');
        console.log('[SocialMonkey Background] Received state from URL:', state);
        console.log('[SocialMonkey Background] Stored state from storage:', smAuthState || '❌ NOT FOUND');
        console.log('[SocialMonkey Background] States match:', smAuthState === state);
        console.log('[SocialMonkey Background] ========================================');

        if (!smAuthState || smAuthState !== state) {
          console.error('[SocialMonkey Background] ❌❌❌ STATE MISMATCH - SECURITY ERROR! ❌❌❌');
          console.error('[SocialMonkey Background] This could be a CSRF attack!');
          console.error('[SocialMonkey Background] Received state:', state);
          console.error('[SocialMonkey Background] Stored state:', smAuthState);
          console.error('[SocialMonkey Background] Aborting OAuth flow.');
          return;
        }

        console.log('[SocialMonkey Background] ✅ State verified successfully!');
        console.log('[SocialMonkey Background] Proceeding to exchange authorization code for access token...');

        const exchangeUrl = `${API_BASE_URL}${ENDPOINTS.EXCHANGE_CODE}`;
        const exchangePayload = { code, platform: 'twitter' };

        console.log('[SocialMonkey Background] ========================================');
        console.log('[SocialMonkey Background] TOKEN EXCHANGE REQUEST');
        console.log('[SocialMonkey Background] Endpoint:', exchangeUrl);
        console.log('[SocialMonkey Background] Method: POST');
        console.log('[SocialMonkey Background] Headers: Content-Type: application/json');
        console.log('[SocialMonkey Background] Payload:', JSON.stringify(exchangePayload, null, 2));
        console.log('[SocialMonkey Background] Request time:', new Date().toISOString());
        console.log('[SocialMonkey Background] ========================================');

        // Exchange code for access token
        fetch(exchangeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exchangePayload),
        })
          .then(res => {
            console.log('[SocialMonkey Background] ========================================');
            console.log('[SocialMonkey Background] TOKEN EXCHANGE RESPONSE RECEIVED');
            console.log('[SocialMonkey Background] Response time:', new Date().toISOString());
            console.log('[SocialMonkey Background] Status code:', res.status);
            console.log('[SocialMonkey Background] Status text:', res.statusText);
            console.log('[SocialMonkey Background] Response OK:', res.ok);
            console.log('[SocialMonkey Background] ========================================');

            if (!res.ok) {
              console.error('[SocialMonkey Background] ❌ Token exchange request failed!');
              console.error('[SocialMonkey Background] HTTP Status:', res.status);
              throw new Error(`Token exchange failed with status ${res.status}`);
            }

            return res.json();
          })
          .then(data => {
            console.log('[SocialMonkey Background] ========================================');
            console.log('[SocialMonkey Background] TOKEN EXCHANGE RESPONSE DATA');
            console.log('[SocialMonkey Background] Response keys:', Object.keys(data));
            console.log('[SocialMonkey Background] Has accessToken:', !!data.accessToken);
            console.log('[SocialMonkey Background] Has user data:', !!data.user);
            if (data.accessToken) {
              console.log('[SocialMonkey Background] Access token (first 20 chars):', data.accessToken.substring(0, 20) + '...');
              console.log('[SocialMonkey Background] Access token length:', data.accessToken.length);
            }
            if (data.user) {
              console.log('[SocialMonkey Background] User data:', JSON.stringify(data.user, null, 2));
            }
            console.log('[SocialMonkey Background] Full response (excluding token):', JSON.stringify({ ...data, accessToken: data.accessToken ? '[REDACTED]' : undefined }, null, 2));
            console.log('[SocialMonkey Background] ========================================');

            if (!data.accessToken) {
              console.error('[SocialMonkey Background] ❌ No access token in response!');
              console.error('[SocialMonkey Background] Response data:', data);
              return;
            }

            console.log('[SocialMonkey Background] ✅ Access token received successfully!');
            console.log('[SocialMonkey Background] Storing access token in chrome.storage.local...');

            // Store access token
            chrome.storage.local.set(
              { smAccessToken: data.accessToken },
              () => {
                if (chrome.runtime.lastError) {
                  console.error('[SocialMonkey Background] ❌ ERROR storing access token:', chrome.runtime.lastError);
                  return;
                }

                console.log('[SocialMonkey Background] ========================================');
                console.log('[SocialMonkey Background] ✅✅✅ ACCESS TOKEN STORED SUCCESSFULLY ✅✅✅');
                console.log('[SocialMonkey Background] Storage key: smAccessToken');
                console.log('[SocialMonkey Background] Storage time:', new Date().toISOString());
                console.log('[SocialMonkey Background] ========================================');

                // Verify storage
                chrome.storage.local.get(['smAccessToken'], (result) => {
                  console.log('[SocialMonkey Background] Verification - Retrieved token from storage');
                  console.log('[SocialMonkey Background] Token exists:', !!result.smAccessToken);
                  console.log('[SocialMonkey Background] Token matches:', result.smAccessToken === data.accessToken);
                });

                // Optional: Store user info if provided
                if (data.user) {
                  console.log('[SocialMonkey Background] Storing user data...');
                  chrome.storage.local.set({ smUser: data.user }, () => {
                    if (chrome.runtime.lastError) {
                      console.error('[SocialMonkey Background] ERROR storing user data:', chrome.runtime.lastError);
                    } else {
                      console.log('[SocialMonkey Background] ✅ User data stored successfully');
                    }
                  });
                }

                // Close the OAuth callback tab
                console.log('[SocialMonkey Background] Closing OAuth callback tab (ID:', tabId, ')');
                chrome.tabs.remove(tabId);

                // Show success notification
                console.log('[SocialMonkey Background] Showing success notification...');
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icons/icon128.png',
                  title: 'SocialMonkey Connected',
                  message: 'Your account has been connected successfully! AI features are now enabled.'
                });

                console.log('[SocialMonkey Background] ========================================');
                console.log('[SocialMonkey Background] 🎉 OAUTH FLOW COMPLETED SUCCESSFULLY! 🎉');
                console.log('[SocialMonkey Background] ========================================');
              }
            );
          })
          .catch(err => {
            console.error('[SocialMonkey Background] ========================================');
            console.error('[SocialMonkey Background] ❌❌❌ TOKEN EXCHANGE FAILED ❌❌❌');
            console.error('[SocialMonkey Background] Error time:', new Date().toISOString());
            console.error('[SocialMonkey Background] Error message:', err.message);
            console.error('[SocialMonkey Background] Error stack:', err.stack);
            console.error('[SocialMonkey Background] ========================================');

            // Show error notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'Connection Failed',
              message: 'Failed to connect your SocialMonkey account. Please try again.'
            });
          });
      });

      return; // Exit early for OAuth callback
    } else {
      console.log('[SocialMonkey Background] Not an OAuth callback - checking for social media site...');
    }

    // ==========================================
    // SOCIAL MEDIA SITE DETECTION
    // ==========================================
    // Check if it's a social media site
    const socialSites = [
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
      'tiktok.com', 'linkedin.com', 'youtube.com', 'reddit.com', 'snapchat.com'
    ];

    const isSocialSite = socialSites.some(site => tab.url.includes(site));

    if (isSocialSite) {
      console.log('Social media site detected:', tab.url);

      // Send initialization message to content script (with error handling)
      chrome.tabs.sendMessage(tabId, {
        action: 'initialize',
        url: tab.url
      }).catch(err => {
        // Ignore - content script may not be ready yet or doesn't have a listener
        console.debug('[SocialMonkey] Message send failed (expected if content script not ready):', err.message);
      });
    }
  } catch (e) {
    // Ignore invalid URLs
  }
});

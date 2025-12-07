// ==========================================
// SOCIALMONKEY AUTH UTILITIES
// ==========================================
// Helper functions for checking authentication state
// and gating features based on connection status

/**
 * Check if user has connected their SocialMonkey account
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
async function isAuthenticated() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['smAccessToken'], (result) => {
      resolve(!!result.smAccessToken);
    });
  });
}

/**
 * Get the access token if available
 * @returns {Promise<string|null>} Access token or null
 */
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['smAccessToken'], (result) => {
      resolve(result.smAccessToken || null);
    });
  });
}

/**
 * Make an authenticated API request to SocialMonkey backend
 * @param {string} endpoint - API endpoint (e.g., '/niche/score')
 * @param {object} data - Request payload
 * @returns {Promise<object|null>} Response data or null
 */
async function apiRequest(endpoint, data) {
  try {
    const token = await getAccessToken();

    if (!token) {
      console.warn('[SocialMonkey] API request requires authentication');
      return null;
    }

    const API_BASE_URL = window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai';
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error('[SocialMonkey] API request failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[SocialMonkey] API request error:', error);
    return null;
  }
}

/**
 * Check if a specific feature is available (requires authentication)
 * @param {string} feature - Feature name
 * @returns {Promise<boolean>} True if feature is available
 */
async function isFeatureAvailable(feature) {
  const authenticated = await isAuthenticated();

  // Features that require authentication
  const authRequiredFeatures = [
    'niche-scoring',
    'reply-starters',
    'who-to-follow',
    'ai-content',
    'sentiment-analysis',
    'scheduling'
  ];

  // Features that work without authentication
  const limitedFeatures = [
    'high-impact',
    'engagement-tracking',
    'local-scoring'
  ];

  if (authRequiredFeatures.includes(feature)) {
    return authenticated;
  }

  if (limitedFeatures.includes(feature)) {
    return true; // Always available
  }

  return false;
}

/**
 * Show a tooltip/notification that a feature requires authentication
 * @param {string} feature - Feature name
 */
function showAuthRequiredNotification(feature) {
  const message = `${feature} requires a connected SocialMonkey account. Click the extension icon to connect.`;

  // You can customize this to show a nicer UI tooltip
  console.log('[SocialMonkey]', message);

  // Optional: Create a small toast notification in the page
  const toast = document.createElement('div');
  toast.className = 'sm-auth-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1a1f35;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #3b82f6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-size: 13px;
    max-width: 300px;
    line-height: 1.4;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

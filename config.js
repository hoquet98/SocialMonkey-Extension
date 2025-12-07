// SocialMonkey Extension Configuration
// Centralized configuration for API endpoints and feature flags

const SOCIALMONKEY_CONFIG = {
  // API Configuration
  // Change this to your dev server URL during development
  // Production: 'https://socialmonkey.ai'
  // Development: 'http://localhost:3000' or your dev server URL
  //API_BASE_URL: 'https://b97bdf83-839c-4546-95ce-99da2e78b918-00-12ls58ikhbzj5.spock.replit.dev',
  API_BASE_URL: 'https://socialmonkey.ai',
  // API Endpoints (relative to API_BASE_URL)
  ENDPOINTS: {
    EVALUATE_POSTS: '/api/extension/twitter/evaluate-posts',
    REPLY_STARTERS: '/api/extension/twitter/reply-starters',
    EXCHANGE_CODE: '/api/extension/exchange-code',
    OAUTH_CALLBACK: '/extension/connected',
  },

  // Feature Flags
  FEATURES: {
    HIGH_IMPACT_SCANNING: true,
    REPLY_STARTERS: true,
    DEBUG_MODE: false, // Enable console logging (set to false for minimal logs)
  },

  // Extension Settings
  SETTINGS: {
    NOTIFICATION_DURATION: 3000, // milliseconds
    CACHE_EXPIRY: 300000, // 5 minutes in milliseconds
  },

  // UI Text Labels
  UI: {
    REPLY_STARTER_BUTTON_TEXT: 'Reply Starter',
    POPUP_FEATURES: {
      HIGH_IMPACT: 'High-Impact tweet detection',
      BRAND_RELEVANCE: 'Reply, Repost, Like on Brand Relevance',
      REPLY_STARTERS: 'AI-powered reply starters',
      FOLLOWER_GLOW: 'Identify recent followers',
      INSPIRATIONS: 'Save inspirational posts',
    },
  },
};

// Make config available globally
if (typeof window !== 'undefined') {
  window.SOCIALMONKEY_CONFIG = SOCIALMONKEY_CONFIG;
}

// For Node.js environment (build scripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SOCIALMONKEY_CONFIG;
}

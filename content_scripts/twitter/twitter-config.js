/**
 * SocialMonkey Twitter Extension Configuration
 *
 * Centralized configuration for tweet evaluation and backend integration.
 * Adjust these values to tune performance and behavior.
 */

const TWITTER_CONFIG = {
  /**
   * Number of tweets to batch before sending to backend for evaluation.
   * Higher values = fewer API calls but longer delay before evaluation.
   * Recommended: 15-25 tweets
   */
  EVAL_BATCH_SIZE: 20,

  /**
   * Debounce timer (milliseconds) - if batch isn't full, send after this delay.
   * This ensures tweets get evaluated even if user stops scrolling.
   * Recommended: 1500-3000ms
   */
  EVAL_DEBOUNCE_MS: 1500,

  /**
   * Minimum local high-impact score (0-100) required to queue tweet for backend evaluation.
   * Tweets below this threshold only get local scoring, no backend call.
   * This reduces API usage by filtering low-value tweets client-side.
   * Recommended: 50-70 (depending on how selective you want to be)
   */
  MIN_LOCAL_IMPACT_SCORE_FOR_EVAL: 60,

  /**
   * Backend API endpoint for batch tweet evaluation
   */
  API_ENDPOINT: `${window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai'}${window.SOCIALMONKEY_CONFIG?.ENDPOINTS?.EVALUATE_POSTS || '/api/twitter/evaluate-posts'}`,

  /**
   * Enable debug logging for evaluation system
   */
  DEBUG_EVAL: true
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TWITTER_CONFIG;
}

/**
 * Reply Tracker Debug Script
 *
 * Paste this into the Chrome DevTools console on Twitter/X to debug reply tracking
 */

// Check if reply tracker is loaded
console.log('🔍 Checking Reply Tracker Status...\n');

if (window.SM_ReplyTracker) {
  console.log('✅ Reply Tracker module is loaded');
  console.log('Available functions:', Object.keys(window.SM_ReplyTracker));
} else {
  console.log('❌ Reply Tracker module NOT loaded - check if extension is active');
}

// Check storage
chrome.storage.local.get(['smRepliedTweets'], (result) => {
  console.log('\n📦 Storage Contents:');
  if (result.smRepliedTweets && result.smRepliedTweets.length > 0) {
    console.log(`Total replied tweets: ${result.smRepliedTweets.length}`);
    console.log('Last 10 replies:');
    result.smRepliedTweets.slice(0, 10).forEach((tweet, i) => {
      const date = new Date(tweet.timestamp);
      console.log(`  ${i + 1}. ID: ${tweet.id} - ${date.toLocaleString()}`);
    });
  } else {
    console.log('No replied tweets stored yet');
  }
});

// Check for reply buttons on page
setTimeout(() => {
  console.log('\n🔘 Reply Buttons on Page:');
  const replyButtons = document.querySelectorAll('[data-testid="reply"]');
  console.log(`Found ${replyButtons.length} reply buttons`);

  const trackedButtons = document.querySelectorAll('[data-testid="reply"].sm-reply-tracked');
  console.log(`Tracked buttons: ${trackedButtons.length}`);

  if (replyButtons.length > trackedButtons.length) {
    console.log(`⚠️ ${replyButtons.length - trackedButtons.length} buttons NOT tracked yet`);
  }

  // Check for filled icons
  const filledIcons = document.querySelectorAll('.sm-replied-filled');
  console.log(`\n💜 Filled (replied) icons: ${filledIcons.length}`);
}, 1000);

// Helper function to manually test a tweet ID
window.testReplyTracking = async function(tweetId) {
  console.log(`\n🧪 Testing reply tracking for tweet: ${tweetId}`);

  if (!window.SM_ReplyTracker) {
    console.log('❌ Reply Tracker not loaded');
    return;
  }

  // Add to storage
  await window.SM_ReplyTracker.addRepliedTweet(tweetId);
  console.log('✅ Added to storage');

  // Check if it's there
  const hasReplied = await window.SM_ReplyTracker.hasReplied(tweetId);
  console.log(`Has replied: ${hasReplied}`);

  // Show storage
  const stored = await window.SM_ReplyTracker.getStoredReplies();
  console.log(`Total stored: ${stored.length}`);
};

// Helper to clear all replied tweets
window.clearRepliedTweets = function() {
  chrome.storage.local.remove(['smRepliedTweets'], () => {
    console.log('✅ Cleared all replied tweets from storage');
  });
};

console.log('\n📝 Helper Functions:');
console.log('  testReplyTracking(tweetId) - Manually test tracking a tweet ID');
console.log('  clearRepliedTweets() - Clear all replied tweets from storage');
console.log('\nExample: testReplyTracking("1234567890")');

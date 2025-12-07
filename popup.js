// ==========================================
// SOCIALMONKEY POPUP - AUTH-AWARE
// ==========================================
// This popup has two states:
// 1. Not Connected: Shows welcome/connect screen
// 2. Connected: Shows full dashboard with AI features

document.addEventListener('DOMContentLoaded', function() {
  console.log('[SocialMonkey Popup] DOMContentLoaded fired');

  // Get API base URL from config
  const API_BASE_URL = window.SOCIALMONKEY_CONFIG?.API_BASE_URL || 'https://socialmonkey.ai';
  console.log('[SocialMonkey Popup] Using API Base URL:', API_BASE_URL);

  // ==========================================
  // POPULATE FEATURE TEXT LABELS FROM CONFIG
  // ==========================================
  const featureTexts = window.SOCIALMONKEY_CONFIG?.UI?.POPUP_FEATURES;
  if (featureTexts) {
    const textElements = {
      'feature-text-high-impact': featureTexts.HIGH_IMPACT,
      'feature-text-brand-relevance': featureTexts.BRAND_RELEVANCE,
      'feature-text-reply-starters': featureTexts.REPLY_STARTERS,
      'feature-text-follower-glow': featureTexts.FOLLOWER_GLOW,
      'feature-text-inspirations': featureTexts.INSPIRATIONS
    };

    Object.entries(textElements).forEach(([id, text]) => {
      const element = document.getElementById(id);
      if (element && text) {
        element.textContent = text;
      }
    });

    console.log('[SocialMonkey Popup] Feature text labels loaded from config');
  }

  try {
    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    // Not Connected View
    const notConnectedView = document.getElementById('notConnectedView');
    const connectButton = document.getElementById('connectButton');
    const limitedModeButton = document.getElementById('limitedModeButton');

    // Connected View
    const connectedView = document.getElementById('connectedView');
    const actionButton = document.getElementById('actionButton');
    const manageAccountLink = document.getElementById('manageAccountLink');
    const disconnectLink = document.getElementById('disconnectLink');

    console.log('[SocialMonkey Popup] All elements loaded successfully');

  // ==========================================
  // AUTHENTICATION STATE MANAGEMENT
  // ==========================================

  /**
   * Check if user is connected (has access token)
   * and show appropriate view
   */
  function checkAuthState() {
    chrome.storage.local.get(['smAccessToken'], function(result) {
      console.log('[SocialMonkey Popup] Checking auth state...', {
        hasToken: !!result.smAccessToken,
        tokenLength: result.smAccessToken ? result.smAccessToken.length : 0
      });

      if (result.smAccessToken) {
        // User is connected - show dashboard
        console.log('[SocialMonkey Popup] Token found - showing connected view');
        showConnectedView();
      } else {
        // User not connected - show welcome screen
        console.log('[SocialMonkey Popup] No token - showing welcome screen');
        showNotConnectedView();
      }
    });
  }

  /**
   * Show the not connected (welcome) view
   */
  function showNotConnectedView() {
    notConnectedView.style.display = 'block';
    connectedView.style.display = 'none';
  }

  /**
   * Show the connected (dashboard) view
   */
  function showConnectedView() {
    notConnectedView.style.display = 'none';
    connectedView.style.display = 'block';
  }

  // ==========================================
  // CONNECT BUTTON - OAUTH FLOW
  // ==========================================

  connectButton.addEventListener('click', function() {
    console.log('[SocialMonkey Popup] ========================================');
    console.log('[SocialMonkey Popup] CONNECT BUTTON CLICKED - Starting OAuth flow');
    console.log('[SocialMonkey Popup] Timestamp:', new Date().toISOString());
    console.log('[SocialMonkey Popup] ========================================');

    // Generate random state for OAuth security
    const state = crypto.randomUUID();
    console.log('[SocialMonkey Popup] Generated OAuth state:', state);
    console.log('[SocialMonkey Popup] State length:', state.length);

    // Save state to verify callback
    console.log('[SocialMonkey Popup] Attempting to save state to chrome.storage.local...');
    chrome.storage.local.set({ smAuthState: state }, function() {
      if (chrome.runtime.lastError) {
        console.error('[SocialMonkey Popup] ERROR saving state to storage:', chrome.runtime.lastError);
        return;
      }

      console.log('[SocialMonkey Popup] ✅ State saved successfully to chrome.storage.local');
      console.log('[SocialMonkey Popup] Stored key: smAuthState, value:', state);

      // Verify storage
      chrome.storage.local.get(['smAuthState'], function(result) {
        console.log('[SocialMonkey Popup] Verification - Retrieved stored state:', result.smAuthState);
        console.log('[SocialMonkey Popup] States match:', result.smAuthState === state);
      });

      // Open SocialMonkey connect page in new tab
      const connectUrl = `${API_BASE_URL}/extension/connect?platform=twitter&state=${state}`;
      console.log('[SocialMonkey Popup] ========================================');
      console.log('[SocialMonkey Popup] Constructed OAuth URL:');
      console.log('[SocialMonkey Popup]   Full URL:', connectUrl);
      console.log('[SocialMonkey Popup]   Base URL:', API_BASE_URL);
      console.log('[SocialMonkey Popup]   Endpoint: /extension/connect');
      console.log('[SocialMonkey Popup]   Platform: twitter');
      console.log('[SocialMonkey Popup]   State:', state);
      console.log('[SocialMonkey Popup] ========================================');

      chrome.tabs.create({ url: connectUrl }, function(tab) {
        if (chrome.runtime.lastError) {
          console.error('[SocialMonkey Popup] ERROR creating tab:', chrome.runtime.lastError);
          return;
        }

        console.log('[SocialMonkey Popup] ✅ Tab created successfully');
        console.log('[SocialMonkey Popup] Tab ID:', tab.id);
        console.log('[SocialMonkey Popup] Tab URL:', tab.url);
        console.log('[SocialMonkey Popup] User will be redirected to backend for OAuth...');

        // Show a note to the user
        alert('We opened a tab to SocialMonkey where you can log in and connect your account. After you finish, reopen this popup.');

        console.log('[SocialMonkey Popup] Closing popup...');
        // Close the popup
        window.close();
      });
    });
  });

  // ==========================================
  // LIMITED MODE BUTTON
  // ==========================================

  limitedModeButton.addEventListener('click', function() {
    // Just close the popup - extension features will work in limited mode
    alert('Limited mode: you\'ll see High-Impact tweets but no niche relevance or AI replies.');
    window.close();
  });

  // ==========================================
  // DISCONNECT LINK
  // ==========================================

  if (disconnectLink) {
    disconnectLink.addEventListener('click', function(e) {
      e.preventDefault();

      // Confirm disconnect
      if (confirm('Are you sure you want to disconnect your SocialMonkey account? You\'ll lose access to AI features.')) {
        // Remove access token and auth state
        chrome.storage.local.remove(['smAccessToken', 'smAuthState', 'smUser'], function() {
          console.log('[SocialMonkey Popup] Disconnected - cleared local storage');

          // Return to not connected view
          showNotConnectedView();

          // Optional: Open logout page to clear backend session
          // Uncomment this if you want to auto-logout from socialmonkey.ai
          // chrome.tabs.create({ url: 'https://socialmonkey.ai/logout' });
        });
      }
    });
  }

  // ==========================================
  // MANAGE ACCOUNT LINK
  // ==========================================

  if (manageAccountLink) {
    manageAccountLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
    });
  }

  // ==========================================
  // STORAGE CHANGE LISTENER (OPTIONAL)
  // ==========================================
  // Auto-switch views when smAccessToken changes
  // Useful if user completes OAuth in another tab

  chrome.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName === 'local' && changes.smAccessToken) {
      if (changes.smAccessToken.newValue) {
        // Token added - show connected view
        showConnectedView();
      } else {
        // Token removed - show not connected view
        showNotConnectedView();
      }
    }
  });

  // ==========================================
  // THEME TOGGLE
  // ==========================================

  // Load saved theme preference
  chrome.storage.sync.get(['theme'], function(result) {
    const savedTheme = result.theme || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  });

  // Theme toggle functionality
  themeToggle.addEventListener('click', function() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.body.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);

    // Save theme preference
    chrome.storage.sync.set({ theme: newTheme });
  });

  function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ==========================================
  // MAIN ACTION BUTTON (Connected View)
  // ==========================================

  if (actionButton) {
    actionButton.addEventListener('click', function() {
      // Open SocialMonkey dashboard in new tab
      chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
    });
  }

  // ==========================================
  // INITIALIZE - CHECK AUTH STATE
  // ==========================================

  checkAuthState();

  } catch (error) {
    console.error('[SocialMonkey Popup] Fatal error:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h3>Error Loading Popup</h3>
        <p>${error.message}</p>
        <p>Check console for details</p>
      </div>
    `;
  }
});

// Shared utilities for all platform content scripts

// Global debug logger - use this instead of console.log
window.logDebug = function(namespace, message, data) {
  const prefix = `[SocialMonkey${namespace ? ':' + namespace : ''}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
};

class SocialMonkeyUtils {
  constructor(platform) {
    this.platform = platform;
    this.brandColor = '#6366f1';
    this.apiBaseUrl = 'https://api.socialmonkey.com'; // Replace with your actual API
  }

  // Create SocialMonkey button with consistent styling
  createButton(text, onClick, options = {}) {
    const button = document.createElement('button');
    button.className = 'socialmonkey-btn';
    button.textContent = text;
    button.style.cssText = `
      background-color: ${options.bgColor || this.brandColor};
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = options.hoverColor || '#4f46e5';
      button.style.transform = 'scale(1.02)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = options.bgColor || this.brandColor;
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', onClick);
    return button;
  }

  // Create tooltip
  createTooltip(text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'socialmonkey-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background-color: #1a1f35;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 10000;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    return tooltip;
  }

  // Show notification
  showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'socialmonkey-notification';

    const colors = {
      info: '#6366f1',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    };

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: ${colors[type]};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span>🐵</span>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // Log platform activity
  log(action, data = {}) {
    console.log(`[SocialMonkey - ${this.platform}]`, action, data);
    // You can send analytics to your backend here
  }

  // Check if user is logged into SocialMonkey
  async isUserLoggedIn() {
    try {
      const result = await chrome.storage.sync.get(['socialmonkey_user']);
      return !!result.socialmonkey_user;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  }

  // Save user data
  async saveUserData(data) {
    try {
      await chrome.storage.sync.set({ socialmonkey_user: data });
      return true;
    } catch (error) {
      console.error('Error saving user data:', error);
      return false;
    }
  }

  // Get user data
  async getUserData() {
    try {
      const result = await chrome.storage.sync.get(['socialmonkey_user']);
      return result.socialmonkey_user || null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  // Wait for element to appear in DOM
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // Inject custom styles
  injectStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// Add animations
const animations = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;

const style = document.createElement('style');
style.textContent = animations;
document.head.appendChild(style);

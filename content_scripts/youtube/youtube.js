// YouTube Content Script
console.log('SocialMonkey - YouTube extension loaded');

const utils = new SocialMonkeyUtils('YouTube');

async function initYouTubeIntegration() {
  utils.log('Initializing YouTube integration');

  try {
    await utils.waitForElement('ytd-app');

    addVideoSchedulingFeature();
    addAnalyticsButton();

    utils.showNotification('SocialMonkey is ready on YouTube!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addVideoSchedulingFeature() {
  const button = utils.createButton('📅 Schedule with SocialMonkey', () => {
    window.open('https://socialmonkey.com/schedule?platform=youtube', '_blank');
  });

  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: #ff0000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  document.body.appendChild(button);
}

function addAnalyticsButton() {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #1a1f35;
    border-radius: 12px;
    padding: 16px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  panel.innerHTML = `
    <div style="color: white; font-family: sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span>🐵</span>
        <span style="font-weight: 600;">SocialMonkey</span>
      </div>
      <button id="sm-yt-analytics" style="
        background: #6366f1;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        width: 100%;
        font-size: 13px;
        margin-bottom: 8px;
      ">📊 View Analytics</button>
      <div style="font-size: 11px; color: #9ca3af;">
        Best upload time: Thu-Sat, 2pm-4pm
      </div>
    </div>
  `;

  panel.querySelector('#sm-yt-analytics').addEventListener('click', () => {
    window.open('https://socialmonkey.com/analytics?platform=youtube', '_blank');
  });

  document.body.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initYouTubeIntegration);
} else {
  initYouTubeIntegration();
}

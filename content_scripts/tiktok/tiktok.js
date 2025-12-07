// TikTok Content Script
console.log('SocialMonkey - TikTok extension loaded');

const utils = new SocialMonkeyUtils('TikTok');

async function initTikTokIntegration() {
  utils.log('Initializing TikTok integration');

  try {
    await utils.waitForElement('#app');

    addVideoScheduleButton();
    addTrendingHashtagSuggestions();

    utils.showNotification('SocialMonkey is ready on TikTok!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addVideoScheduleButton() {
  const button = utils.createButton('📅 Schedule Video', () => {
    window.open('https://socialmonkey.com/schedule?platform=tiktok', '_blank');
  });

  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: linear-gradient(135deg, #00f2ea 0%, #ff0050 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  document.body.appendChild(button);
}

function addTrendingHashtagSuggestions() {
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
    max-width: 200px;
  `;

  panel.innerHTML = `
    <div style="color: white; font-family: sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span>🐵</span>
        <span style="font-weight: 600; font-size: 14px;">TikTok Tips</span>
      </div>
      <ul style="font-size: 11px; color: #9ca3af; margin: 0; padding-left: 20px;">
        <li>Video optimization ready</li>
        <li>Best time: 6pm-10pm</li>
        <li>Use trending sounds</li>
        <li>Keep videos 15-30sec</li>
      </ul>
    </div>
  `;

  document.body.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTikTokIntegration);
} else {
  initTikTokIntegration();
}

// Instagram Content Script
console.log('SocialMonkey - Instagram extension loaded');

const utils = new SocialMonkeyUtils('Instagram');

async function initInstagramIntegration() {
  utils.log('Initializing Instagram integration');

  try {
    await utils.waitForElement('main');

    addScheduleFeatures();
    addImageOptimizationTips();

    utils.showNotification('SocialMonkey is ready on Instagram!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addScheduleFeatures() {
  // Instagram has a different structure - add overlay button
  const button = utils.createButton('📅 Schedule with SocialMonkey', () => {
    window.open('https://socialmonkey.com/schedule?platform=instagram', '_blank');
  });

  button.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 9999;
    background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  document.body.appendChild(button);
}

function addImageOptimizationTips() {
  // Monitor for image uploads
  const observer = new MutationObserver(() => {
    const uploadDialogs = document.querySelectorAll('[role="dialog"]');

    uploadDialogs.forEach(dialog => {
      if (dialog.querySelector('.socialmonkey-ig-tips')) return;

      const tipsPanel = document.createElement('div');
      tipsPanel.className = 'socialmonkey-ig-tips';
      tipsPanel.style.cssText = `
        background: #1a1f35;
        color: white;
        padding: 12px;
        border-radius: 8px;
        margin: 10px;
        font-size: 13px;
        font-family: sans-serif;
      `;

      tipsPanel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span>🐵</span>
          <span style="font-weight: 600;">SocialMonkey Tips</span>
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #9ca3af;">
          <li>Optimal image size: 1080x1080px</li>
          <li>Use 3-5 relevant hashtags</li>
          <li>Post during peak hours (11am-1pm)</li>
        </ul>
      `;

      const container = dialog.querySelector('[role="dialog"] > div');
      if (container) {
        container.appendChild(tipsPanel);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInstagramIntegration);
} else {
  initInstagramIntegration();
}

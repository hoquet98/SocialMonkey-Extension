// Snapchat Content Script
console.log('SocialMonkey - Snapchat extension loaded');

const utils = new SocialMonkeyUtils('Snapchat');

async function initSnapchatIntegration() {
  utils.log('Initializing Snapchat integration');

  // Note: Snapchat web has limited functionality
  // Most features are mobile-only

  try {
    addScheduleButton();
    utils.showNotification('SocialMonkey is ready on Snapchat!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addScheduleButton() {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
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
      <button id="sm-snap-schedule" style="
        background: linear-gradient(135deg, #fffc00 0%, #fffc00 100%);
        color: #000;
        border: none;
        border-radius: 6px;
        padding: 10px 16px;
        cursor: pointer;
        width: 100%;
        font-size: 13px;
        font-weight: 600;
      ">Schedule Story</button>
      <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
        💡 Best time: 10pm-1am
      </div>
    </div>
  `;

  panel.querySelector('#sm-snap-schedule').addEventListener('click', () => {
    window.open('https://socialmonkey.com/schedule?platform=snapchat', '_blank');
  });

  document.body.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSnapchatIntegration);
} else {
  initSnapchatIntegration();
}

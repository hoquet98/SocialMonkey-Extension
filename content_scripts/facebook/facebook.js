// Facebook Content Script
console.log('SocialMonkey - Facebook extension loaded');

const utils = new SocialMonkeyUtils('Facebook');

async function initFacebookIntegration() {
  utils.log('Initializing Facebook integration');

  try {
    await utils.waitForElement('[role="main"]');

    addScheduleButtonToComposer();
    addSocialMonkeyPanel();

    utils.showNotification('SocialMonkey is ready on Facebook!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addScheduleButtonToComposer() {
  const observer = new MutationObserver(() => {
    // Look for Facebook's post composer
    const composers = document.querySelectorAll('[role="dialog"]');

    composers.forEach(composer => {
      if (composer.querySelector('.socialmonkey-fb-schedule')) return;

      const postButton = composer.querySelector('[aria-label*="Post"]');
      if (postButton) {
        const scheduleBtn = utils.createButton('📅 Schedule with SocialMonkey', () => {
          utils.showNotification('Schedule feature coming soon!', 'info');
        });

        scheduleBtn.classList.add('socialmonkey-fb-schedule');
        scheduleBtn.style.marginRight = '10px';

        postButton.parentElement.insertBefore(scheduleBtn, postButton);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function addSocialMonkeyPanel() {
  // Similar to Twitter panel - add floating action panel
  const panel = createFloatingPanel('Facebook');
  document.body.appendChild(panel);
}

function createFloatingPanel(platform) {
  const panel = document.createElement('div');
  panel.className = 'socialmonkey-panel';
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
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span>🐵</span>
        <span style="font-weight: 600;">SocialMonkey</span>
      </div>
      <button id="sm-fb-schedule" style="
        background: #6366f1;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        width: 100%;
        font-size: 13px;
      ">Schedule Post</button>
    </div>
  `;

  panel.querySelector('#sm-fb-schedule').addEventListener('click', () => {
    window.open('https://socialmonkey.com/schedule?platform=facebook', '_blank');
  });

  return panel;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFacebookIntegration);
} else {
  initFacebookIntegration();
}

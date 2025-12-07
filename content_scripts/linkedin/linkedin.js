// LinkedIn Content Script
console.log('SocialMonkey - LinkedIn extension loaded');

const utils = new SocialMonkeyUtils('LinkedIn');

async function initLinkedInIntegration() {
  utils.log('Initializing LinkedIn integration');

  try {
    await utils.waitForElement('.scaffold-layout__main');

    addScheduleToPostComposer();
    addProfessionalTips();

    utils.showNotification('SocialMonkey is ready on LinkedIn!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addScheduleToPostComposer() {
  const observer = new MutationObserver(() => {
    const postButtons = document.querySelectorAll('.share-actions__primary-action');

    postButtons.forEach(postButton => {
      if (postButton.parentElement?.querySelector('.socialmonkey-li-schedule')) return;

      const scheduleBtn = utils.createButton('📅 Schedule', () => {
        window.open('https://socialmonkey.com/schedule?platform=linkedin', '_blank');
      });

      scheduleBtn.classList.add('socialmonkey-li-schedule');
      scheduleBtn.style.marginRight = '8px';

      postButton.parentElement.insertBefore(scheduleBtn, postButton);
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function addProfessionalTips() {
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
    max-width: 250px;
  `;

  panel.innerHTML = `
    <div style="color: white; font-family: sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span>🐵</span>
        <span style="font-weight: 600;">SocialMonkey</span>
      </div>
      <p style="font-size: 12px; color: #9ca3af; margin: 0 0 12px 0;">
        Professional content tips:
      </p>
      <ul style="font-size: 11px; color: #9ca3af; margin: 0; padding-left: 20px;">
        <li>Best time: Tue-Thu, 9am-12pm</li>
        <li>Engagement: Ask questions</li>
        <li>Use industry hashtags</li>
      </ul>
    </div>
  `;

  document.body.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinkedInIntegration);
} else {
  initLinkedInIntegration();
}

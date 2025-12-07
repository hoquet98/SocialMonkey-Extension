// Reddit Content Script
console.log('SocialMonkey - Reddit extension loaded');

const utils = new SocialMonkeyUtils('Reddit');

async function initRedditIntegration() {
  utils.log('Initializing Reddit integration');

  try {
    await utils.waitForElement('reddit-header-large');

    addScheduleToSubmitPage();
    addSubredditAnalytics();

    utils.showNotification('SocialMonkey is ready on Reddit!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

function addScheduleToSubmitPage() {
  const observer = new MutationObserver(() => {
    const submitButtons = document.querySelectorAll('button[type="submit"]');

    submitButtons.forEach(submitBtn => {
      if (submitBtn.textContent.includes('Post') && !submitBtn.parentElement?.querySelector('.socialmonkey-reddit-schedule')) {
        const scheduleBtn = utils.createButton('📅 Schedule', () => {
          window.open('https://socialmonkey.com/schedule?platform=reddit', '_blank');
        });

        scheduleBtn.classList.add('socialmonkey-reddit-schedule');
        scheduleBtn.style.marginRight = '8px';

        submitBtn.parentElement.insertBefore(scheduleBtn, submitBtn);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function addSubredditAnalytics() {
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
    max-width: 220px;
  `;

  panel.innerHTML = `
    <div style="color: white; font-family: sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span>🐵</span>
        <span style="font-weight: 600;">Reddit Tips</span>
      </div>
      <ul style="font-size: 11px; color: #9ca3af; margin: 0; padding-left: 20px;">
        <li>Best time: Mon-Fri, 6am-8am EST</li>
        <li>Check subreddit rules first</li>
        <li>Engage in comments</li>
        <li>Avoid self-promotion spam</li>
      </ul>
    </div>
  `;

  document.body.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRedditIntegration);
} else {
  initRedditIntegration();
}

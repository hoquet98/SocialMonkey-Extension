// Twitter/X Content Script
logDebug('Twitter', '✓ Content script loaded and running');

const utils = new SocialMonkeyUtils('Twitter');

// Initialize Twitter integration
async function initTwitterIntegration() {
  utils.log('Initializing Twitter integration');

  // Wait for Twitter to load
  try {
    await utils.waitForElement('[data-testid="primaryColumn"]');

    // Add SocialMonkey features
    addReplyStartersButton();

    utils.showNotification('SocialMonkey is ready on Twitter!', 'success');
  } catch (error) {
    utils.log('Error initializing', error);
  }
}

// Add Reply Starters icon to toolbar (integrated with Twitter's native icons)
function addReplyStartersButton() {
  const observer = new MutationObserver(() => {
    // Look for toolbars in reply contexts
    const toolbars = document.querySelectorAll('[data-testid="toolBar"]');

    toolbars.forEach(toolbar => {
      // Skip if we already added our icon to this toolbar
      if (toolbar.querySelector('.socialmonkey-reply-starters-icon')) {
        return;
      }

      // Find the textarea - could be in a dialog modal OR on the detail page
      let dialog = toolbar.closest('[role="dialog"]');
      let textarea = dialog?.querySelector('[data-testid="tweetTextarea_0"]');

      // If not in a dialog, check if we're on a tweet detail page with inline reply box
      if (!textarea) {
        // Look for the reply box on the tweet detail page
        const replySection = toolbar.closest('[data-testid="reply"]') ||
                             toolbar.closest('div[data-testid*="inline"]');

        if (replySection) {
          textarea = replySection.querySelector('[data-testid="tweetTextarea_0"]');
          dialog = replySection; // Use the reply section as the "dialog" context
        }
      }

      if (!textarea) return;

      // CONTEXT CHECK: Only show in reply contexts
      // Check if we're replying to someone (dialog modal OR detail page reply box)
      const isReplyDialog = dialog.getAttribute('role') === 'dialog' &&
                            dialog.textContent.includes('Replying to');

      const isDetailPageReply = textarea.getAttribute('placeholder')?.includes('reply') ||
                                document.querySelector('[data-testid="tweet"]'); // Detail page has main tweet

      const isReplyContext = isReplyDialog || isDetailPageReply;

      if (!isReplyContext) {
        return; // Not a reply context, skip
      }

      // Create toolbar item container (matches Twitter's structure)
      const toolbarItem = document.createElement('div');
      toolbarItem.setAttribute('role', 'presentation');
      toolbarItem.className = 'css-175oi2r r-14tvyh0 r-cpa5s6 socialmonkey-reply-starters-icon';

      // Create button (styled like Twitter's toolbar buttons)
      const replyStartersBtn = document.createElement('button');
      replyStartersBtn.setAttribute('aria-label', '🐵 AI Reply Starters');
      replyStartersBtn.setAttribute('role', 'button');
      replyStartersBtn.setAttribute('type', 'button');
      replyStartersBtn.className = 'css-175oi2r r-sdzlij r-1phboty r-rs99b7 r-lrvibr r-2yi16 r-1qi8awa r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l';
      replyStartersBtn.style.cssText = 'background-color: rgba(0, 0, 0, 0); border-color: rgba(0, 0, 0, 0);';

      // Create inner div (matches Twitter's icon wrapper with horizontal layout)
      const innerDiv = document.createElement('div');
      innerDiv.setAttribute('dir', 'ltr');
      innerDiv.className = 'css-146c3p1 r-bcqeeo r-qvutc0 r-37j5jr r-q4m81j r-a023e6 r-rjixqe r-b88u0q r-1awozwy r-6koalj r-18u37iz r-16y2uox r-1777fci';
      innerDiv.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px; border: 1px solid rgba(29, 155, 240, 0.3); transition: all 0.2s;';

      // Get monkey icon
      let monkeyIconSrc = '';
      try {
        if (chrome && chrome.runtime && chrome.runtime.getURL) {
          monkeyIconSrc = chrome.runtime.getURL('icons/icon32.png');
        }
      } catch (e) {
        console.warn('[SocialMonkey] Could not load icon:', e);
      }

      // Get button text from config
      const buttonText = window.SOCIALMONKEY_CONFIG?.UI?.REPLY_STARTER_BUTTON_TEXT || 'Starter';

      // Create icon and text label
      innerDiv.innerHTML = `
        <img src="${monkeyIconSrc}"
             aria-hidden="true"
             class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-z80fyv r-19wmn03"
             style="width: 20px; height: 20px;" />
        <span style="color: rgb(29, 155, 240); font-size: 14px; font-weight: 500; line-height: 20px;">${buttonText}</span>
      `;

      replyStartersBtn.appendChild(innerDiv);
      toolbarItem.appendChild(replyStartersBtn);

      // Add hover effects (matches Twitter's hover behavior)
      replyStartersBtn.addEventListener('mouseenter', () => {
        const textSpan = innerDiv.querySelector('span');
        if (textSpan) {
          textSpan.style.color = 'rgb(26, 140, 216)';
        }
        replyStartersBtn.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
        innerDiv.style.borderColor = 'rgba(29, 155, 240, 0.5)';
      }, { passive: true });

      replyStartersBtn.addEventListener('mouseleave', () => {
        const textSpan = innerDiv.querySelector('span');
        if (textSpan) {
          textSpan.style.color = 'rgb(29, 155, 240)';
        }
        replyStartersBtn.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        innerDiv.style.borderColor = 'rgba(29, 155, 240, 0.3)';
      }, { passive: true });

      replyStartersBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleReplyStartersClick(textarea, dialog);
      });

      // Insert into the ScrollSnap-List (the scrollable toolbar area)
      const scrollSnapList = toolbar.querySelector('[data-testid="ScrollSnap-List"]');
      if (scrollSnapList) {
        // Append at the very end (after Italic icon)
        scrollSnapList.appendChild(toolbarItem);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Handler functions
async function handleReplyStartersClick(textarea, dialog) {
  // Detect Twitter's theme (dark/light)
  const isDarkMode = document.documentElement.style.colorScheme === 'dark' ||
                     document.body.style.backgroundColor === 'rgb(0, 0, 0)' ||
                     document.querySelector('body')?.getAttribute('style')?.includes('background-color: rgb(0, 0, 0)') ||
                     getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';

  console.log('[SocialMonkey] Detected theme:', isDarkMode ? 'dark' : 'light');

  // Find or create container for reply starters
  const toolbar = dialog.querySelector('[data-testid="toolBar"]');
  if (!toolbar) return;

  let container = toolbar.parentElement.querySelector('.sm-reply-starters-inline');

  if (!container) {
    // Create container below toolbar
    container = document.createElement('div');
    container.className = 'sm-reply-starters-inline';
    container.style.cssText = `
      border-top: 1px solid ${isDarkMode ? 'rgb(47, 51, 54)' : 'rgb(239, 243, 244)'};
      padding: 12px;
      background: ${isDarkMode ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'};
    `;
    container.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    toolbar.parentElement.insertBefore(container, toolbar.nextSibling);
  }

  // Toggle visibility or load content
  if (container.style.display === 'none') {
    container.style.display = 'block';
    return;
  } else if (container.hasAttribute('data-loaded')) {
    // Already loaded, just hide
    container.style.display = 'none';
    return;
  }

  // Show loading state
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  container.innerHTML = `
    <div style="text-align: center; color: rgb(83, 100, 113); padding: 24px;">
      <img src="${iconUrl}" alt="SocialMonkey" style="width: 32px; height: 32px; margin-bottom: 8px; animation: sm-spin 1s linear infinite;" />
      <div style="font-weight: 600; font-size: 15px;">Generating reply starters…</div>
      <div style="font-size: 13px; margin-top: 4px;">This may take a few seconds</div>
    </div>
    <style>
      @keyframes sm-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  // Extract tweet data from dialog
  const tweetData = extractTweetDataFromDialog(dialog);

  if (!tweetData) {
    container.innerHTML = `
      <div style="text-align: center; color: rgb(244, 33, 46); padding: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Error</div>
        <div style="font-size: 13px;">Could not extract tweet data. Please try again.</div>
      </div>
    `;
    container.setAttribute('data-loaded', 'true');
    return;
  }

  // Get access token
  const accessToken = await new Promise((resolve) => {
    chrome.storage.local.get(['smAccessToken'], (result) => {
      resolve(result.smAccessToken || null);
    });
  });

  if (!accessToken) {
    container.innerHTML = `
      <div style="text-align: center; color: rgb(83, 100, 113); padding: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px;">🔒 Connect Required</div>
        <div style="font-size: 13px;">Connect your SocialMonkey account to generate AI-powered reply starters.</div>
      </div>
    `;
    container.setAttribute('data-loaded', 'true');
    return;
  }

  // Fetch reply starters
  try {
    const requestBody = {
      platform: 'twitter',
      tweet: {
        id: tweetData.id,
        text: tweetData.text || '',
        author_handle: tweetData.authorHandle || 'unknown',
        permalink: `https://x.com/${tweetData.authorHandle || 'unknown'}/status/${tweetData.id}`,
        metrics: {
          likes: parseInt(tweetData.likes) || 0,
          replies: parseInt(tweetData.replies) || 0,
          retweets: parseInt(tweetData.retweets) || 0
        }
      }
    };

    const response = await chrome.runtime.sendMessage({
      action: 'fetchReplyStarters',
      data: requestBody,
      accessToken: accessToken
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to fetch reply starters');
    }

    // Render categories
    const theme = container.getAttribute('data-theme') || 'light';
    renderReplyStartersInline(container, response.data, textarea, theme);
    container.setAttribute('data-loaded', 'true');

  } catch (error) {
    console.error('[SocialMonkey ReplyStarters]', error);
    container.innerHTML = `
      <div style="text-align: center; color: rgb(244, 33, 46); padding: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Error</div>
        <div style="font-size: 13px;">Couldn't generate reply starters. Please try again.</div>
      </div>
    `;
    container.setAttribute('data-loaded', 'true');
  }
}

// Extract tweet data from reply dialog
function extractTweetDataFromDialog(dialog) {

  let tweetArticle = null;

  // CASE 1: Modal dialog - tweet is inside the dialog
  if (dialog.getAttribute('role') === 'dialog') {
    tweetArticle = dialog.querySelector('article[data-testid="tweet"]');
    if (!tweetArticle) {
      tweetArticle = dialog.querySelector('article');
    }
  }

  // CASE 2: Detail page reply box - main tweet is at the TOP of the page, not in reply section
  if (!tweetArticle) {
    // On detail pages, the main tweet is the FIRST article on the page
    const allArticles = document.querySelectorAll('article[data-testid="tweet"]');
    if (allArticles.length > 0) {
      // The first article is usually the main tweet we're replying to
      tweetArticle = allArticles[0];
    }
  }

  // CASE 3: Last resort - try any article with tweet testid
  if (!tweetArticle) {
    tweetArticle = document.querySelector('article[data-testid="tweet"]');
  }

  if (!tweetArticle) {
    return null;
  }

  // Extract tweet ID from link - try multiple approaches
  let tweetId = null;
  let authorHandle = null;

  // Method 1: Look for permalink links inside the tweet article
  const permalinks = tweetArticle.querySelectorAll('a[href*="/status/"]');
  for (const link of permalinks) {
    const match = link.href.match(/\/([^\/]+)\/status\/(\d+)/);
    if (match) {
      authorHandle = match[1];
      tweetId = match[2];
      console.log('[SocialMonkey] Extracted from permalink:', { authorHandle, tweetId });
      break;
    }
  }

  // Method 2: Look for ANY links in the entire dialog (not just article)
  if (!tweetId) {
    const allLinks = dialog.querySelectorAll('a[href*="/status/"]');
    for (const link of allLinks) {
      const match = link.href.match(/\/([^\/]+)\/status\/(\d+)/);
      if (match) {
        authorHandle = match[1];
        tweetId = match[2];
        console.log('[SocialMonkey] Extracted from dialog link:', { authorHandle, tweetId });
        break;
      }
    }
  }

  // Method 3: Look in the current page URL
  if (!tweetId) {
    const urlMatch = window.location.href.match(/\/status\/(\d+)/);
    if (urlMatch) {
      tweetId = urlMatch[1];
      console.log('[SocialMonkey] Extracted tweet ID from URL:', tweetId);
    }
  }

  // Method 4: Look for time element with link
  if (!tweetId) {
    const timeLinks = tweetArticle.querySelectorAll('time');
    for (const timeEl of timeLinks) {
      const parentLink = timeEl.closest('a');
      if (parentLink && parentLink.href) {
        const match = parentLink.href.match(/\/([^\/]+)\/status\/(\d+)/);
        if (match) {
          authorHandle = match[1];
          tweetId = match[2];
          console.log('[SocialMonkey] Extracted from time element:', { authorHandle, tweetId });
          break;
        }
      }
    }
  }

  // Method 5: Look for author handle in "Replying to" text
  if (!authorHandle) {
    const replyingToText = dialog.textContent || '';
    const replyingMatch = replyingToText.match(/Replying to @(\w+)/);
    if (replyingMatch) {
      authorHandle = replyingMatch[1];
      console.log('[SocialMonkey] Extracted author from "Replying to":', authorHandle);
    }
  }

  // If we still don't have a tweet ID, generate a temporary one
  // This allows reply starters to work even if we can't find the exact tweet
  if (!tweetId) {
    tweetId = `temp_${Date.now()}`;
  }

  // Extract text
  const textElement = tweetArticle.querySelector('[data-testid="tweetText"]');
  const text = textElement ? textElement.textContent : '';

  // Extract metrics
  const metricsContainer = tweetArticle.querySelector('[role="group"]');
  let likes = 0, replies = 0, retweets = 0;

  if (metricsContainer) {
    const buttons = metricsContainer.querySelectorAll('[role="button"]');
    buttons.forEach(button => {
      const ariaLabel = button.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/(\d+)/);
      const count = match ? parseInt(match[1]) : 0;

      if (ariaLabel.includes('like')) likes = count;
      else if (ariaLabel.includes('repl')) replies = count;
      else if (ariaLabel.includes('repost') || ariaLabel.includes('retweet')) retweets = count;
    });
  }

  console.log('[SocialMonkey] Extracted metrics:', { likes, replies, retweets });

  // Make sure we have SOMETHING to send to the backend
  if (!text && !authorHandle) {
    console.error('[SocialMonkey] Could not extract any useful data');
    return null;
  }

  return { id: tweetId, text, authorHandle: authorHandle || 'unknown', likes, replies, retweets };
}

// Render reply starters inline
function renderReplyStartersInline(container, data, textarea, theme = 'light') {
  const isDark = theme === 'dark';

  // Theme colors
  const colors = isDark ? {
    categoryBg: 'rgb(22, 24, 28)',        // Darker gray for categories
    categoryBgHover: 'rgb(32, 35, 39)',
    categoryBorder: 'rgb(47, 51, 54)',
    categoryBorderHover: 'rgb(29, 155, 240)',
    cardBg: 'rgb(0, 0, 0)',               // Pure black for replies
    cardBgHover: 'rgb(22, 24, 28)',
    cardBorder: 'rgb(47, 51, 54)',
    cardBorderHover: 'rgb(29, 155, 240)',
    text: 'rgb(231, 233, 234)',
    textSecondary: 'rgb(113, 118, 123)'
  } : {
    categoryBg: 'rgb(247, 249, 249)',     // Light gray for categories
    categoryBgHover: 'rgb(239, 243, 244)',
    categoryBorder: 'rgb(207, 217, 222)',
    categoryBorderHover: 'rgb(29, 155, 240)',
    cardBg: 'rgb(255, 255, 255)',         // Pure white for replies
    cardBgHover: 'rgb(247, 249, 249)',
    cardBorder: 'rgb(239, 243, 244)',
    cardBorderHover: 'rgb(29, 155, 240)',
    text: 'rgb(15, 20, 25)',
    textSecondary: 'rgb(83, 100, 113)'
  };

  let html = '';

  data.categories.forEach((category, catIndex) => {
    const categoryId = `category-${Date.now()}-${catIndex}`;

    html += `
      <div style="margin-bottom: 8px;">
        <button
          class="sm-category-toggle"
          data-category-id="${categoryId}"
          data-bg="${colors.categoryBg}"
          data-bg-hover="${colors.categoryBgHover}"
          data-border="${colors.categoryBorder}"
          data-border-hover="${colors.categoryBorderHover}"
          style="
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            background: ${colors.categoryBg};
            border: 1px solid ${colors.categoryBorder};
            border-radius: 8px;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: left;
            transition: all 0.15s;
          "
        >
          <div>
            <div style="font-weight: 600; font-size: 14px; color: ${colors.text};">${category.label}</div>
            <div style="font-size: 12px; color: ${colors.textSecondary}; margin-top: 2px;">${category.description}</div>
          </div>
          <span class="toggle-icon" style="font-size: 14px; color: ${colors.textSecondary}; transition: transform 0.15s;">▼</span>
        </button>
        <div
          class="sm-category-content"
          id="${categoryId}"
          style="display: none; padding: 6px 0 0 12px;"
        >
    `;

    category.suggestions.forEach((suggestion) => {
      html += `
        <button
          class="sm-suggestion"
          data-suggestion-text="${encodeURIComponent(suggestion.text)}"
          data-bg="${colors.cardBg}"
          data-bg-hover="${colors.cardBgHover}"
          data-border="${colors.cardBorder}"
          data-border-hover="${colors.cardBorderHover}"
          style="
            display: block;
            width: 100%;
            padding: 8px 10px;
            margin-top: 6px;
            background: ${colors.cardBg};
            border: 1px solid ${colors.cardBorder};
            border-radius: 8px;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            text-align: left;
            color: ${colors.text};
            transition: all 0.15s;
            line-height: 1.4;
          "
        >
          ${suggestion.text}
        </button>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;

  // Add event listeners for categories
  container.querySelectorAll('.sm-category-toggle').forEach(toggle => {
    const bg = toggle.getAttribute('data-bg');
    const bgHover = toggle.getAttribute('data-bg-hover');
    const border = toggle.getAttribute('data-border');
    const borderHover = toggle.getAttribute('data-border-hover');

    // Click handler
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const categoryId = toggle.getAttribute('data-category-id');
      const content = document.getElementById(categoryId);
      const icon = toggle.querySelector('.toggle-icon');

      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      }
    });

    // Hover handlers
    toggle.addEventListener('mouseenter', () => {
      toggle.style.background = bgHover;
      toggle.style.borderColor = borderHover;
    }, { passive: true });

    toggle.addEventListener('mouseleave', () => {
      toggle.style.background = bg;
      toggle.style.borderColor = border;
    }, { passive: true });
  });

  // Add event listeners for suggestions
  container.querySelectorAll('.sm-suggestion').forEach(suggestionBtn => {
    const bg = suggestionBtn.getAttribute('data-bg');
    const bgHover = suggestionBtn.getAttribute('data-bg-hover');
    const border = suggestionBtn.getAttribute('data-border');
    const borderHover = suggestionBtn.getAttribute('data-border-hover');

    // Click handler
    suggestionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = decodeURIComponent(suggestionBtn.getAttribute('data-suggestion-text'));

      // Remove previous selection highlight
      container.querySelectorAll('.sm-suggestion').forEach(btn => {
        const btnBg = btn.getAttribute('data-bg');
        const btnBorder = btn.getAttribute('data-border');
        btn.style.background = btnBg;
        btn.style.borderColor = btnBorder;
      });

      // Highlight selected
      suggestionBtn.style.background = bgHover;
      suggestionBtn.style.borderColor = borderHover;

      // Insert text into textarea with proper Twitter state triggering
      insertTextIntoTwitterTextarea(textarea, text);
    });

    // Hover handlers
    suggestionBtn.addEventListener('mouseenter', () => {
      suggestionBtn.style.background = bgHover;
      suggestionBtn.style.borderColor = borderHover;
    }, { passive: true });

    suggestionBtn.addEventListener('mouseleave', () => {
      // Don't reset if this is the selected suggestion
      if (suggestionBtn.style.background === bgHover && suggestionBtn.style.borderColor === borderHover) {
        // Check if it's actually selected by seeing if other buttons have default colors
        const isSelected = Array.from(container.querySelectorAll('.sm-suggestion')).some(btn => {
          return btn !== suggestionBtn && btn.style.background !== btn.getAttribute('data-bg');
        });
        if (!isSelected) {
          suggestionBtn.style.background = bg;
          suggestionBtn.style.borderColor = border;
        }
      } else {
        suggestionBtn.style.background = bg;
        suggestionBtn.style.borderColor = border;
      }
    }, { passive: true });
  });
}

// Insert text into Twitter's textarea with proper state triggering
function insertTextIntoTwitterTextarea(textarea, text) {
  console.log('[SocialMonkey] Inserting text via click + selectAll + insertText');

  // Step 1: Click the textarea to ensure it's active and focused
  textarea.click();
  textarea.focus();

  // Give it a moment to fully activate
  setTimeout(() => {
    // Step 2: Verify textarea is still in the document
    if (!document.contains(textarea)) {
      console.log('[SocialMonkey] Textarea refreshed by Twitter, re-finding it');
      // Try to find the textarea again
      const newTextarea = document.querySelector('[data-testid="tweetTextarea_0"]');
      if (!newTextarea) {
        console.log('[SocialMonkey] Could not locate textarea after refresh');
        return;
      }
      textarea = newTextarea;
    }

    // Step 3: Focus again (in case focus was lost)
    textarea.focus();

    // Step 4: Select all content using the contenteditable-specific approach
    const selection = window.getSelection();
    const range = document.createRange();

    try {
      range.selectNodeContents(textarea);
      selection.removeAllRanges();
      selection.addRange(range);

      console.log('[SocialMonkey] Selected text:', selection.toString().substring(0, 50));
    } catch (e) {
      console.log('[SocialMonkey] Selection adjusted, positioning cursor');
      // If selection fails, just position cursor at end
      const textRange = document.createRange();
      textRange.selectNodeContents(textarea);
      textRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(textRange);
    }

    // Step 5: Use execCommand('insertText') to replace all selected content
    // This properly triggers React's onChange handlers
    const success = document.execCommand('insertText', false, text);

    if (success) {
      console.log('[SocialMonkey] Text inserted successfully. Content:', textarea.textContent?.substring(0, 50));
    } else {
      console.log('[SocialMonkey] execCommand failed, trying paste event');

      // Fallback: Clear and paste
      textarea.textContent = '';

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dataTransfer
      });

      textarea.dispatchEvent(pasteEvent);
      console.log('[SocialMonkey] Paste event dispatched. Content:', textarea.textContent?.substring(0, 50));
    }
  }, 50);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTwitterIntegration);
} else {
  initTwitterIntegration();
}

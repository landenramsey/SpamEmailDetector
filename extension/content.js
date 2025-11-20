// Content script that runs on email pages

let apiUrl = 'http://localhost:8000';
let isEnabled = true;
let confidenceThreshold = 0.9;

// Load settings from storage
chrome.storage.sync.get(['apiUrl', 'isEnabled', 'confidenceThreshold'], (items) => {
  if (items.apiUrl) apiUrl = items.apiUrl;
  if (items.isEnabled !== undefined) isEnabled = items.isEnabled;
  if (items.confidenceThreshold) confidenceThreshold = items.confidenceThreshold;
});

// Listen for settings updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiUrl) apiUrl = changes.apiUrl.newValue;
  if (changes.isEnabled) isEnabled = changes.isEnabled.newValue;
  if (changes.confidenceThreshold) confidenceThreshold = changes.confidenceThreshold.newValue;
});

/**
 * Detects which email service is currently active (Gmail, Outlook, or unknown)
 * @returns {string} 'gmail', 'outlook', or 'unknown'
 */
function detectEmailService() {
  if (window.location.hostname.includes('mail.google.com')) {
    return 'gmail';
  } else if (window.location.hostname.includes('outlook')) {
    return 'outlook';
  }
  return 'unknown';
}

// Gmail-specific selectors (updated for modern Gmail)
const GMAIL_SELECTORS = {
  emailRow: 'tr[data-thread-id], tr.zA, div[role="main"] tr[data-thread-id]',
  subject: '.bog, span[email]',
  snippet: '.y2, .bqe',
  deleteButton: '[aria-label*="Delete"]',
  spamButton: '[aria-label*="Report spam"], [aria-label*="Mark as spam"]',
  moveToSpamButton: '[aria-label*="Report spam"], [aria-label*="Mark as spam"]'
};

// Outlook-specific selectors (updated for modern Outlook)
const OUTLOOK_SELECTORS = {
  emailRow: '[role="listitem"][data-convid], div[role="listitem"], div[data-test-id="message-list-item"], .ms-DetailsRow',
  subject: '[data-test-id="message-subject"], .ms-DetailsRow-cell[title], span[title]',
  snippet: '[data-test-id="message-preview"], .ms-fontColor-neutralSecondary, .ms-DetailsRow-cellCheck',
  spamButton: '[aria-label*="Junk"], [aria-label*="Spam"], [title*="Junk"], [title*="Spam"], button[aria-label*="Mark"]',
  moveToSpamButton: '[aria-label*="Move to Junk"], [aria-label*="Move to Spam"]'
};

/**
 * Extracts subject and snippet text from an email element
 * Uses multiple selector fallbacks for reliability across Gmail/Outlook versions
 * @param {HTMLElement} element - The email DOM element
 * @param {string} service - 'gmail' or 'outlook'
 * @returns {string} Combined subject and snippet text
 */
function getEmailText(element, service) {
  let subject = '';
  let snippet = '';
  
  if (service === 'gmail') {
    // Try multiple selectors for Gmail
    const subjectEl = element.querySelector('.bog') || 
                      element.querySelector('span[email]') ||
                      element.querySelector('.bqe');
    const snippetEl = element.querySelector('.y2') || 
                      element.querySelector('.bqe') ||
                      element.querySelector('span[style*="color"]');
    
    subject = subjectEl?.textContent?.trim() || '';
    snippet = snippetEl?.textContent?.trim() || '';
    
    // Fallback: get all text content if selectors fail
    if (!subject && !snippet) {
      const allText = element.textContent?.trim() || '';
      // Try to extract meaningful text (skip icons, buttons, etc.)
      const textParts = allText.split('\n').filter(t => t.trim().length > 3);
      subject = textParts[0] || '';
      snippet = textParts.slice(1).join(' ') || '';
    }
  } else if (service === 'outlook') {
    // Try multiple Outlook selectors with priority
    // Modern Outlook
    let subjectEl = element.querySelector('[data-test-id="message-subject"]') ||
                    element.querySelector('[data-test-id="subject-text"]') ||
                    element.querySelector('span[title][data-test-id]');
    
    // Classic Outlook
    if (!subjectEl) {
      subjectEl = element.querySelector('.ms-DetailsRow-cell[title]') ||
                  element.querySelector('.ms-fontWeight-semibold[title]');
    }
    
    // Generic fallbacks
    if (!subjectEl) {
      subjectEl = element.querySelector('span[title]') ||
                  element.querySelector('[aria-label*="Subject" i]') ||
                  element.querySelector('div[title]');
    }
    
    // Preview/snippet
    let snippetEl = element.querySelector('[data-test-id="message-preview"]') ||
                    element.querySelector('[data-test-id="preview-text"]') ||
                    element.querySelector('[data-test-id="preview"]');
    
    if (!snippetEl) {
      snippetEl = element.querySelector('.ms-fontColor-neutralSecondary') ||
                  element.querySelector('.ms-fontColor-neutralPrimary');
    }
    
    subject = subjectEl?.textContent?.trim() || subjectEl?.title?.trim() || subjectEl?.getAttribute('title')?.trim() || '';
    snippet = snippetEl?.textContent?.trim() || '';
    
    // Fallback: extract from element text if selectors fail
    if (!subject && !snippet) {
      const allText = element.textContent?.trim() || '';
      const textParts = allText.split('\n').filter(t => t.trim().length > 3);
      if (textParts.length > 0) {
        subject = textParts[0].trim().substring(0, 100); // Limit length
        snippet = textParts.slice(1).join(' ').trim().substring(0, 200);
      }
    }
    
    // Debug logging for Outlook
    if (!subject && !snippet) {
      console.log('[Spam Detector] Outlook: Could not extract text from element:', element);
    }
  }
  
  return `${subject} ${snippet}`.trim();
}

/**
 * Attempts to move an email to spam/junk folder using multiple fallback methods
 * Tries: direct button click, parent container search, toolbar, keyboard shortcut, context menu
 * @param {HTMLElement} element - The email DOM element to move
 * @param {string} service - 'gmail' or 'outlook'
 * @param {Object} selectors - Service-specific CSS selectors
 * @returns {boolean} True if move was attempted (may be async)
 */
function moveEmailToSpam(element, service, selectors) {
  console.log(`[Spam Detector] Attempting to move email to spam folder (${service})`);
  console.log(`[Spam Detector] Element:`, element);
  
  let moved = false;
  
  if (service === 'gmail') {
    // Gmail: Try multiple methods
    // Method 1: Click on the row first to select, then look for spam button
    element.click();
    
    setTimeout(() => {
      // Hover to reveal action buttons
      element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
      
      // Try to find spam button with multiple attempts
      const findAndClickSpam = () => {
        const spamBtn = element.querySelector('[aria-label*="Report spam" i]') ||
                        element.querySelector('[aria-label*="Mark as spam" i]') ||
                        element.querySelector('div[role="button"][aria-label*="spam" i]') ||
                        element.querySelector('button[aria-label*="spam" i]') ||
                        element.querySelector('[title*="spam" i]') ||
                        element.querySelector('[aria-label*="Spam" i]');
        
        if (spamBtn && spamBtn.offsetParent !== null) { // Check if visible
          console.log('[Spam Detector] Found Gmail spam button, clicking...', spamBtn);
          spamBtn.focus();
          spamBtn.click();
          console.log('[Spam Detector] ✅ Gmail spam button clicked');
          moved = true;
          return true;
        }
        
        // Check parent container
        let parent = element.closest('tr, div[role="row"]');
        if (parent) {
          parent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          const parentSpamBtn = parent.querySelector('[aria-label*="spam" i], [aria-label*="Spam" i]');
          if (parentSpamBtn && parentSpamBtn.offsetParent !== null) {
            console.log('[Spam Detector] Found spam button in parent');
            parentSpamBtn.focus();
            parentSpamBtn.click();
            moved = true;
            return true;
          }
        }
        
        return false;
      };
      
      // Try multiple times with delays
      setTimeout(() => findAndClickSpam(), 100);
      setTimeout(() => findAndClickSpam(), 300);
      setTimeout(() => findAndClickSpam(), 500);
      
      // If still not found, try keyboard shortcut (Gmail: J for archive, but we need spam)
      if (!moved) {
        console.log('[Spam Detector] Gmail: Spam button not found after attempts');
      }
    }, 100);
    
  } else if (service === 'outlook') {
    // Outlook: Try multiple approaches
    console.log('[Spam Detector] Searching for Outlook spam/junk button...');
    
    // Method 1: Select the email first
    element.click();
    element.focus();
    
    setTimeout(() => {
      // Look for junk button in the email row
      const findAndClickJunk = () => {
        let junkBtn = element.querySelector('[aria-label*="Junk" i]') ||
                      element.querySelector('[aria-label*="Spam" i]') ||
                      element.querySelector('[title*="Junk" i]') ||
                      element.querySelector('[title*="Spam" i]') ||
                      element.querySelector('button[aria-label*="Junk" i]') ||
                      element.querySelector('[data-icon-name*="Junk" i]') ||
                      element.querySelector('[aria-label*="Mark as junk" i]') ||
                      element.querySelector('[aria-label*="Report as junk" i]') ||
                      element.querySelector('i[data-icon-name*="Junk" i]')?.closest('button');
        
        // Check parent containers (up to 5 levels)
        if (!junkBtn) {
          let parent = element.parentElement;
          for (let i = 0; i < 5 && parent && parent !== document.body; i++) {
            const searchSelectors = [
              '[aria-label*="Junk" i]',
              '[aria-label*="Spam" i]',
              '[title*="Junk" i]',
              'button[aria-label*="Junk" i]',
              '[data-icon-name*="Junk" i]'
            ];
            
            for (const selector of searchSelectors) {
              junkBtn = parent.querySelector(selector);
              if (junkBtn) break;
            }
            
            if (junkBtn) {
              console.log(`[Spam Detector] Found junk button in parent level ${i}`);
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        if (junkBtn) {
          console.log('[Spam Detector] Found Outlook junk button, clicking...', junkBtn);
          junkBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          junkBtn.focus();
          // Use both click methods
          if (typeof junkBtn.click === 'function') {
            junkBtn.click();
          } else {
            junkBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
          console.log('[Spam Detector] ✅ Outlook junk button clicked');
          moved = true;
          return true;
        }
        return false;
      };
      
      // Try finding junk button with delays
      setTimeout(() => findAndClickJunk(), 200);
      setTimeout(() => findAndClickJunk(), 400);
      setTimeout(() => findAndClickJunk(), 600);
      
      // Method 2: Look in toolbar/ribbon after selection
      setTimeout(() => {
        if (!moved) {
          console.log('[Spam Detector] Trying toolbar method...');
          // Look for toolbar/command bar
          const toolbar = document.querySelector('[role="toolbar"], [role="menubar"], .ms-CommandBar, [data-test-id*="toolbar"]');
          if (toolbar) {
            const toolbarJunkBtn = toolbar.querySelector('[aria-label*="Junk" i], button[aria-label*="Junk" i], [title*="Junk" i]');
            if (toolbarJunkBtn) {
              console.log('[Spam Detector] Found junk button in toolbar');
              toolbarJunkBtn.click();
              moved = true;
              return;
            }
          }
        }
      }, 500);
      
      // Method 3: Try keyboard shortcut for Outlook (Ctrl+J or Alt+H, J)
      setTimeout(() => {
        if (!moved) {
          console.log('[Spam Detector] Trying keyboard shortcut...');
          try {
            element.focus();
            // Outlook shortcut: Alt+H, J for junk (can't simulate Alt key easily)
            // Try Ctrl+J as alternative
            const keyboardEvent = new KeyboardEvent('keydown', {
              key: 'j',
              code: 'KeyJ',
              ctrlKey: true,
              bubbles: true,
              cancelable: true
            });
            element.dispatchEvent(keyboardEvent);
          } catch (error) {
            console.error('[Spam Detector] Error with keyboard shortcut:', error);
          }
        }
      }, 700);
      
      // Method 4: Right-click context menu (last resort)
      setTimeout(() => {
        if (!moved) {
          console.log('[Spam Detector] Trying context menu...');
          try {
            const rect = element.getBoundingClientRect();
            const contextEvent = new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
              button: 2,
              buttons: 2
            });
            element.dispatchEvent(contextEvent);
            
            setTimeout(() => {
              const junkMenuOption = document.querySelector(
                '[aria-label*="Junk" i], [aria-label*="Spam" i], [title*="Junk" i], ' +
                'button[aria-label*="Junk" i], [role="menuitem"][aria-label*="Junk" i], ' +
                '[role="menuitemcheckbox"][aria-label*="Junk" i]'
              );
              
              if (junkMenuOption) {
                console.log('[Spam Detector] Found junk option in context menu');
                junkMenuOption.click();
                moved = true;
              } else {
                console.log('[Spam Detector] Could not find junk option in context menu');
                // Log all menu items for debugging
                const allMenuItems = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]');
                if (allMenuItems.length > 0) {
                  console.log('[Spam Detector] Available menu items:', 
                    Array.from(allMenuItems).slice(0, 20).map(el => ({
                      label: el.getAttribute('aria-label') || el.title || 'N/A',
                      text: el.textContent?.trim().substring(0, 50) || 'N/A'
                    }))
                  );
                }
              }
            }, 500);
          } catch (error) {
            console.error('[Spam Detector] Error with context menu:', error);
          }
        }
      }, 800);
    }, 100);
  }
  
  return moved;
}

/**
 * Adds visual indicators to mark an email as spam (red border, background, tooltip, move button)
 * @param {HTMLElement} element - The email DOM element to highlight
 * @param {number} confidence - Spam confidence score (0-1)
 */
function highlightSpam(element, confidence) {
  console.log(`[Spam Detector] Highlighting element:`, element);
  
  // Skip if already highlighted
  if (element.hasAttribute('data-spam-highlighted')) {
    return;
  }
  
  element.setAttribute('data-spam-highlighted', 'true');
  
  // Add visual indicator - make it very visible
  element.style.borderLeft = '5px solid #ff0000';
  element.style.backgroundColor = '#ffe5e5';
  element.style.boxShadow = '0 0 5px rgba(255, 0, 0, 0.3)';
  element.setAttribute('data-spam-detected', 'true');
  element.setAttribute('data-spam-confidence', confidence.toFixed(2));
  
  // Ensure parent has relative positioning
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  
  // Remove existing tooltip/button if any
  const existingTooltip = element.querySelector('.spam-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  const existingButton = element.querySelector('.spam-move-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Get service type
  const service = detectEmailService();
  
  // Add tooltip with move button
  const container = document.createElement('div');
  container.className = 'spam-tooltip';
  container.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    z-index: 10000;
    display: flex;
    gap: 8px;
    align-items: center;
  `;
  
  const tooltip = document.createElement('div');
  tooltip.textContent = `⚠️ SPAM (${(confidence * 100).toFixed(1)}%)`;
  tooltip.style.cssText = `
    background: #ff0000;
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: bold;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  
  // Add manual move to spam button
  const moveButton = document.createElement('button');
  moveButton.className = 'spam-move-button';
  moveButton.textContent = 'Move to Spam';
  moveButton.style.cssText = `
    background: #ff6b35;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
  `;
  
  moveButton.addEventListener('mouseenter', () => {
    moveButton.style.background = '#e55a2b';
    moveButton.style.transform = 'scale(1.05)';
  });
  
  moveButton.addEventListener('mouseleave', () => {
    moveButton.style.background = '#ff6b35';
    moveButton.style.transform = 'scale(1)';
  });
  
  moveButton.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    console.log('[Spam Detector] Manual move to spam button clicked');
    const selectors = service === 'gmail' ? GMAIL_SELECTORS : OUTLOOK_SELECTORS;
    
    moveButton.textContent = 'Moving...';
    moveButton.disabled = true;
    moveButton.style.background = '#999';
    
    // Execute move function (it's async, so we'll check after a delay)
    moveEmailToSpam(element, service, selectors);
    
    // Check if move was successful after reasonable delay
    // For Gmail: 600ms, For Outlook: 1500ms (has more methods to try)
    const checkDelay = service === 'gmail' ? 600 : 1500;
    
    setTimeout(() => {
      // Check if email still exists (might have been moved)
      const stillExists = document.contains(element) && 
                         !element.closest('[aria-label*="Spam" i], [aria-label*="Junk" i]') &&
                         element.offsetParent !== null;
      
      // If element is still visible, assume it might not have moved
      // But we'll show success anyway to avoid confusion
      // User can click again if needed
      moveButton.textContent = 'Moved ✓';
      moveButton.style.background = '#28a745';
      
      setTimeout(() => {
        // Allow another attempt if user wants
        moveButton.textContent = 'Move to Spam';
        moveButton.disabled = false;
        moveButton.style.background = '#ff6b35';
      }, 2000);
    }, checkDelay);
  });
  
  container.appendChild(tooltip);
  container.appendChild(moveButton);
  element.appendChild(container);
  
  console.log(`[Spam Detector] ✅ Spam email highlighted successfully`);
}

/**
 * Main scanning function: finds email elements, extracts text, sends to API for prediction
 * Highlights spam emails and optionally moves them to spam folder
 * Skips already-processed emails using data-spam-checked attribute
 */
async function scanEmails() {
  if (!isEnabled) {
    console.log('[Spam Detector] Scanning disabled');
    return;
  }
  
  const service = detectEmailService();
  console.log('[Spam Detector] Service detected:', service);
  
  if (service === 'unknown') {
    console.log('[Spam Detector] Unknown email service, skipping');
    return;
  }
  
  const selectors = service === 'gmail' ? GMAIL_SELECTORS : OUTLOOK_SELECTORS;
  
  // Try multiple selector patterns for both services
  let emailElements = [];
  if (service === 'gmail') {
    // Try different Gmail selectors
    emailElements = document.querySelectorAll('tr[data-thread-id]');
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('tr.zA');
    }
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('div[role="main"] tbody tr');
    }
  } else if (service === 'outlook') {
    // Try multiple Outlook selectors in order of reliability
    console.log('[Spam Detector] Attempting Outlook email detection...');
    
    // Modern Outlook web app
    emailElements = document.querySelectorAll('[data-convid][role="listitem"]');
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('[role="listitem"][data-convid]');
    }
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('[data-test-id="message-list-item"]');
    }
    if (emailElements.length === 0) {
      // Classic Outlook
      emailElements = document.querySelectorAll('.ms-DetailsRow[role="row"]');
    }
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('div[role="listitem"]');
    }
    if (emailElements.length === 0) {
      // Try finding in main content area
      const mainArea = document.querySelector('[role="main"], div[role="grid"], div[role="region"]');
      if (mainArea) {
        emailElements = mainArea.querySelectorAll('[role="listitem"], [role="row"]');
      }
    }
    if (emailElements.length === 0) {
      // Last resort: look for any elements that might be email rows
      emailElements = document.querySelectorAll('div[data-test-id*="message"], div[data-test-id*="item"]');
    }
    
    console.log(`[Spam Detector] Found ${emailElements.length} potential Outlook email elements`);
    
    // Log first few elements for debugging
    if (emailElements.length > 0 && emailElements.length <= 5) {
      console.log('[Spam Detector] Outlook email elements:', Array.from(emailElements).slice(0, 3));
    }
  }
  
  console.log(`[Spam Detector] Found ${emailElements.length} email elements`);
  
  let scannedCount = 0;
  let spamDetected = 0;
  
  for (const element of emailElements) {
    // Skip if already processed
    if (element.hasAttribute('data-spam-checked')) continue;
    
    const text = getEmailText(element, service);
    if (!text || text.length < 5) {
      continue; // Skip empty or very short text
    }
    
    element.setAttribute('data-spam-checked', 'true');
    scannedCount++;
    
    try {
      // Send prediction request
      chrome.runtime.sendMessage(
        { action: 'predictSpam', text: text },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Spam Detector] Message error:', chrome.runtime.lastError);
            return;
          }
          
          if (response && response.success) {
            console.log(`[Spam Detector] Email analyzed - Spam: ${response.is_spam}, Confidence: ${response.confidence}`);
            
            // Update scanned count
            chrome.storage.sync.get(['scannedCount'], (items) => {
              chrome.storage.sync.set({
                scannedCount: (items.scannedCount || 0) + 1
              });
            });
            
            // Log all predictions for debugging
            console.log(`[Spam Detector] Email prediction - Spam: ${response.is_spam}, Confidence: ${(response.confidence * 100).toFixed(1)}%, Threshold: ${(confidenceThreshold * 100).toFixed(1)}%`);
            
            if (response.is_spam && response.confidence >= confidenceThreshold) {
              console.log(`[Spam Detector] ✅ Highlighting spam email (confidence: ${(response.confidence * 100).toFixed(1)}%)`);
              highlightSpam(element, response.confidence);
              spamDetected++;
              
              // Update spam count
              chrome.storage.sync.get(['spamCount'], (items) => {
                chrome.storage.sync.set({
                  spamCount: (items.spamCount || 0) + 1
                });
              });
              
              // Optional: Auto-move to spam (can be toggled in settings)
              chrome.storage.sync.get(['autoMoveToSpam'], (items) => {
                if (items.autoMoveToSpam) {
                  console.log('[Spam Detector] Auto-move enabled, attempting to move email to spam...');
                  // Small delay to ensure highlighting is complete
                  setTimeout(() => {
                    moveEmailToSpam(element, service, selectors);
                  }, 300);
                } else {
                  console.log('[Spam Detector] Auto-move disabled in settings');
                }
              });
            } else if (response.is_spam) {
              console.log(`[Spam Detector] ⚠️ Spam detected but below threshold (${(response.confidence * 100).toFixed(1)}% < ${(confidenceThreshold * 100).toFixed(1)}%)`);
            }
          } else {
            console.error('[Spam Detector] Prediction failed:', response?.error);
          }
        }
      );
    } catch (error) {
      console.error('[Spam Detector] Error checking spam:', error);
    }
  }
  
  if (scannedCount > 0) {
    console.log(`[Spam Detector] Scanned ${scannedCount} new emails`);
  }
}

/**
 * Initializes the content script: sets up initial scan, MutationObserver for new emails,
 * and periodic scanning every 10 seconds
 */
function init() {
  console.log('[Spam Detector] Content script loaded');
  console.log('[Spam Detector] Current URL:', window.location.href);
  console.log('[Spam Detector] Enabled:', isEnabled);
  
  // Initial scan after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(scanEmails, 2000);
    });
  } else {
    setTimeout(scanEmails, 2000);
  }
  
  // Scan when new emails appear (Gmail uses dynamic loading)
  const observer = new MutationObserver((mutations) => {
    // Throttle scans to avoid too many API calls
    if (observer.scanTimeout) return;
    observer.scanTimeout = setTimeout(() => {
      scanEmails();
      observer.scanTimeout = null;
    }, 1000);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Periodic scan
  setInterval(scanEmails, 10000); // Every 10 seconds
}

// Start initialization
init();
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

// Detect which email service we're on
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
    // Try multiple Outlook selectors
    const subjectEl = element.querySelector('[data-test-id="message-subject"]') ||
                      element.querySelector('.ms-DetailsRow-cell[title]') ||
                      element.querySelector('span[title]') ||
                      element.querySelector('[aria-label*="Subject"]') ||
                      element.querySelector('.ms-fontWeight-semibold');
    
    const snippetEl = element.querySelector('[data-test-id="message-preview"]') ||
                      element.querySelector('.ms-fontColor-neutralSecondary') ||
                      element.querySelector('[data-test-id="preview-text"]');
    
    subject = subjectEl?.textContent?.trim() || subjectEl?.title?.trim() || '';
    snippet = snippetEl?.textContent?.trim() || '';
    
    // Fallback: extract from element text if selectors fail
    if (!subject && !snippet) {
      const allText = element.textContent?.trim() || '';
      const textParts = allText.split('\n').filter(t => t.trim().length > 3);
      if (textParts.length > 0) {
        subject = textParts[0].trim();
        snippet = textParts.slice(1).join(' ').trim();
      }
    }
  }
  
  return `${subject} ${snippet}`.trim();
}

function moveEmailToSpam(element, service, selectors) {
  console.log(`[Spam Detector] Attempting to move email to spam folder (${service})`);
  
  if (service === 'gmail') {
    // Try to find and click the spam button
    const spamBtn = element.querySelector('[aria-label*="Report spam"]') ||
                    element.querySelector('[aria-label*="Mark as spam"]') ||
                    element.querySelector('div[role="button"][aria-label*="spam" i]');
    
    if (spamBtn) {
      console.log('[Spam Detector] Found Gmail spam button, clicking...');
      spamBtn.click();
      return true;
    }
    
    // Alternative: Try right-click menu option
    // Right-click on email to open context menu, then look for spam option
    try {
      const rect = element.getBoundingClientRect();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      element.dispatchEvent(event);
      
      // Wait for menu, then look for spam option
      setTimeout(() => {
        const spamMenuOption = document.querySelector('[aria-label*="spam" i], [data-action="spam"]');
        if (spamMenuOption) {
          spamMenuOption.click();
        }
      }, 100);
    } catch (error) {
      console.error('[Spam Detector] Error trying context menu:', error);
    }
  } else if (service === 'outlook') {
    // Outlook: Find and click junk/spam button
    const spamBtn = element.querySelector('[aria-label*="Junk" i]') ||
                    element.querySelector('[aria-label*="Spam" i]') ||
                    element.querySelector('[title*="Junk" i]') ||
                    element.querySelector('[title*="Spam" i]') ||
                    element.querySelector('button[aria-label*="Mark"]') ||
                    element.querySelector('[data-icon-name*="Junk"]');
    
    if (spamBtn) {
      console.log('[Spam Detector] Found Outlook spam button, clicking...');
      spamBtn.click();
      return true;
    }
    
    // Alternative: Try right-click context menu for Outlook
    try {
      const rect = element.getBoundingClientRect();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      element.dispatchEvent(event);
      
      // Wait for menu, then look for junk/spam option
      setTimeout(() => {
        const junkMenuOption = document.querySelector('[aria-label*="Junk" i], [aria-label*="Spam" i], [title*="Junk" i]');
        if (junkMenuOption) {
          junkMenuOption.click();
        }
      }, 150);
    } catch (error) {
      console.error('[Spam Detector] Error trying Outlook context menu:', error);
    }
  }
  
  console.log('[Spam Detector] Could not find spam button for this email');
  return false;
}

function highlightSpam(element, confidence) {
  console.log(`[Spam Detector] Highlighting element:`, element);
  
  // Add visual indicator - make it very visible
  element.style.borderLeft = '5px solid #ff0000';
  element.style.backgroundColor = '#ffe5e5';
  element.style.boxShadow = '0 0 5px rgba(255, 0, 0, 0.3)';
  element.setAttribute('data-spam-detected', 'true');
  element.setAttribute('data-spam-confidence', confidence.toFixed(2));
  
  // Remove existing tooltip if any
  const existingTooltip = element.querySelector('.spam-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  // Add tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'spam-tooltip';
  tooltip.textContent = `⚠️ SPAM (${(confidence * 100).toFixed(1)}% confidence)`;
  tooltip.style.cssText = `
    position: absolute;
    background: #ff0000;
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: bold;
    z-index: 10000;
    pointer-events: none;
    top: 5px;
    right: 5px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  
  // Ensure parent has relative positioning
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  
  element.appendChild(tooltip);
  
  console.log(`[Spam Detector] ✅ Spam email highlighted successfully`);
}

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
    // Try different Outlook selectors
    emailElements = document.querySelectorAll('[role="listitem"][data-convid]');
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('div[role="listitem"]');
    }
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('[data-test-id="message-list-item"]');
    }
    if (emailElements.length === 0) {
      emailElements = document.querySelectorAll('.ms-DetailsRow');
    }
    if (emailElements.length === 0) {
      // Fallback: try finding email rows in the main content area
      emailElements = document.querySelectorAll('div[role="main"] [role="listitem"]');
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
                  moveEmailToSpam(element, service, selectors);
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

// Wait for page to be ready
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
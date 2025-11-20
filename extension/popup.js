// Popup script for settings

document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    const items = await chrome.storage.sync.get([
      'apiUrl',
      'isEnabled',
      'confidenceThreshold',
      'autoMoveToSpam',
      'scannedCount',
      'spamCount'
    ]);
    
    const enabled = items.isEnabled !== false;
    const enabledCheckbox = document.getElementById('enabled');
    if (enabledCheckbox) {
      enabledCheckbox.checked = enabled;
      updateEnabledStatus(enabled);
      enabledCheckbox.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.sync.set({ isEnabled });
        updateEnabledStatus(isEnabled);
      });
    }
    
    const confidence = items.confidenceThreshold || 0.9;
    const confidenceInput = document.getElementById('confidence');
    if (confidenceInput) {
      confidenceInput.value = confidence;
      updateConfidenceDisplay(confidence);
      confidenceInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (value >= 0 && value <= 1) {
          chrome.storage.sync.set({ confidenceThreshold: value });
          updateConfidenceDisplay(value);
        }
      });
    }
    
    const autoMoveToSpamCheckbox = document.getElementById('autoMoveToSpam');
    if (autoMoveToSpamCheckbox) {
      autoMoveToSpamCheckbox.checked = items.autoMoveToSpam || false;
      autoMoveToSpamCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({ autoMoveToSpam: e.target.checked });
      });
    }
    
    const apiUrlInput = document.getElementById('apiUrl');
    if (apiUrlInput) {
      if (items.apiUrl) {
        apiUrlInput.value = items.apiUrl;
      }
      apiUrlInput.addEventListener('change', (e) => {
        chrome.storage.sync.set({ apiUrl: e.target.value });
        checkAPI();
      });
    }
    
    const testButton = document.getElementById('testConnection');
    if (testButton) {
      testButton.addEventListener('click', checkAPI);
    }
    
    // Load stats
    updateStats(items.scannedCount || 0, items.spamCount || 0);
    
    // Check API connection
    checkAPI();
    
    // Listen for stats updates from content script
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.scannedCount || changes.spamCount) {
        chrome.storage.sync.get(['scannedCount', 'spamCount'], (items) => {
          updateStats(items.scannedCount || 0, items.spamCount || 0);
        });
      }
    });
    
    // Periodically update stats
    setInterval(async () => {
      const items = await chrome.storage.sync.get(['scannedCount', 'spamCount']);
      updateStats(items.scannedCount || 0, items.spamCount || 0);
    }, 2000);
  });
  
  /**
   * Updates the enabled/disabled status badge in the popup UI
   * @param {boolean} isEnabled - Whether spam detection is enabled
   */
  function updateEnabledStatus(isEnabled) {
    const badge = document.getElementById('enabledStatus');
    if (badge) {
      if (isEnabled) {
        badge.textContent = 'Active';
        badge.className = 'badge active';
      } else {
        badge.textContent = 'Inactive';
        badge.className = 'badge inactive';
      }
    }
  }
  
  /**
   * Updates the confidence threshold display percentage
   * @param {number} value - Confidence threshold (0-1)
   */
  function updateConfidenceDisplay(value) {
    const display = document.getElementById('confidenceDisplay');
    if (display) {
      display.textContent = Math.round(value * 100) + '%';
    }
  }
  
  /**
   * Updates the statistics display (scanned count and spam count)
   * @param {number} scanned - Total emails scanned
   * @param {number} spam - Total spam emails detected
   */
  function updateStats(scanned, spam) {
    const scannedEl = document.getElementById('scannedCount');
    const spamEl = document.getElementById('spamCount');
    if (scannedEl) scannedEl.textContent = scanned.toLocaleString();
    if (spamEl) spamEl.textContent = spam.toLocaleString();
  }
  
  /**
   * Tests the API connection by calling the /health endpoint
   * Updates UI status indicators (connected/disconnected) based on response
   */
  async function checkAPI() {
    const apiUrl = document.getElementById('apiUrl').value || 'http://localhost:8000';
    const statusCard = document.getElementById('status');
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = statusCard ? statusCard.querySelector('.status-icon') : null;
    
    if (statusMessage) {
      statusMessage.textContent = 'Checking connection...';
    }
    if (statusCard) {
      statusCard.className = 'status-card disconnected';
    }
    if (statusIcon) {
      statusIcon.textContent = '⏳';
      statusIcon.style.animation = 'spin 1s linear infinite';
    }
    
    try {
      const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();
      
      if (data.status === 'healthy' && data.model_loaded) {
        if (statusMessage) statusMessage.textContent = '✅ Connected & Ready';
        if (statusCard) statusCard.className = 'status-card connected';
        if (statusIcon) {
          statusIcon.textContent = '✅';
          statusIcon.style.animation = 'none';
        }
      } else {
        if (statusMessage) statusMessage.textContent = '❌ API not ready';
        if (statusCard) statusCard.className = 'status-card disconnected';
        if (statusIcon) {
          statusIcon.textContent = '❌';
          statusIcon.style.animation = 'none';
        }
      }
    } catch (error) {
      if (statusMessage) statusMessage.textContent = '❌ Connection failed';
      if (statusCard) statusCard.className = 'status-card disconnected';
      if (statusIcon) {
        statusIcon.textContent = '❌';
        statusIcon.style.animation = 'none';
      }
      console.error('API check failed:', error);
    }
  }
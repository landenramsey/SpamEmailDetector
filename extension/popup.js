// Popup script for settings

document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    const items = await chrome.storage.sync.get([
      'apiUrl',
      'isEnabled',
      'confidenceThreshold',
      'autoDelete',
      'scannedCount',
      'spamCount'
    ]);
    
    if (items.apiUrl) {
      document.getElementById('apiUrl').value = items.apiUrl;
    }
    
    const enabled = items.isEnabled !== false;
    document.getElementById('enabled').checked = enabled;
    updateEnabledStatus(enabled);
    
    const confidence = items.confidenceThreshold || 0.9;
    document.getElementById('confidence').value = confidence;
    updateConfidenceDisplay(confidence);
    
    document.getElementById('autoDelete').checked = items.autoDelete || false;
    
    // Load stats
    updateStats(items.scannedCount || 0, items.spamCount || 0);
    
    // Check API connection
    checkAPI();
    
    // Save settings on change
    document.getElementById('enabled').addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.sync.set({ isEnabled });
      updateEnabledStatus(isEnabled);
    });
    
    document.getElementById('apiUrl').addEventListener('change', (e) => {
      chrome.storage.sync.set({ apiUrl: e.target.value });
      checkAPI();
    });
    
    const confidenceInput = document.getElementById('confidence');
    confidenceInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (value >= 0 && value <= 1) {
        chrome.storage.sync.set({ confidenceThreshold: value });
        updateConfidenceDisplay(value);
      }
    });
    
    document.getElementById('autoDelete').addEventListener('change', (e) => {
      chrome.storage.sync.set({ autoDelete: e.target.checked });
    });
    
    document.getElementById('testConnection').addEventListener('click', checkAPI);
    
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
  
  function updateEnabledStatus(isEnabled) {
    const badge = document.getElementById('enabledStatus');
    if (isEnabled) {
      badge.textContent = 'Active';
      badge.className = 'badge active';
    } else {
      badge.textContent = 'Inactive';
      badge.className = 'badge inactive';
    }
  }
  
  function updateConfidenceDisplay(value) {
    const display = document.getElementById('confidenceDisplay');
    display.textContent = Math.round(value * 100) + '%';
  }
  
  function updateStats(scanned, spam) {
    document.getElementById('scannedCount').textContent = scanned.toLocaleString();
    document.getElementById('spamCount').textContent = spam.toLocaleString();
  }
  
  async function checkAPI() {
    const apiUrl = document.getElementById('apiUrl').value || 'http://localhost:8000';
    const statusCard = document.getElementById('status');
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = statusCard.querySelector('.status-icon');
    
    statusMessage.textContent = 'Checking connection...';
    statusCard.className = 'status-card disconnected';
    statusIcon.textContent = '⏳';
    statusIcon.style.animation = 'spin 1s linear infinite';
    
    try {
      const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();
      
      if (data.status === 'healthy' && data.model_loaded) {
        statusMessage.textContent = '✅ Connected & Ready';
        statusCard.className = 'status-card connected';
        statusIcon.textContent = '✅';
        statusIcon.style.animation = 'none';
      } else {
        statusMessage.textContent = '❌ API not ready';
        statusCard.className = 'status-card disconnected';
        statusIcon.textContent = '❌';
        statusIcon.style.animation = 'none';
      }
    } catch (error) {
      statusMessage.textContent = '❌ Connection failed';
      statusCard.className = 'status-card disconnected';
      statusIcon.textContent = '❌';
      statusIcon.style.animation = 'none';
      console.error('API check failed:', error);
    }
  }
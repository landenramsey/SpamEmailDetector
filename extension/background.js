// Background service worker for the extension

/**
 * Retrieves the API URL from Chrome storage, defaults to localhost:8000
 * @returns {Promise<string>} API URL string
 */
async function getApiUrl() {
  const items = await chrome.storage.sync.get(['apiUrl']);
  return items.apiUrl || 'http://localhost:8000';
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Spam Detector Background] Received message:', request.action);
  
  if (request.action === 'predictSpam') {
    console.log('[Spam Detector Background] Predicting spam for text:', request.text?.substring(0, 50) + '...');
    predictSpam(request.text)
      .then(result => {
        console.log('[Spam Detector Background] Prediction result:', result);
        sendResponse({ success: true, ...result });
      })
      .catch(error => {
        console.error('[Spam Detector Background] Prediction error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'checkAPI') {
    checkAPIHealth()
      .then(healthy => sendResponse({ success: true, healthy }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  return false;
});

/**
 * Checks if the API server is healthy and model is loaded
 * @returns {Promise<boolean>} True if API is healthy and model is loaded
 */
async function checkAPIHealth() {
  try {
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/health`);
    const data = await response.json();
    return data.status === 'healthy' && data.model_loaded;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

/**
 * Sends email text to the FastAPI server for spam prediction
 * @param {string} text - Email text to analyze
 * @returns {Promise<Object>} Prediction result with is_spam and confidence
 * @throws {Error} If API request fails
 */
async function predictSpam(text) {
  try {
    const apiUrl = await getApiUrl();
    console.log('[Spam Detector Background] Calling API:', `${apiUrl}/predict`);
    
    const response = await fetch(`${apiUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Spam Detector Background] API error response:', errorText);
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[Spam Detector Background] API response:', data);
    return data;
  } catch (error) {
    console.error('[Spam Detector Background] Spam prediction failed:', error);
    throw error;
  }
}
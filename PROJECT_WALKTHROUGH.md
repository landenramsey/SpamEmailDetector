# Email Spam Detector - Complete Project Walkthrough

## 🎯 Project Overview

**Email Spam Detector** is a full-stack AI-powered browser extension that provides real-time spam detection for Gmail and Outlook. It uses a PyTorch LSTM neural network to analyze emails and highlights suspicious messages directly in your inbox.

**Key Value Proposition:**
- Real-time spam detection without sending emails to external servers
- Privacy-focused (runs locally)
- Works with Gmail and Outlook web interfaces
- ~97% accuracy with configurable sensitivity

---

## 🏗️ Architecture Overview

### Three-Layer System

```
┌─────────────────────────────────────────┐
│   Browser Extension (Frontend)          │
│   - Content Script (DOM interaction)   │
│   - Background Worker (API calls)       │
│   - Popup UI (Settings/Stats)           │
└──────────────┬──────────────────────────┘
               │ HTTP POST /predict
               ▼
┌─────────────────────────────────────────┐
│   FastAPI Server (Backend)              │
│   - REST API endpoints                  │
│   - CORS middleware                     │
│   - Request validation (Pydantic)       │
└──────────────┬──────────────────────────┘
               │ Model inference
               ▼
┌─────────────────────────────────────────┐
│   PyTorch LSTM Model (ML)               │
│   - SpamClassifier neural network       │
│   - Preprocessing pipeline              │
│   - Vocabulary mapping                   │
└─────────────────────────────────────────┘
```

---

## 📁 Project Structure Deep Dive

### `/extension/` - Browser Extension (Chrome Manifest V3)

**`manifest.json`**
- Defines extension permissions and capabilities
- Content scripts run on Gmail/Outlook domains
- Background service worker for API communication
- Host permissions for email sites + localhost API

**`content.js`** (Main Logic - ~550 lines)
- **Email Detection**: Scans DOM for email elements using multiple selector strategies
- **Text Extraction**: Extracts subject + snippet from Gmail/Outlook emails
- **Spam Highlighting**: Adds visual indicators (red border, background, tooltip)
- **Auto-Move Feature**: Attempts to move spam to junk folder (multiple fallback methods)
- **MutationObserver**: Watches for new emails appearing dynamically
- **Periodic Scanning**: Scans every 10 seconds + on page load

**Key Functions:**
- `detectEmailService()` - Identifies Gmail vs Outlook
- `getEmailText()` - Extracts email content with fallbacks
- `scanEmails()` - Main scanning loop
- `highlightSpam()` - Visual spam indicators
- `moveEmailToSpam()` - Auto-move functionality (4+ methods per service)

**`background.js`** (Service Worker)
- Message handler between content script and API
- Fetches API URL from `chrome.storage.sync`
- Makes HTTP requests to FastAPI server
- Error handling and logging

**`popup.html/js`** (Settings UI)
- Modern gradient-based UI
- Real-time stats (scanned count, spam count)
- API connection testing
- Confidence threshold slider (0-100%)
- Enable/disable toggle
- Auto-move to spam toggle

### `/backend/` - API Server

**`api_server.py`** (FastAPI Application)
- **Startup Event**: Loads SpamDetector model once at startup
- **CORS Middleware**: Allows browser extension to make requests
- **Endpoints:**
  - `GET /` - API info
  - `GET /health` - Health check (model loaded status)
  - `POST /predict` - Single email prediction
  - `POST /predict/batch` - Batch predictions
- **Error Handling**: 400 (bad request), 503 (model not loaded), 500 (prediction errors)

**`config.py`**
- Model hyperparameters (vocab size, embedding dim, hidden dim)
- Training configuration (epochs, batch size, learning rate)
- File paths (model, vocabulary)
- Safety settings (confidence threshold, dry-run mode)

### `/ml/` - Machine Learning

**`spam_model.py`** (PyTorch Neural Network)
```python
Architecture:
- Embedding Layer: vocab_size → embedding_dim (128)
- LSTM: 2-layer bidirectional, 256 hidden units, 0.3 dropout
- Fully Connected 1: 256 → 128 (ReLU activation)
- Dropout: 0.5
- Fully Connected 2: 128 → 2 (spam/ham classes)
```

**`spam_detector.py`** (Model Wrapper)
- Loads trained model weights (`spam_model.pth`)
- Loads vocabulary dictionary (`vocab.pkl`)
- Text preprocessing (lowercase, tokenization, padding)
- Converts words to indices using vocabulary
- Model inference with `torch.no_grad()` for efficiency
- Returns: `(is_spam: bool, confidence: float)`

**`train_model.py`** (Training Script)
- Loads CSV dataset (`data/emails.csv`)
- Builds vocabulary from training data (10,000 most common words)
- Creates PyTorch Dataset with padding
- Trains model with Adam optimizer
- Validation split and accuracy metrics
- Saves model and vocabulary after training

### `/scripts/` - Utility Scripts

**`start_server.sh`**
- Kills existing server processes
- Starts FastAPI server in background (`nohup`)
- Logs to `server.log`
- Verifies server started successfully
- Runs in background (survives terminal closure)

**`stop_server.sh`**
- Finds and kills API server process
- Clean shutdown

### `/data/` - Training Data

**`emails.csv`**
- Training dataset with `text` and `label` columns
- Used to train the LSTM model
- ~5,730 emails (spam/ham)

---

## 🔄 Data Flow

### 1. Email Detection Flow
```
User opens Gmail/Outlook
    ↓
Content script loads (content.js)
    ↓
Waits 2 seconds for page to load
    ↓
Scans DOM for email elements (multiple selector strategies)
    ↓
Extracts subject + snippet text
    ↓
Marks email as "checked" (prevents duplicate scans)
    ↓
Sends message to background worker
```

### 2. Prediction Flow
```
Background worker receives message
    ↓
Retrieves API URL from chrome.storage.sync
    ↓
POST request to http://localhost:8000/predict
    ↓
FastAPI receives request
    ↓
SpamDetector.preprocess_text() converts text to tensor
    ↓
Model inference (forward pass)
    ↓
Softmax to get probabilities
    ↓
Returns {is_spam: bool, confidence: float}
    ↓
Background worker sends response back to content script
```

### 3. Highlighting Flow
```
Content script receives prediction
    ↓
Checks if confidence > threshold (default 0.9)
    ↓
If spam: highlightSpam() called
    ↓
Adds visual indicators:
  - Red left border (5px)
  - Light red background (#ffe5e5)
  - Box shadow
  - Tooltip with confidence %
  - "Move to Spam" button
    ↓
Updates chrome.storage.sync (spamCount++)
    ↓
If auto-move enabled: moveEmailToSpam() called
```

### 4. Auto-Move Flow (Gmail)
```
moveEmailToSpam() called
    ↓
Clicks email to select it
    ↓
Hovers to reveal action buttons
    ↓
Searches for spam button (multiple selectors)
    ↓
If found: clicks button
    ↓
If not found: tries parent container
    ↓
If still not found: tries context menu
```

### 5. Auto-Move Flow (Outlook)
```
moveEmailToSpam() called
    ↓
Clicks email to select it
    ↓
Searches for junk button (element + 5 parent levels)
    ↓
If found: clicks button
    ↓
If not found: searches toolbar/ribbon
    ↓
If not found: tries keyboard shortcut (Ctrl+J)
    ↓
If not found: tries context menu
    ↓
Logs all available menu options for debugging
```

---

## 🧠 Machine Learning Details

### Model Architecture
- **Type**: Bidirectional LSTM (Long Short-Term Memory)
- **Why LSTM?**: Captures sequential patterns in email text (word order matters)
- **Bidirectional**: Reads text both forward and backward for better context

### Training Process
1. **Data Loading**: CSV with text and label (0=ham, 1=spam)
2. **Vocabulary Building**: Tokenize, count word frequencies, keep top 10,000
3. **Text Preprocessing**: 
   - Lowercase
   - Split into words
   - Map to vocabulary indices
   - Pad/truncate to 500 tokens
4. **Training**: 
   - Adam optimizer (lr=0.001)
   - Cross-entropy loss
   - 10 epochs
   - Batch size 32
   - Train/validation split
5. **Evaluation**: ~97% accuracy on validation set

### Inference Process
1. Text → lowercase → split → vocabulary lookup
2. Unknown words → `<UNK>` token (index 1)
3. Pad/truncate to 500 tokens
4. Convert to PyTorch tensor
5. Forward pass through model
6. Softmax → spam probability
7. Return `(is_spam, confidence)`

### Key Hyperparameters
- **VOCAB_SIZE**: 10,000 (critical - too small causes all emails to look similar)
- **EMBEDDING_DIM**: 128 (word vector dimensions)
- **HIDDEN_DIM**: 256 (LSTM hidden state size)
- **MAX_SEQUENCE_LENGTH**: 500 (max tokens per email)
- **NUM_LAYERS**: 2 (LSTM depth)
- **DROPOUT**: 0.3 (LSTM), 0.5 (FC) (prevents overfitting)

---

## 🔧 Technical Stack

### Frontend (Browser Extension)
- **JavaScript (ES6+)**: Content scripts, background worker, popup logic
- **Chrome Extension API (Manifest V3)**:
  - `chrome.storage.sync` - Settings persistence
  - `chrome.runtime.sendMessage` - Content ↔ Background communication
  - `chrome.tabs` - Tab management
- **DOM Manipulation**: QuerySelector, MutationObserver
- **HTML5/CSS3**: Popup UI with gradients, animations

### Backend (API Server)
- **FastAPI**: Modern Python web framework
- **Uvicorn**: ASGI server (runs FastAPI)
- **Pydantic**: Request/response validation
- **CORS Middleware**: Enables cross-origin requests from extension

### Machine Learning
- **PyTorch**: Deep learning framework
- **torch.nn**: Neural network layers (Embedding, LSTM, Linear)
- **NumPy**: Numerical operations
- **Pickle**: Model/vocabulary serialization

### DevOps
- **Bash Scripts**: Server management (start/stop)
- **nohup**: Background process execution
- **Git**: Version control

---

## 🎨 Key Features Explained

### 1. Real-Time Scanning
- **MutationObserver**: Watches for DOM changes (new emails)
- **Periodic Scans**: Every 10 seconds
- **On Page Load**: After 2-second delay
- **Deduplication**: `data-spam-checked` attribute prevents re-scanning

### 2. Multi-Email Service Support
- **Gmail**: Multiple selector fallbacks (`tr[data-thread-id]`, `tr.zA`, etc.)
- **Outlook**: 6+ selector strategies for different Outlook versions
- **Service Detection**: Checks `window.location.hostname`

### 3. Configurable Confidence Threshold
- **Slider**: 0-100% (0.0-1.0 internally)
- **Default**: 90% (conservative)
- **Use Cases**:
  - 70%: More aggressive (catches more spam, more false positives)
  - 90%: Balanced (default)
  - 95%: Very conservative (only obvious spam)

### 4. Auto-Move to Spam
- **Multiple Methods**: 4+ fallback strategies per service
- **Gmail**: Hover reveal, parent container, context menu
- **Outlook**: Element search, parent search, toolbar, keyboard shortcut, context menu
- **Manual Button**: Always available as backup

### 5. Statistics Tracking
- **Scanned Count**: Total emails analyzed
- **Spam Count**: Total spam detected
- **Real-Time Updates**: `chrome.storage.onChanged` listener
- **Persistent**: Stored in `chrome.storage.sync`

### 6. Visual Indicators
- **Red Border**: 5px solid left border
- **Background**: Light red (#ffe5e5)
- **Box Shadow**: Subtle red glow
- **Tooltip**: Confidence percentage
- **Button**: "Move to Spam" action button

---

## 🐛 Common Issues & Solutions

### Issue: All emails show same confidence (97.2%)
**Cause**: Vocabulary too small (only 16 words) → all emails map to `<UNK>`
**Solution**: Retrain model with larger vocabulary (10,000 words)

### Issue: Extension not detecting emails
**Causes**:
- Selectors outdated (Gmail/Outlook changed DOM)
- Extension disabled in popup
- Wrong email service (not Gmail/Outlook)
**Solution**: Check console logs, verify selectors, reload extension

### Issue: Move to spam button not working
**Causes**:
- Email service changed button structure
- Buttons not visible (need hover)
- Permission issues
**Solution**: Check console for available buttons, try manual button, verify permissions

### Issue: API connection failed
**Causes**:
- Server not running
- Wrong API URL
- Port 8000 in use
**Solution**: Start server (`./scripts/start_server.sh`), check health endpoint, verify URL

---

## 📊 Performance Metrics

- **Model Accuracy**: ~97% on validation set
- **Inference Speed**: 10-50ms per email
- **Memory Usage**: ~200MB (model + server)
- **Scanning Frequency**: Every 10 seconds + on new emails
- **API Response Time**: <100ms typically

---

## 🔐 Security & Privacy

- **Local Processing**: All inference happens on localhost
- **No External APIs**: Emails never leave your machine
- **Chrome Storage**: Settings stored locally (sync across devices if logged in)
- **CORS**: Only allows localhost API (not external servers)
- **No Data Collection**: No telemetry or analytics

---

## 🚀 Deployment Workflow

1. **Development Setup**:
   ```bash
   pip install -r requirements.txt
   python ml/train_model.py
   ./scripts/start_server.sh
   ```

2. **Extension Installation**:
   - Chrome → `chrome://extensions/`
   - Enable Developer Mode
   - Load unpacked → Select `extension/` folder

3. **Configuration**:
   - Click extension icon
   - Verify API URL
   - Test connection
   - Adjust confidence threshold
   - Enable detection

4. **Usage**:
   - Open Gmail/Outlook
   - Extension auto-scans
   - Spam highlighted automatically

---

## 💡 Interview Talking Points

### Problem Solved
- Real-time spam detection without external services
- Privacy-focused local processing
- Works with major email providers

### Technical Challenges Overcome
1. **DOM Fragility**: Email services change selectors → Multiple fallback strategies
2. **Model Accuracy**: Small vocabulary issue → Retrained with larger vocab
3. **Async Communication**: Content ↔ Background ↔ API → Proper message handling
4. **Cross-Origin**: Browser extension → Localhost API → CORS middleware

### Architecture Decisions
- **LSTM over CNN**: Sequential text patterns matter
- **FastAPI over Flask**: Modern async support, automatic docs
- **Manifest V3**: Latest Chrome extension standard
- **Local Processing**: Privacy and speed

### Scalability Considerations
- Model loaded once at startup (not per request)
- Batch prediction endpoint for multiple emails
- Efficient text preprocessing
- GPU support (CUDA if available)

---

## 📝 Key Code Patterns

### Content Script → Background Communication
```javascript
chrome.runtime.sendMessage(
  { action: 'predictSpam', text: emailText },
  (response) => {
    if (response.success) {
      // Handle prediction
    }
  }
);
```

### Background → API Communication
```javascript
const response = await fetch(`${apiUrl}/predict`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: text })
});
```

### Model Inference
```python
with torch.no_grad():
    processed = self.preprocess_text(text)
    output = self.model(processed)
    probabilities = torch.softmax(output, dim=1)
    spam_prob = probabilities[0][1].item()
```

---

## 🎓 Learning Outcomes

This project demonstrates:
- **Full-Stack Development**: Frontend (extension) + Backend (API) + ML
- **Deep Learning**: LSTM architecture, training pipeline, inference
- **Browser Extension Development**: Manifest V3, content scripts, service workers
- **API Design**: REST endpoints, error handling, validation
- **Problem Solving**: Debugging model issues, DOM manipulation challenges
- **DevOps**: Background processes, logging, deployment scripts

---

## 🔮 Future Enhancements

- Support for more email providers (Yahoo, ProtonMail)
- User feedback loop (mark false positives/negatives)
- Model retraining with user feedback
- Cloud deployment option
- Email body analysis (not just subject/snippet)
- Multi-language support
- Custom model training from user's emails

---

## 📚 Key Files to Know

**Must Understand:**
- `extension/content.js` - Main extension logic
- `backend/api_server.py` - API endpoints
- `ml/spam_detector.py` - Model wrapper
- `ml/spam_model.py` - Neural network architecture

**Good to Know:**
- `extension/background.js` - Message routing
- `extension/popup.js` - UI logic
- `ml/train_model.py` - Training pipeline
- `backend/config.py` - Hyperparameters

**Reference:**
- `scripts/start_server.sh` - Deployment
- `README.md` - User documentation

---

This walkthrough covers everything you need to understand, explain, and extend the Email Spam Detector project. Use it as a reference for interviews, documentation, or onboarding new contributors.


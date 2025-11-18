# Email Spam Detector

A PyTorch-based email spam detection system with a browser extension:
- **Browser Extension**: Real-time spam detection in Gmail/Outlook

## Features

- 🤖 AI-powered spam detection using LSTM neural network
- 🌐 Browser extension for Gmail and Outlook
- 🔄 Real-time email scanning
- ⚙️ Configurable confidence thresholds
- 🎨 Modern, visually appealing popup interface
- 📊 Real-time statistics tracking

## Prerequisites

- Python 3.8 or higher
- Chrome/Edge browser (for extension)

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Train the Model

The model must be trained before use. A dataset (`data/emails.csv`) is included:

```bash
python ml/train_model.py
```

This creates:
- `spam_model.pth` - Trained model weights
- `vocab.pkl` - Vocabulary dictionary

**Training takes a few minutes** and will show accuracy metrics. The model achieves ~97% accuracy on the validation set.

### 3. Start the API Server

The browser extension requires the API server to be running:

```bash
./scripts/start_server.sh
```

The server will:
- Start on `http://localhost:8000`
- Load the trained model
- Run in the background (survives terminal closure)
- Log output to `server.log`

**To stop the server:**
```bash
./scripts/stop_server.sh
```

**To check if server is running:**
```bash
curl http://localhost:8000/health
```

### 4. Install Browser Extension

1. Open Chrome/Edge and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The extension icon should appear in your toolbar

### 5. Configure Extension

1. Click the extension icon
2. Verify API URL is `http://localhost:8000`
3. Click "Test Connection" - should show ✅ Connected
4. Enable "Enable Spam Detection" toggle
5. Adjust "Confidence Threshold" (0.0-1.0):
   - **0.9** (default): Conservative, fewer false positives
   - **0.7**: More aggressive, catches more spam
   - **0.95**: Very conservative, only obvious spam

### 6. Use the Extension

1. Open Gmail or Outlook in your browser
2. The extension automatically scans emails
3. Spam emails are highlighted with a **red left border**
4. Hover over highlighted emails to see confidence percentage

**Note:** The extension scans:
- On page load (after 2 seconds)
- When new emails appear
- Every 10 seconds automatically

## Server Management

### Starting the Server

```bash
./scripts/start_server.sh
```

- Runs in background (survives terminal closure)
- Logs to `server.log`
- Auto-checks if server started successfully

### Stopping the Server

```bash
./scripts/stop_server.sh
```

Or manually:
```bash
pkill -f api_server.py
```

### Viewing Logs

```bash
tail -f server.log
```

### Server Status

Check if running:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status":"healthy","model_loaded":true}
```

### Server Persistence

- ✅ Survives terminal closure
- ✅ Survives logout
- ❌ Stops on computer restart (run `./scripts/start_server.sh` again)

## Project Structure

```
EmailSpamDetector/
├── extension/              # Browser extension files
│   ├── manifest.json      # Extension configuration
│   ├── content.js         # Email scanning logic
│   ├── background.js      # API communication
│   ├── popup.html/js      # Settings UI
│   └── icons/             # Extension icons
├── backend/                # API server files
│   ├── api_server.py      # FastAPI server
│   └── config.py          # Configuration settings
├── ml/                     # Machine learning files
│   ├── spam_model.py      # PyTorch model definition
│   ├── spam_detector.py   # Spam detection class
│   └── train_model.py     # Model training script
├── scripts/                # Utility scripts
│   ├── start_server.sh    # Server startup script
│   └── stop_server.sh     # Server stop script
├── data/                   # Data files
│   └── emails.csv         # Training dataset
├── spam_model.pth          # Trained model (after training)
├── vocab.pkl               # Vocabulary (after training)
├── requirements.txt        # Python dependencies
└── README.md               # Project documentation
```

## How It Works

### Browser Extension Flow

1. **Content Script** detects emails on Gmail/Outlook pages
2. Extracts subject and snippet text from each email
3. Sends text to **Background Script**
4. Background script calls **API Server** at `localhost:8000`
5. API uses trained **LSTM model** to predict spam probability
6. If spam confidence > threshold, email is highlighted

### Model Architecture

- **Embedding Layer**: Maps words to vectors
- **LSTM Layer**: 2-layer bidirectional LSTM (256 hidden units)
- **Fully Connected**: 128 → 2 (spam/ham)
- **Vocabulary**: 10,000 most common words
- **Sequence Length**: 500 tokens max

## Troubleshooting

### Extension Issues

**"Connection failed" in extension popup:**
- Ensure API server is running: `./start_server.sh`
- Check server health: `curl http://localhost:8000/health`
- Verify API URL in extension settings

**Emails not being scanned:**
- Open browser console (F12) and look for `[Spam Detector]` messages
- Check if extension is enabled in popup
- Verify you're on Gmail or Outlook (not other email services)
- Reload the email page

**All emails marked as spam with same confidence:**
- Model may need retraining: `python train_model.py`
- Restart API server: `./stop_server.sh && ./start_server.sh`

### Server Issues

**Server won't start:**
- Check logs: `tail -f server.log`
- Ensure port 8000 is not in use: `lsof -i :8000`
- Verify model files exist: `ls spam_model.pth vocab.pkl`

**"Model not loaded" error:**
- Train the model first: `python ml/train_model.py`
- Ensure `spam_model.pth` and `vocab.pkl` exist in the root directory

**"No module named 'X'":**
- Install dependencies: `pip install -r requirements.txt`

## Configuration

### Extension Settings

Access via extension popup:
- **API URL**: Server endpoint (default: `http://localhost:8000`)
- **Enable Spam Detection**: Toggle scanning on/off
- **Confidence Threshold**: 0.0-1.0 (higher = more conservative)
- **Auto-Delete**: ⚠️ Automatically delete spam (use with caution)

### Model Settings (`config.py`)

- `VOCAB_SIZE`: Vocabulary size (default: 10,000)
- `EMBEDDING_DIM`: Word embedding dimension (default: 128)
- `HIDDEN_DIM`: LSTM hidden units (default: 256)
- `NUM_EPOCHS`: Training epochs (default: 10)
- `BATCH_SIZE`: Training batch size (default: 32)

## Safety Features

- **Dry-run mode**: Test without deleting emails
- **Confidence threshold**: Only act on high-confidence predictions
- **Visual indicators**: See spam before taking action
- **Manual review**: Extension highlights, doesn't auto-delete by default

## Performance

- **Model Accuracy**: ~97% on validation set
- **Inference Speed**: ~10-50ms per email
- **Memory Usage**: ~200MB (model + server)
- **Scanning Frequency**: Every 10 seconds + on new emails

## License

This project is provided as-is for educational and personal use.

## Support

For issues:
1. Check the troubleshooting section
2. Review server logs: `tail -f server.log`
3. Check browser console for extension errors
4. Verify model is trained and server is running

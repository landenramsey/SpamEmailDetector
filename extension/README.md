# Email Spam Detector Extension

## Setup Instructions

1. **Start the API server:**ash
   cd /path/to/EmailSpamDetector
   python api_server.py
   
2. **Load the extension:**
   - Open Chrome/Edge
   - Go to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

3. **Configure:**
   - Click the extension icon
   - Set your API URL (default: http://localhost:8000)
   - Adjust confidence threshold
   - Enable/disable features

4. **Use:**
   - Go to Gmail or Outlook
   - The extension will automatically scan emails
   - Spam emails will be highlighted in red

## Icons

You'll need to create icon files (16x16, 48x48, 128x128 pixels) or use placeholder images.
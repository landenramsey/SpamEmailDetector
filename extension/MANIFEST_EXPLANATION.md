# manifest.json Explanation

This file defines the Chrome browser extension's configuration using Manifest V3.

## Key Sections:

### Basic Info
- `manifest_version: 3` - Uses the latest Chrome extension manifest format
- `name`, `version`, `description` - Extension metadata

### Permissions
- `storage` - Access Chrome storage API (for saving settings)
- `activeTab` - Access the currently active tab
- `scripting` - Inject and execute scripts

### Host Permissions
- `https://mail.google.com/*` - Access Gmail pages
- `https://outlook.live.com/*` - Access Outlook Live pages
- `https://outlook.office.com/*` - Access Outlook Office 365 pages
- `http://localhost:8000/*` - Access local API server

### Background
- `service_worker: background.js` - Background script that handles API communication
- Runs as a service worker (persists across page navigations)

### Content Scripts
- Injects `content.js` into Gmail/Outlook pages
- `run_at: document_idle` - Runs after page loads but before window.onload

### Action
- Defines the extension's popup UI (`popup.html`)
- Sets extension icons for different sizes

### Icons
- Extension icons displayed in browser toolbar and extension management


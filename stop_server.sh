#!/bin/bash

# Stop the spam detector API server

echo "Stopping Spam Detector API server..."
pkill -f "api_server.py"

if [ $? -eq 0 ]; then
    echo "✅ Server stopped successfully"
else
    echo "ℹ️  No server process found (it may already be stopped)"
fi


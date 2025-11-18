#!/bin/bash

# Start the spam detector API server
# This script will keep the server running even if you close the terminal

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill any existing server
pkill -f "api_server.py" 2>/dev/null
sleep 1

# Start the server with nohup (keeps running after terminal closes)
echo "Starting Spam Detector API server..."
nohup python3 "$SCRIPT_DIR/../backend/api_server.py" > "$SCRIPT_DIR/../server.log" 2>&1 &

# Wait a moment to check if it started
sleep 2

# Check if the process is running
if pgrep -f "api_server.py" > /dev/null; then
    echo "✅ Spam Detector API server started successfully!"
    echo "Server is running in the background"
    echo "Logs are being written to: $SCRIPT_DIR/../server.log"
    echo ""
    echo "To stop the server, run: ./stop_server.sh"
    echo "Or manually: pkill -f api_server.py"
    echo ""
    echo "To view logs: tail -f $SCRIPT_DIR/../server.log"
    echo "To check health: curl http://localhost:8000/health"
else
    echo "❌ Failed to start server. Check the logs:"
    echo "tail -f $SCRIPT_DIR/../server.log"
    exit 1
fi


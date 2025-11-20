#!/bin/bash

###############################################################################
# start_server.sh
# 
# Starts the FastAPI spam detection server in the background.
# The server will continue running even after the terminal is closed.
# 
# Usage: ./start_server.sh
# 
# What it does:
#   1. Kills any existing server instance
#   2. Starts the API server with nohup (background process)
#   3. Verifies the server started successfully
#   4. Displays helpful information about logs and stopping the server
###############################################################################

# Get the directory where this script is located
# This ensures the script works regardless of where it's called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Kill any existing server instance to prevent port conflicts
pkill -f "api_server.py" 2>/dev/null
sleep 1  # Give process time to fully terminate

# Step 2: Start the server with nohup (keeps running after terminal closes)
# nohup = no hang up - allows process to continue after terminal closes
# Output redirected to server.log for debugging
echo "Starting Spam Detector API server..."
nohup python3 "$SCRIPT_DIR/../backend/api_server.py" > "$SCRIPT_DIR/../server.log" 2>&1 &

# Step 3: Wait a moment for the server to initialize
sleep 2

# Step 4: Verify the server started successfully by checking if process exists
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


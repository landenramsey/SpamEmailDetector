#!/bin/bash

###############################################################################
# stop_server.sh
# 
# Stops the FastAPI spam detection server if it's running.
# 
# Usage: ./stop_server.sh
# 
# What it does:
#   1. Searches for and kills the api_server.py process
#   2. Reports whether the server was found and stopped
###############################################################################

echo "Stopping Spam Detector API server..."

# Kill the server process by searching for "api_server.py" in process list
# -f flag searches full command line, not just process name
pkill -f "api_server.py"

# Check exit status: 0 = process found and killed, non-zero = not found
if [ $? -eq 0 ]; then
    echo "✅ Server stopped successfully"
else
    echo "ℹ️  No server process found (it may already be stopped)"
fi


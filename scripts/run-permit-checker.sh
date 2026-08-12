#!/bin/bash

# Permit Checker Daemon
# Runs olympic-permit-checker.js every 2 hours
# Usage: bash run-permit-checker.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../.permits-logs"
CHECK_INTERVAL=7200  # 2 hours in seconds

mkdir -p "$LOG_DIR"

echo "🚀 Olympic NP Permit Checker - Starting daemon"
echo "📋 Logs: $LOG_DIR"
echo "⏱️  Check interval: 2 hours"
echo "🛑 Press Ctrl+C to stop\n"

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running permit check..."

  node "$SCRIPT_DIR/olympic-permit-checker.js" >> "$LOG_DIR/checker.log" 2>&1

  # Extract results for next iteration
  LAST_CHECK=$(tail -20 "$LOG_DIR/checker.log" | grep -c "NEWLY AVAILABLE")

  if [ "$LAST_CHECK" -gt 0 ]; then
    echo "🔔 ALERT: Permits available! Check $LOG_DIR/checker.log"
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Next check in 2 hours...\n"
  sleep $CHECK_INTERVAL
done

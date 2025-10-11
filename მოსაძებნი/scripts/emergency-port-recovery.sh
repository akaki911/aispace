
#!/bin/bash
set -euo pipefail

echo "🚨 Emergency Port Recovery - გურულო Crisis Management"
echo "================================================="

# Kill all node processes aggressively
echo "🔥 Emergency: Killing all Node.js processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Clean specific ports
for P in 5002 5001 5000 3000; do
  echo "🧹 Emergency cleanup port $P..."
  
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${P}/tcp" 2>/dev/null || true
  fi
  
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$P" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  fi
  
  # Pattern-based cleanup
  ps aux | grep -E "(PORT=$P|:$P)" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
done

echo "⏳ Cooling down..."
sleep 5

# Verify ports are free
echo "🔍 Verifying port status..."
for P in 5002 5001 5000; do
  if command -v lsof >/dev/null 2>&1; then
    if lsof -ti tcp:"$P" >/dev/null 2>&1; then
      echo "⚠️ Port $P still occupied"
    else
      echo "✅ Port $P is free"
    fi
  fi
done

echo "🚀 Emergency cleanup completed. You can now restart services."

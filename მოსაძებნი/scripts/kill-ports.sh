
#!/bin/bash
set -euo pipefail

echo "🔧 Port Cleanup - დაიწყო გურულო სერვისების გაწმენდა..."

for P in 5002 5001 5000; do
  echo "🔍 Cleaning port $P..."
  
  # Method 1: fuser (preferred)
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${P}/tcp" 2>/dev/null || true
    echo "  ✅ fuser cleanup completed for port $P"
  
  # Method 2: lsof + kill
  elif command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti tcp:"$P" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo "$PIDS" | xargs -r kill -9
      echo "  ✅ lsof cleanup completed for port $P"
    else
      echo "  ✅ port $P already free (lsof)"
    fi
  
  # Method 3: ss fallback - enhanced for Replit
  elif command -v ss >/dev/null 2>&1; then
    # Use ss with better parsing for Replit environment
    PIDS=$(ss -tulpn 2>/dev/null | grep ":$P " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' || true)
    if [ -n "$PIDS" ]; then
      echo "$PIDS" | xargs -r kill -9
      echo "  ✅ ss cleanup completed for port $P"
    else
      echo "  ✅ port $P already free (ss)"
    fi
  
  else
    echo "  ⚠️ No fuser/lsof/ss available to kill port $P"
  fi
  
  # Extra cleanup - kill by port pattern
  pkill -f "PORT=$P" 2>/dev/null || true
  
  sleep 1
done

echo "✅ Port cleanup completed: 5002, 5001, 5000"

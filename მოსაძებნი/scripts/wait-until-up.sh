#!/bin/bash
set -euo pipefail

url="$1"
tries="${2:-40}"
sleep_s="${3:-1}"

echo "⏳ ველოდებით სერვისს: $url"

for i in $(seq 1 "$tries"); do
  # Use curl instead of netstat for Replit compatibility
  if curl -fsS --max-time 3 --connect-timeout 2 "$url" >/dev/null 2>&1; then
    echo "✅ სერვისი მზად არის: $url"
    exit 0
  fi

  # Show progress every 5 attempts
  if [ $((i % 5)) -eq 0 ]; then
    echo "⏳ მცდელობა $i/$tries - ველოდებით $url..."
  fi

  sleep "$sleep_s"
done

echo "⚠️ TIMEOUT: სერვისი არ გამოეხმაურება $url ($tries მცდელობის შემდეგ)"
exit 1
#!/bin/bash
set -euo pipefail

# Wait for service to be healthy
# Usage: wait-until-up.sh <url> [max_attempts] [sleep_seconds]

url="$1"
max_attempts="${2:-10}"
sleep_seconds="${3:-0.5}"

echo "⏳ Waiting for $url to respond..."

for i in $(seq 1 "$max_attempts"); do
  # Fast curl with reduced timeout for startup speed
  if curl -fsS --max-time 3 --connect-timeout 2 --retry 0 "$url" >/dev/null 2>&1; then
    echo "✅ Service at $url is healthy (attempt $i/$max_attempts)"
    
    # Additional verification: check if service is actually listening
    local port=$(echo "$url" | grep -oP ':\K\d+' || echo "")
    if [ -n "$port" ] && command -v lsof >/dev/null 2>&1; then
      if lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
        echo "🔗 Port $port confirmed listening"
      else
        echo "⚠️ Service responded but port $port not in LISTEN state"
      fi
    fi
    
    exit 0
  fi
  
  # Show more detailed progress
  if [ $((i % 5)) -eq 0 ] || [ $i -eq $max_attempts ]; then
    echo "⏳ Attempt $i/$max_attempts - waiting ${sleep_seconds}s..."
    
    # Diagnostic info on significant attempts
    if [ $i -eq 10 ] || [ $i -eq $max_attempts ]; then
      local port=$(echo "$url" | grep -oP ':\K\d+' || echo "")
      if [ -n "$port" ]; then
        if command -v lsof >/dev/null 2>&1; then
          if lsof -iTCP:$port >/dev/null 2>&1; then
            echo "   💡 Port $port has some activity (may be starting up)"
          else
            echo "   ❌ Port $port not listening yet"
          fi
        fi
      fi
    fi
  fi
  
  if [ $i -eq $max_attempts ]; then
    echo "❌ Service at $url failed health check after $max_attempts attempts"
    exit 1
  fi
  
  sleep "$sleep_seconds"
done


#!/bin/bash

# პარამეტრები
SERVICE_NAME="$1"
URL="$2"
MAX_ATTEMPTS="${3:-30}"
RETRY_DELAY="${4:-2}"

echo "🔍 Smart health check for $SERVICE_NAME"
echo "📍 Target: $URL"
echo "⚙️ Max attempts: $MAX_ATTEMPTS, Delay: ${RETRY_DELAY}s"

for attempt in $(seq 1 $MAX_ATTEMPTS); do
    echo -n "[$attempt/$MAX_ATTEMPTS] Testing $SERVICE_NAME... "
    
    # HTTP status check with timeout
    if curl -f -s --max-time 5 --connect-timeout 3 "$URL" >/dev/null 2>&1; then
        echo "✅ SUCCESS"
        echo "🎉 $SERVICE_NAME is healthy and responding"
        exit 0
    else
        echo "❌ FAILED"
        
        # Additional diagnostics on failure
        if [ $attempt -eq 5 ] || [ $attempt -eq 15 ]; then
            echo "🔍 Diagnostic info for $SERVICE_NAME:"
            
            # Extract port from URL
            PORT=$(echo "$URL" | grep -oP ':\K\d+')
            if [ -n "$PORT" ]; then
                # Check if port is listening
                if lsof -ti:$PORT >/dev/null 2>&1; then
                    echo "   📍 Port $PORT is occupied (service might be starting)"
                else
                    echo "   ❌ Port $PORT is not listening"
                fi
            fi
        fi
    fi
    
    sleep $RETRY_DELAY
done

echo "⚠️ TIMEOUT: $SERVICE_NAME did not become healthy after $MAX_ATTEMPTS attempts"
echo "💡 Manual check recommended: curl -v $URL"
exit 1

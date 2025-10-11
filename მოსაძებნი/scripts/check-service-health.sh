
#!/bin/bash
set -euo pipefail

check_service() {
  local PORT=$1
  local SERVICE_NAME=$2
  local HEALTH_URL=$3
  local MAX_ATTEMPTS=${4:-30}
  
  echo "🔍 Checking $SERVICE_NAME health on port $PORT..."
  
  for i in $(seq 1 $MAX_ATTEMPTS); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      echo "✅ $SERVICE_NAME is healthy (attempt $i/$MAX_ATTEMPTS)"
      return 0
    fi
    
    if [ $i -eq $MAX_ATTEMPTS ]; then
      echo "❌ $SERVICE_NAME failed health check after $MAX_ATTEMPTS attempts"
      return 1
    fi
    
    echo "⏳ $SERVICE_NAME not ready yet (attempt $i/$MAX_ATTEMPTS)..."
    sleep 2
  done
}

# Check all services
echo "🚀 გურულო Service Health Check დაიწყო..."

check_service 5002 "Backend" "http://localhost:5002/api/health" 20
BACKEND_STATUS=$?

check_service 5001 "AI-Service" "http://localhost:5001/health" 15
AI_STATUS=$?

# Frontend check (simple port probe)
if curl -fsS "http://localhost:5000" >/dev/null 2>&1; then
  echo "✅ Frontend is responding"
  FRONTEND_STATUS=0
else
  echo "⚠️ Frontend not ready yet"
  FRONTEND_STATUS=1
fi

# Summary
echo ""
echo "📊 Service Health Summary:"
echo "  Backend (5002): $([ $BACKEND_STATUS -eq 0 ] && echo "✅ HEALTHY" || echo "❌ FAILED")"
echo "  AI-Service (5001): $([ $AI_STATUS -eq 0 ] && echo "✅ HEALTHY" || echo "❌ FAILED")"
echo "  Frontend (5000): $([ $FRONTEND_STATUS -eq 0 ] && echo "✅ HEALTHY" || echo "⚠️ STARTING")"

if [ $BACKEND_STATUS -eq 0 ] && [ $AI_STATUS -eq 0 ]; then
  echo "🎉 გურულო Services Ready!"
  exit 0
else
  echo "🚨 Some services failed to start properly"
  exit 1
fi

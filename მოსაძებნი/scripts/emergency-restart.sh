
#!/bin/bash
echo "🚨 Emergency System Restart"
echo "=========================="

# Kill all processes aggressively
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Clean specific ports with multiple methods
for port in 5000 5001 5002; do
  echo "🧹 Cleaning port $port..."
  lsof -ti:$port | xargs kill -9 2>/dev/null || true
  ss -tulpn 2>/dev/null | grep ":$port " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | xargs kill -9 2>/dev/null || true
done

sleep 5

# Start services with unique ports if needed
echo "🚀 Starting Backend..."
cd backend && \
  export AI_INTERNAL_TOKEN="bakhmaro-ai-service-internal-token-dev-2024" && \
  export PORT=5002 && \
  node index.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 8

# Test backend health
curl -f http://127.0.0.1:5002/api/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Backend health check passed"
else
  echo "❌ Backend health check failed"
fi

echo "🤖 Starting AI Service..."
cd ../ai-service && \
  export AI_INTERNAL_TOKEN="bakhmaro-ai-service-internal-token-dev-2024" && \
  export PORT=5001 && \
  export HOST=0.0.0.0 && \
  node server.js > ../ai-service.log 2>&1 &
AI_PID=$!
echo "AI Service PID: $AI_PID"
sleep 8

# Test AI service health
curl -f http://127.0.0.1:5001/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ AI Service health check passed"
else
  echo "❌ AI Service health check failed"
fi

echo "🎨 Starting Frontend..."
cd .. && PORT=5000 HOST=0.0.0.0 CLEAR_SCREEN=false node ./scripts/run-vite-dev.mjs

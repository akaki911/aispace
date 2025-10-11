
#!/bin/bash

# SOL-354 Sequential Service Start Script
# კანონიკური პორტები: AI=5001, BE=5002, FE=5000

echo "🧹 ყველა სერვისის გაჩერება..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true  
pkill -f "vite" 2>/dev/null || true
pkill -f "PORT=500" 2>/dev/null || true

# პორტების ძალდატანება
echo "🧹 პორტების ძალითი გაწმენდა..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true  
lsof -ti:5002 | xargs kill -9 2>/dev/null || true

sleep 4

# AI Service Start (5001)
echo "🚀 ეტაპი 1: AI Service გაშვება..."
cd ai-service && PORT=5001 HOST=0.0.0.0 node server.js &
AI_PID=$!
echo "AI Service PID: $AI_PID"

sleep 6
echo "🔍 AI Service health check..."
if curl -f http://127.0.0.1:5001/health > /dev/null 2>&1; then
    echo "✅ AI Service მზად არის"
else
    echo "❌ AI Service არ პასუხობს"
fi

# Backend Start (5002)  
echo "🚀 ეტაპი 2: Backend გაშვება..."
cd ../backend && PORT=5002 node index.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 6
echo "🔍 Backend health check..."
if curl -f http://127.0.0.1:5002/api/health > /dev/null 2>&1; then
    echo "✅ Backend მზად არის"
else
    echo "❌ Backend არ პასუხობს"
fi

# Frontend Start (5000)
echo "🚀 ეტაპი 3: Frontend გაშვება..."
cd ..
echo "🧹 Frontend ფაილების cache გაწმენდა..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .vite 2>/dev/null || true

echo "🎨 Frontend სერვერის გაშვება..."
PORT=5000 HOST=0.0.0.0 CLEAR_SCREEN=false node ./scripts/run-vite-dev.mjs

echo "📊 სერვისების სტატუსი:"
echo "AI Service (5001): $(pgrep -f 'PORT=5001' > /dev/null && echo '✅ Running' || echo '❌ Stopped')"
echo "Backend (5002): $(pgrep -f 'PORT=5002' > /dev/null && echo '✅ Running' || echo '❌ Stopped')"  
echo "Frontend (5000): $(pgrep -f 'PORT=5000' > /dev/null && echo '✅ Running' || echo '❌ Stopped')"

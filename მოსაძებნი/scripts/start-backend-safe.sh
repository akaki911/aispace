
#!/bin/bash

echo "🚀 Safe Backend Startup"

# დირექტორიის შემოწმება
if [ ! -d "backend" ]; then
    echo "❌ Backend directory not found"
    exit 1
fi

# Package.json შემოწმება
if [ ! -f "backend/package.json" ]; then
    echo "❌ Backend package.json not found"
    exit 1
fi

# Dependencies შემოწმება
echo "📦 Checking backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "📥 Installing backend dependencies..."
    npm install
fi

# პორტის გასუფთავება
echo "🧹 Cleaning backend port 5002..."
lsof -ti:5002 | xargs kill -9 2>/dev/null || true
sleep 2

# Environment variables
export PORT=5002
export NODE_ENV=development
export DEBUG_LEVEL=info

echo "🚀 Starting backend server..."
echo "📍 Environment: PORT=$PORT, NODE_ENV=$NODE_ENV"

# Backend გაშვება background-ში
nohup node index.js > ../backend.log 2>&1 &
BACKEND_PID=$!

echo "📍 Backend PID: $BACKEND_PID"
echo $BACKEND_PID > ../backend.pid

# Health check
sleep 5
echo "🔍 Backend health check..."
if curl -f http://127.0.0.1:5002/api/health >/dev/null 2>&1; then
    echo "✅ Backend is healthy and ready"
    exit 0
else
    echo "❌ Backend health check failed"
    echo "📄 Last 10 lines of backend log:"
    tail -10 ../backend.log
    exit 1
fi


#!/bin/bash

echo "🚀 გურულო Smart Service Recovery დაიწყო..."
echo "🔍 Port კონფლიქტების დეტალური ანალიზი..."
echo "📊 სისტემის მდგომარეობის შემოწმება..."

# Function to analyze port conflicts
analyze_port_conflicts() {
    echo "🔍 Port კონფლიქტების ანალიზი:"
    
    for PORT in 3000 5000 5001 5002; do
        PID=$(lsof -ti:$PORT 2>/dev/null)
        if [ -n "$PID" ]; then
            PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "Unknown")
            echo "   🚨 Port $PORT: PID $PID ($PROCESS_NAME)"
        else
            echo "   ✅ Port $PORT: თავისუფალი"
        fi
    done
    echo ""
}

# Function to kill processes on port gracefully
kill_port_gracefully() {
    local PORT=$1
    local SERVICE_NAME=$2
    
    echo "🔧 $SERVICE_NAME-ის გაჩერება port $PORT-ზე..."
    
    # Get PID if exists
    PID=$(lsof -ti:$PORT 2>/dev/null)
    
    if [ -n "$PID" ]; then
        echo "📍 მოიძებნა პროცესი: PID $PID port $PORT-ზე"
        
        # Graceful termination
        kill -TERM $PID 2>/dev/null
        sleep 3
        
        # Check if still running
        if kill -0 $PID 2>/dev/null; then
            echo "⚡ Force killing $SERVICE_NAME (PID: $PID)"
            kill -9 $PID 2>/dev/null
        fi
        
        echo "✅ $SERVICE_NAME გაჩერებულია"
    else
        echo "ℹ️  $SERVICE_NAME არ მუშაობდა port $PORT-ზე"
    fi
}

# Function to find next available port
find_available_port() {
    local START_PORT=$1
    local MAX_TRIES=50
    
    for ((i=0; i<MAX_TRIES; i++)); do
        local TEST_PORT=$((START_PORT + i))
        
        # Check if port is available using lsof (Replit-compatible)
        if ! lsof -ti:$TEST_PORT >/dev/null 2>&1 && ! ss -tuln | grep -q ":$TEST_PORT "; then
            echo $TEST_PORT
            return 0
        fi
    done
    
    echo $START_PORT  # Fallback to original port
    return 1
}

echo "🧹 PHASE 1: Port Cleanup და Conflict Resolution"

# Analyze conflicts first
analyze_port_conflicts

# Kill all development ports
kill_port_gracefully 3000 "Frontend-Vite"
kill_port_gracefully 5000 "Frontend-Alt"  
kill_port_gracefully 5001 "AI-Service"
kill_port_gracefully 5002 "Backend"

# Wait for ports to be fully released
echo "⏳ ველოდებით ports-ის სრული გათავისუფლებას..."
sleep 5

echo "🔍 PHASE 2: Smart Port Detection"

# Find available ports
BACKEND_PORT=$(find_available_port 5002)
AI_PORT=$(find_available_port 5001)  
FRONTEND_PORT=$(find_available_port 3000)

echo "📊 ალოკაციური Ports:"
echo "   Backend: $BACKEND_PORT"
echo "   AI Service: $AI_PORT"
echo "   Frontend: $FRONTEND_PORT"

echo "🚀 PHASE 3: Services Restart with Smart Ports"

# Start backend with detected port
cd backend
echo "🔧 Backend-ის გაშვება port $BACKEND_PORT-ზე..."
PORT=$BACKEND_PORT node index.js &
BACKEND_PID=$!
cd ..

# Wait for backend to initialize
sleep 5

# Start AI service with detected port  
cd ai-service
echo "🤖 AI Service-ის გაშვება port $AI_PORT-ზე..."
PORT=$AI_PORT HOST=0.0.0.0 node server.js &
AI_PID=$!
cd ..

# Wait for AI service to initialize
sleep 5

# Start frontend with detected port
echo "🎨 Frontend-ის გაშვება port $FRONTEND_PORT-ზე..."
# Force kill any process on the detected frontend port
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
sleep 2

# Start frontend with explicit port configuration via ESM runner
PORT=$FRONTEND_PORT HOST=0.0.0.0 CLEAR_SCREEN=false node ./scripts/run-vite-dev.mjs &
FRONTEND_PID=$!

# Wait for all services to start
sleep 10

echo "🎯 PHASE 4: Service Health Verification"

# Check if services are running
check_service() {
    local PORT=$1
    local SERVICE=$2
    
    # For frontend (Vite), just check if port is responding
    if [[ "$SERVICE" == "Frontend" ]]; then
        if curl -s -f http://localhost:$PORT >/dev/null 2>&1 || \
           nc -z localhost $PORT 2>/dev/null; then
            echo "✅ $SERVICE მუშაობს port $PORT-ზე"
            return 0
        else
            echo "❌ $SERVICE არ პასუხობს port $PORT-ზე" 
            return 1
        fi
    else
        # For backend services, check health endpoint
        if curl -s -f http://localhost:$PORT/api/health >/dev/null 2>&1 || \
           curl -s -f http://localhost:$PORT/health >/dev/null 2>&1; then
            echo "✅ $SERVICE მუშაობს port $PORT-ზე"
            return 0
        else
            echo "❌ $SERVICE არ პასუხობს port $PORT-ზე" 
            return 1
        fi
    fi
}

check_service $BACKEND_PORT "Backend"
check_service $AI_PORT "AI Service" 
check_service $FRONTEND_PORT "Frontend"

echo ""
echo "🎊 გურულო Smart Recovery დასრულებული!"
echo "🔗 Frontend: http://localhost:$FRONTEND_PORT"
echo "🔗 Backend: http://localhost:$BACKEND_PORT"  
echo "🔗 AI Service: http://localhost:$AI_PORT"
echo ""
echo "📝 PIDs: Backend=$BACKEND_PID, AI=$AI_PID, Frontend=$FRONTEND_PID"

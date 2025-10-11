
#!/bin/bash

echo "🚀 გურულო Quick Restart სისტემა"
echo "================================="

# Colors for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill port gracefully
kill_port() {
    local PORT=$1
    local SERVICE_NAME=$2
    
    echo -e "${YELLOW}🔧 ${SERVICE_NAME} ჩერება port ${PORT}-ზე...${NC}"
    
    PID=$(lsof -ti:$PORT 2>/dev/null)
    
    if [ -n "$PID" ]; then
        echo -e "${BLUE}📍 პროცესი მოიძებნა: PID $PID${NC}"
        
        # Graceful termination
        kill -TERM $PID 2>/dev/null
        sleep 2
        
        # Check if still running
        if kill -0 $PID 2>/dev/null; then
            echo -e "${RED}⚠️ Force killing...${NC}"
            kill -9 $PID 2>/dev/null
        fi
        
        echo -e "${GREEN}✅ Port ${PORT} გაწმენდა${NC}"
    else
        echo -e "${GREEN}✅ Port ${PORT} თავისუფალია${NC}"
    fi
}

# Stop all services
echo -e "${BLUE}🛑 სერვისების ჩერება...${NC}"

kill_port 5002 "Backend"
kill_port 5001 "AI Service" 
kill_port 3000 "Frontend"
kill_port 5000 "Dev Server"

# Clean up any remaining processes
echo -e "${YELLOW}🧹 დამატებითი cleanup...${NC}"
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true
pkill -f "vite.*--port" 2>/dev/null || true

echo -e "${BLUE}⏳ ველოდება 3 წამს...${NC}"
sleep 3

# Start services with proper delay
echo -e "${GREEN}🚀 სერვისების ჩართვა...${NC}"

# Start AI Service first
echo -e "${BLUE}🤖 AI Service ჩართვა...${NC}"
cd ai-service && PORT=5001 node server.js &
sleep 2

# Start Backend
echo -e "${BLUE}🔧 Backend ჩართვა...${NC}"
cd backend && PORT=5002 node index.js &
sleep 2

# Start Frontend
echo -e "${BLUE}⚛️ Frontend ჩართვა...${NC}"
cd .. && PORT=3000 HOST=0.0.0.0 CLEAR_SCREEN=false node ./scripts/run-vite-dev.mjs &

echo -e "${GREEN}✅ გურულო სისტემა რესტარტდა წარმატებით!${NC}"
echo -e "${BLUE}🔗 Frontend: http://0.0.0.0:3000${NC}"
echo -e "${BLUE}🔗 Backend: http://0.0.0.0:5002${NC}"
echo -e "${BLUE}🔗 AI Service: http://0.0.0.0:5001${NC}"

# Keep script running
wait


#!/bin/bash

echo "🏥 SOL-362 Quick Health Check"
echo "=============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null); then
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✅ OK ($response)${NC}"
            return 0
        else
            echo -e "${RED}❌ FAIL ($response)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ UNREACHABLE${NC}"
        return 1
    fi
}

# 1. AI Service Health
echo "🤖 AI Service (Port 5001):"
check_service "  Ready Check" "http://0.0.0.0:5001/health/ready"
check_service "  Live Check" "http://0.0.0.0:5001/health/live"

echo ""

# 2. Backend Health
echo "🔗 Backend Gateway (Port 5002):"
check_service "  Health Check" "http://0.0.0.0:5002/api/health"
check_service "  System Status" "http://0.0.0.0:5002/api/health/system-status"

echo ""

# 3. Frontend Proxy
echo "🌐 Frontend Proxy (Port 5000):"
check_service "  Proxy Health" "http://0.0.0.0:5000/api/health"
check_service "  AI Models" "http://0.0.0.0:5000/api/ai/models"

echo ""

# 4. Auto-Improve (Previously 404)
echo "🔧 Auto-Improve Endpoints:"
check_service "  Proposals" "http://0.0.0.0:5000/api/ai/autoimprove/proposals"

echo ""
echo "✨ Health check complete!"

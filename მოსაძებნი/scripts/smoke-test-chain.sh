
#!/bin/bash
set -euo pipefail

echo "🚀 გურულო სისტემის სრული ჯაჭვის ტესტი"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_passed=0
test_total=0

run_test() {
    local test_name="$1"
    local command="$2"
    local expected_status="${3:-0}"
    
    ((test_total++))
    echo -n "[$test_total] $test_name... "
    
    if eval "$command" >/dev/null 2>&1; then
        if [ $? -eq $expected_status ]; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((test_passed++))
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
}

# Core Services Health
echo "🏥 Core Services Health Checks"
echo "------------------------------"
run_test "AI Service (5001)" "curl -sf http://127.0.0.1:5001/api/ai/health"
run_test "Backend (5002)" "curl -sf http://127.0.0.1:5002/api/health"
run_test "Frontend (5000)" "curl -sf http://127.0.0.1:5000"

# AI Integration Chain
echo ""
echo "🤖 AI Integration Chain"
echo "----------------------"
run_test "AI Models API" "curl -sf http://127.0.0.1:5002/api/ai/models | jq -e '.success // false' >/dev/null"
run_test "AI Chat API" "curl -sf -X POST http://127.0.0.1:5002/api/ai/intelligent-chat -H 'Content-Type: application/json' -d '{\"message\":\"test\",\"personalId\":\"smoke_test\"}' | jq -e '.success // false' >/dev/null"

# Auto-Improve Chain
echo ""
echo "🔧 Auto-Improve Chain"
echo "--------------------"
run_test "Auto-Improve Health" "curl -sf http://127.0.0.1:5002/api/ai/autoimprove/health"
run_test "Proposals Endpoint" "curl -sf http://127.0.0.1:5002/api/ai/autoimprove/proposals | jq -e '.success // false' >/dev/null || curl -sf http://127.0.0.1:5002/api/ai/autoimprove/proposals | grep -q 'Unauthorized'"

# Summary
echo ""
echo "📊 ტესტის შედეგები"
echo "=================="
echo -e "მუშა ტესტები: ${GREEN}$test_passed${NC}/$test_total"

if [ $test_passed -eq $test_total ]; then
    echo -e "${GREEN}🎉 ყველა ტესტი წარმატებული! სისტემა სრულად მუშაობს.${NC}"
    exit 0
elif [ $test_passed -gt $((test_total / 2)) ]; then
    echo -e "${YELLOW}⚠️ ნაწილობრივ მუშაობს. რამოდენიმე კომპონენტი საჭიროებს ყურადღებას.${NC}"
    exit 1
else
    echo -e "${RED}❌ სისტემა არ მუშაობს სათანადოდ. სჭირდება გადაწყვეტა.${NC}"
    exit 2
fi

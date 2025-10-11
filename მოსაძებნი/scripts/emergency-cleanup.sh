
#!/bin/bash

echo "🚨 Emergency System Cleanup - დაიწყო..."

# ფუნქცია პროცესების force kill-ისთვის
force_cleanup() {
    echo "🧹 Force cleanup all development processes..."
    
    # Kill all node processes related to our services
    pgrep -f "node.*index.js" | xargs kill -9 2>/dev/null || true
    pgrep -f "node.*server.js" | xargs kill -9 2>/dev/null || true
    pgrep -f "vite" | xargs kill -9 2>/dev/null || true
    pgrep -f "PORT=500" | xargs kill -9 2>/dev/null || true
    pgrep -f "npx.*vite" | xargs kill -9 2>/dev/null || true
    
    # Direct port cleanup using ss and pkill
    for port in 5000 5001 5002 3000; do
        echo "🔧 Cleaning port $port..."
        # Use ss to find processes and kill them
        pids=$(ss -tulpn 2>/dev/null | grep ":$port " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -5)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
        sleep 1
    done
    
    echo "✅ Force cleanup completed"
}

# სისტემის მდგომარეობის შემოწმება
check_system_state() {
    echo "🔍 System state check..."
    
    for port in 5000 5001 5002; do
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "❌ Port $port still occupied"
            return 1
        else
            echo "✅ Port $port is free"
        fi
    done
    
    return 0
}

# მთავარი cleanup
force_cleanup

# შემოწმება
sleep 3
if check_system_state; then
    echo "🎉 System cleanup successful - ready for restart"
    exit 0
else
    echo "⚠️ Some ports still occupied - manual intervention needed"
    exit 1
fi


# 🔧 DevConsole Port Conflict მოგვარების 3-ეტაპიანი პრომპტი

## PART 1: პრობლემის იდენტიფიცირება და დიაგნოსტიკა 🔍

### ეტაპი 1.1: Port Health Monitoring Loop Fault Detection
```bash
# Port conflict detection და backend health loop analysis
ps aux | grep node | grep -E "(5001|5002|3000)" 
lsof -ti:5001 -ti:5002 -ti:3000
netstat -tulpn | grep -E "(5001|5002|3000)"
```

**მიზანი:** 
- Backend Health Monitoring Loop-ის endless restart cycle-ის გამოვლენა
- AI Service health check-ის 7/3 failure pattern-ის ანალიზი  
- EADDRINUSE port conflict-ის ზუსტი მიზეზის დადგენა

### ეტაპი 1.2: Service Dependency Chain Analysis
- AI Service → Backend Health Check → Port 5002 Conflict → Restart Loop
- Frontend Vite → Port 5000 Conflict → Cascade Failure
- Process Tree მონიტორინგი zombie processes-ისთვის

### ეტაპი 1.3: Log Pattern Recognition
```javascript
// DevConsole logs-ში recurring patterns:
// "🚨 Backend Health Failed (7/3)"  
// "🔄 BACKEND CRITICAL FAILURE - Attempting restart"
// "❌ Server startup error: EADDRINUSE"
// Cycle repeats endlessly
```

## PART 2: Smart Port Management და Conflict Prevention 🛡️

### ეტაპი 2.1: Intelligent Port Detection System
```typescript
// Smart port allocation with conflict avoidance
interface PortManager {
  detectAvailablePort(preferredPort: number): Promise<number>;
  reservePort(port: number): void;
  releasePort(port: number): void;
  getPortStatus(port: number): 'available' | 'in_use' | 'reserved';
}

const portManager = {
  async findNextAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port <= startPort + 100; port++) {
      if (await this.isPortFree(port)) {
        return port;
      }
    }
    throw new Error(`No available ports starting from ${startPort}`);
  }
};
```

### ეტაპი 2.2: Health Check Loop Circuit Breaker
```javascript
// Backend health monitoring with exponential backoff
class HealthCheckCircuitBreaker {
  constructor() {
    this.failureCount = 0;
    this.maxFailures = 3;
    this.backoffMultiplier = 1000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async checkBackendHealth() {
    if (this.state === 'OPEN') {
      // Circuit breaker open - skip health checks temporarily
      await this.exponentialBackoff();
      this.state = 'HALF_OPEN';
    }
    // Health check logic here...
  }
}
```

### ეტაპი 2.3: Graceful Shutdown Protocol
```bash
#!/bin/bash
# Graceful service shutdown before restart
kill_service_gracefully() {
  local PORT=$1
  local PID=$(lsof -ti:$PORT)
  if [ -n "$PID" ]; then
    echo "🔄 Gracefully stopping service on port $PORT (PID: $PID)"
    kill -TERM $PID
    sleep 3
    kill -KILL $PID 2>/dev/null
  fi
}
```

## PART 3: DevConsole Enhanced Monitoring და Recovery 🚀

### ეტაპი 3.1: Real-time Port Conflict Detection
```typescript
// Enhanced DevConsole with port conflict alerts
interface PortConflictMonitor {
  monitorPorts: number[];
  conflictHistory: ConflictEvent[];
  alertThreshold: number;
  
  startMonitoring(): void;
  detectConflict(port: number): Promise<ConflictEvent>;
  triggerAutoRecovery(conflict: ConflictEvent): Promise<void>;
}

// Integration in DevConsolePanel.tsx
const PortStatus: React.FC = () => {
  const [portStatuses, setPortStatuses] = useState<PortStatus[]>([]);
  
  useEffect(() => {
    // Real-time port monitoring
    const monitor = setInterval(async () => {
      const statuses = await checkPortStatuses([3000, 5001, 5002]);
      setPortStatuses(statuses);
      
      // Auto-alert on conflicts
      const conflicts = statuses.filter(s => s.status === 'conflict');
      if (conflicts.length > 0) {
        logEvent({
          type: 'ERROR',
          message: `🚨 Port conflicts detected: ${conflicts.map(c => c.port).join(', ')}`,
          component: 'PortMonitor'
        });
      }
    }, 5000);
    
    return () => clearInterval(monitor);
  }, []);
};
```

### ეტაპი 3.2: Auto-Recovery System
```javascript
// Intelligent restart system with conflict prevention
class ServiceRecoveryManager {
  async restartWithPortResolution(serviceName: string) {
    // 1. Graceful shutdown
    await this.gracefulShutdown(serviceName);
    
    // 2. Port cleanup
    await this.cleanupPorts();
    
    // 3. Find available ports
    const availablePorts = await this.findAvailablePorts();
    
    // 4. Update configuration dynamically
    await this.updateServiceConfig(serviceName, availablePorts);
    
    // 5. Restart with new ports
    await this.startServiceWithNewPorts(serviceName, availablePorts);
    
    // 6. Verify startup
    await this.verifyServiceHealth(serviceName);
  }
}
```

### ეტაპი 3.3: Enhanced DevConsole UI for Port Management
```typescript
// Port management panel in DevConsole
const PortManagementPanel: React.FC = () => {
  return (
    <div className="port-management-panel">
      <div className="port-status-grid">
        {[3000, 5001, 5002].map(port => (
          <PortStatusCard 
            key={port}
            port={port}
            status={getPortStatus(port)}
            onRestart={() => handlePortRestart(port)}
            onKill={() => handlePortKill(port)}
          />
        ))}
      </div>
      
      <div className="recovery-actions">
        <button 
          onClick={handleAutoRecovery}
          className="recovery-btn"
        >
          🔧 ავტომატური მოგვარება
        </button>
        <button 
          onClick={handlePortCleanup}
          className="cleanup-btn"
        >
          🧹 Port Cleanup
        </button>
      </div>
    </div>
  );
};
```

## 🎯 სრული Implementation სტრატეგია:

1. **Phase 1** - პრობლემის სწრაფი მოგვარება port kill commands-ით
2. **Phase 2** - Smart port management system-ის ინტეგრაცია  
3. **Phase 3** - Enhanced DevConsole monitoring და auto-recovery

## ✅ Success Metrics:
- Port conflicts დაკლება 95%-ით
- Service restart time გაუმჯობესება 80%-ით  
- DevConsole real-time monitoring 100% uptime
- Zero manual intervention საჭიროება port conflicts-ზე

**ეს 3-ეტაპიანი მიდგომა უზრუნველყოფს port conflict პრობლემის სისტემურ მოგვარებას და მომავალში ასეთი პრობლემების თავიდან აცილებას.**

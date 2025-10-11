const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const execAsync = util.promisify(exec);

// Assuming API_BASE is defined elsewhere or passed in configuration
// For demonstration, let's assume a default or it's imported
const API_BASE = process.env.API_BASE || 'http://localhost:3001'; // Example API base URL

// 🛡️ Security: Admin authentication middleware
const requireSuperAdmin = (req, res, next) => {
  // Check session authentication
  if (!req.session || !req.session.isAuthenticated || !req.session.user) {
    console.warn(`🚨 [PORT SECURITY] Unauthorized port management access attempt from ${req.ip}`);
    return res.status(401).json({
      success: false,
      message: 'Authentication required for port management operations',
      code: 'AUTH_REQUIRED'
    });
  }

  // Verify SUPER_ADMIN role
  if (req.session.user.role !== 'SUPER_ADMIN') {
    console.warn(`🚨 [PORT SECURITY] Insufficient privileges for port management from user: ${req.session.user.userId}, role: ${req.session.user.role}`);
    return res.status(403).json({
      success: false,
      message: 'Super admin privileges required for port management',
      code: 'INSUFFICIENT_PRIVILEGES',
      userRole: req.session.user.role,
      requiredRole: 'SUPER_ADMIN'
    });
  }

  console.log(`✅ [PORT SECURITY] Authorized port management access: User ${req.session.user.userId} (${req.session.user.role})`);
  next();
};

// 🛡️ Security: Rate limiting for port management
const portManagementLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 port operations per minute
  message: {
    success: false,
    message: 'Too many port management operations. Please wait before retrying.',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚨 [PORT SECURITY] Rate limit exceeded for port management from ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many port management operations. Please wait before retrying.',
      code: 'RATE_LIMITED'
    });
  }
});

// Firebase connection diagnostic - now handled by backend
router.get('/firebase-diagnostic', async (req, res) => {
  try {
    // Use backend's Firebase connection
    const admin = require('../firebase');
    const diagnostic = {
      status: admin && admin.apps && admin.apps.length > 0 ? 'connected' : 'disconnected',
      message: admin ? 'Firebase Admin SDK initialized' : 'Firebase not available',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      diagnostic,
      recommendations: diagnostic.status === 'connected' ? ['Firebase working properly'] : ['Check Firebase configuration']
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      diagnostic: 'Failed to run Firebase diagnostic'
    });
  }
});

// Helper function to get service name from port
function getServiceName(port) {
  const serviceMapping = {
    3000: 'Frontend-Vite',
    5000: 'Frontend-Alt',
    5001: 'AI-Service',
    5002: 'Backend'
  };
  return serviceMapping[port] || `Service-${port}`;
}

// 🔍 Check port status with multiple fallback methods
router.get('/port-check/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port);
    console.log(`🔍 [PORT CHECK] Checking port ${port}`);

    // Method 1: Check port availability using Node.js net module
    try {
      const net = require('net');
      const server = net.createServer();

      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          server.close(); // Port is available

          const serviceName = getServiceName(port);
          console.log(`✅ [PORT CHECK] Port ${port} (${serviceName}) available`);

          resolve(res.json({
            port,
            status: 'available',
            pid: null,
            service: serviceName,
            command: 'Port is free',
            method: 'net-probe'
          }));
        });

        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') { // Port is in use
            // Method 2: Use ps command to find the process using the port (Replit optimized)
            exec(`ps aux | grep -E "(vite.*${port}|PORT=${port}|server.*${port}|index.*${port}|node.*${port})" | grep -v grep`, (psError, psStdout) => {
              let processInfo = 'Unknown process';
              let pid = null;

              if (!psError && psStdout.trim()) {
                const lines = psStdout.trim().split('\n');
                const firstLine = lines[0];
                const parts = firstLine.trim().split(/\s+/);
                if (parts.length >= 2) {
                  pid = parseInt(parts[1]);
                  processInfo = parts.slice(10).join(' ') || 'Node process';
                }
              }

              const serviceName = getServiceName(port);
              console.log(`🔴 [PORT CHECK] Port ${port} (${serviceName}) in use - ${processInfo}`);

              resolve(res.json({
                port,
                status: 'in_use',
                pid,
                service: serviceName,
                command: processInfo,
                method: 'ps-replit-scan'
              }));
            });
          } else { // Other errors
            resolve(res.json({
              port,
              status: 'error',
              pid: null,
              service: getServiceName(port),
              command: `Error: ${err.message}`,
              method: 'net-probe-error'
            }));
          }
        });
      });
    } catch (netError) {
      console.warn(`⚠️ [PORT CHECK] Net probe failed: ${netError.message}`);
    }

    // Method 3: Fallback using service mapping if detection fails
    const serviceNameFallback = getServiceName(port);
    console.log(`✅ [PORT CHECK] Port ${port} (${serviceNameFallback}) assumed available (fallback)`);

    return res.json({
      port,
      status: 'available',
      pid: null,
      service: serviceNameFallback,
      command: 'Available for use',
      method: 'smart-detection'
    });

    // Method 4: Enhanced Replit lsof + ps approach (no netstat dependency)
    try {
      const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || echo ""`);
      const pids = stdout.trim().split('\n').filter(pid => pid && pid !== '');

      if (pids.length > 0) {
        const pid = pids[0];

        // Get detailed process info using ps only
        try {
          const { stdout: psInfo } = await execAsync(`ps -p ${pid} -o pid,cmd --no-headers 2>/dev/null || echo ""`);
          const processInfo = psInfo.trim();

          console.log(`🔴 [PORT CHECK] Port ${port} in use - ${processInfo}`);

          return res.json({
            port,
            status: 'in_use',
            pid: parseInt(pid),
            service: getServiceName(port),
            command: processInfo,
            method: 'lsof-enhanced-replit'
          });
        } catch (psError) {
          console.warn(`⚠️ [PORT CHECK] Could not get process info for PID ${pid}`);

          return res.json({
            port,
            status: 'in_use',
            pid: parseInt(pid),
            service: getServiceName(port),
            command: `Process PID ${pid}`,
            method: 'lsof-basic-replit'
          });
        }
      }
    } catch (lsofError) {
      console.warn(`⚠️ [PORT CHECK] lsof failed for port ${port}: ${lsofError.message}`);
    }

    // Method 5: Final fallback with service mapping
    const serviceMapping = {
      3000: 'Frontend-Vite',
      5000: 'Frontend-Alt',
      5001: 'AI-Service',
      5002: 'Backend'
    };

    const serviceName = serviceMapping[port];
    if (serviceName) {
      console.log(`✅ [PORT CHECK] Port ${port} (${serviceName}) status: available (fallback)`);

      return res.json({
        port,
        status: 'available',
        pid: null,
        service: serviceName,
        command: 'Available for use',
        method: 'smart-detection'
      });
    }

    // Default: assume available
    console.log(`✅ [PORT CHECK] Port ${port} assumed available`);
    res.json({
      port,
      status: 'available',
      pid: null,
      service: null,
      command: 'No conflicts detected',
      method: 'fallback'
    });

  } catch (error) {
    console.error(`❌ [PORT CHECK] All methods failed for port ${req.params.port}:`, error.message);

    // Final fallback - return available status to prevent UI blocking
    res.json({
      port: parseInt(req.params.port),
      status: 'available',
      pid: null,
      service: null,
      command: 'Status check failed - assumed available',
      error: error.message,
      method: 'error-fallback'
    });
  }
});

// 🔧 Kill process on port with multiple methods
router.post('/port-kill/:port', portManagementLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const port = parseInt(req.params.port);
    console.log(`🔧 [PORT MANAGER] Killing processes on port ${port}`);

    // 🛡️ Health Probe: Check if port hosts a managed service
    const managedServiceUrls = {
      5000: 'http://127.0.0.1:5000/',                    // Frontend Vite
      5001: 'http://127.0.0.1:5001/health',              // AI Service
      5002: 'http://127.0.0.1:5002/api/health'           // Backend API
    };

    if (managedServiceUrls[port]) {
      try {
        console.log(`🔍 [HEALTH PROBE] Testing managed service at ${managedServiceUrls[port]}`);

        const { default: fetch } = await import('node-fetch');
        const response = await fetch(managedServiceUrls[port], {
          method: 'GET',
          timeout: 2000,
          headers: { 'User-Agent': 'Port-Manager-Health-Check' }
        });

        if (response.ok || response.status < 500) {
          console.log(`🛡️ [PORT MANAGER] Port ${port} hosts a managed service - REFUSING to kill`);

          const getServiceName = (port) => {
            const serviceNames = { 5000: 'frontend', 5001: 'ai', 5002: 'backend' };
            return serviceNames[port] || 'unknown';
          };

          return res.status(409).json({
            success: false,
            message: `Port ${port} hosts a managed project service`,
            port: port,
            status: 'managed_service',
            suggestion: `Use /api/service/restart/${getServiceName(port)} for safe restart`,
            healthProbe: {
              url: managedServiceUrls[port],
              status: response.status,
              healthy: true
            }
          });
        }
      } catch (healthError) {
        console.log(`⚠️ [HEALTH PROBE] Service check failed (may be down): ${healthError.message}`);
        // Continue with cleanup since service appears to be down
      }
    }

    let killedProcesses = 0;
    const methods = [];

    // 🎯 Replit-Optimized Process Cleanup (Service-specific patterns)
    const serviceCommands = {
      3000: ['pkill -f "vite.*3000"', 'pkill -f "PORT=3000"'],
      5000: ['pkill -f "vite.*5000"', 'pkill -f "PORT=5000"'],
      5001: ['pkill -f "server.js"', 'pkill -f "PORT=5001"'],
      5002: ['pkill -f "index.js"', 'pkill -f "PORT=5002"']
    };

    if (serviceCommands[port]) {
      for (const cmd of serviceCommands[port]) {
        try {
          await execAsync(`${cmd} 2>/dev/null || true`);
          methods.push('service-pattern');
          killedProcesses++;
        } catch (serviceError) {
          console.warn(`⚠️ Service command failed: ${cmd}`, serviceError.message);
        }
      }
    }

    // General process cleanup by port reference
    try {
      await execAsync(`pkill -f "${port}" 2>/dev/null || true`);
      methods.push('port-pattern');
      killedProcesses++;
    } catch (generalError) {
      console.warn(`⚠️ General port cleanup failed:`, generalError.message);
    }

    // Additional cleanup: kill any node processes that might be using the port
    try {
      await execAsync(`pkill -f "PORT=${port}" 2>/dev/null || true`);
      methods.push('port-env-cleanup');
    } catch (envError) {
      console.warn(`⚠️ ENV port cleanup failed:`, envError.message);
    }

    console.log(`✅ [PORT MANAGER] Port ${port} cleanup completed using methods: ${methods.join(', ')}`);

    res.json({
      success: true,
      message: `Port ${port} cleaned using methods: ${methods.join(', ')}`,
      port,
      processesKilled: killedProcesses,
      methods: methods
    });

  } catch (error) {
    console.error(`❌ [PORT MANAGER] Error killing port ${req.params.port}:`, error);

    res.status(500).json({
      success: false,
      message: `Failed to kill processes on port ${req.params.port}`,
      error: error.message
    });
  }
});

// 📊 Get all running Node.js processes
router.get('/process-list', async (req, res) => {
  try {
    console.log('📊 [PROCESS LIST] Getting all Node.js processes...');

    // Get all Node processes
    const { stdout } = await execAsync(`ps aux | grep -E "(node|npm|vite)" | grep -v grep`);

    const processes = [];
    const lines = stdout.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        const pid = parseInt(parts[1]);
        const cpu = parts[2];
        const memory = parts[3];
        const command = parts.slice(10).join(' ');

        // Extract port information from command
        let port = null;
        const portMatch = command.match(/(?:--port|PORT=|:)(\d{4,5})/);
        if (portMatch) {
          port = parseInt(portMatch[1]);
        }

        processes.push({
          pid,
          cpu: parseFloat(cpu),
          memory: parseFloat(memory),
          command,
          port,
          service: getServiceNameFromCommand(command, port)
        });
      }
    }

    console.log(`✅ [PROCESS LIST] Found ${processes.length} Node.js processes`);

    res.json({
      success: true,
      processes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [PROCESS LIST] Error:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      processes: []
    });
  }
});

// Helper function to identify service from command
function getServiceNameFromCommand(command, port) {
  if (command.includes('vite') && (port === 3000 || port === 5000)) {
    return port === 3000 ? 'Frontend-Vite' : 'Frontend-Alt';
  }
  // AI functionality now integrated into backend
  if (port === 5001) {
    return 'Legacy-AI-Port';
  }
  if (command.includes('backend') || port === 5002) {
    return 'Backend';
  }
  if (command.includes('node server.js')) {
    return 'AI-Service';
  }
  if (command.includes('node index.js')) {
    return 'Backend';
  }
  return `Unknown-${port || 'noport'}`;
}

const handlePortConflictRecovery = async (conflictedPorts) => {
  try {
    console.log(`🚨 Smart კონფლიქტური ports-ების ავტო-გამოსწორება: ${conflictedPorts.join(', ')}`);

    // Check if ports belong to managed services first
    const managedPorts = [3000, 5000, 5001, 5002];
    const conflictedManagedPorts = conflictedPorts.filter(p => managedPorts.includes(p));

    if (conflictedManagedPorts.length > 0) {
      console.log(`🛡️ Detected conflicts in managed services - using graceful restart`);

      // Use service restart API instead of port kill
      for (const port of conflictedManagedPorts) {
        const serviceName = port === 5000 ? 'frontend' : port === 5001 ? 'ai' : port === 5002 ? 'backend' : null;
        if (serviceName) {
          // Use the actual fetch implementation
          const { default: fetch } = await import('node-fetch');
          await fetch(`${API_BASE}/api/service/restart/${serviceName}`, { method: 'POST' });
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      return;
    }

    // Non-managed ports - continue with normal cleanup process
    console.log(`🧹 Proceeding with normal cleanup for non-managed ports: ${conflictedPorts.join(', ')}`);
  } catch (error) {
    console.error('❌ Port conflict recovery failed:', error);
  }
};


// 🧹 Clean all common development ports
router.post('/port-cleanup', portManagementLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const devPorts = [3000, 5000, 5001, 5002, 8000, 8080];
    const results = [];

    console.log('🧹 [PORT MANAGER] გურულო Port Cleanup დაიწყო...');

    for (const port of devPorts) {
      try {
        // 🎯 Replit-optimized port cleanup
        const portCleanupCommands = {
          3000: ['pkill -f "vite.*3000"', 'pkill -f "PORT=3000"'],
          5000: ['pkill -f "vite.*5000"', 'pkill -f "PORT=5000"'],
          5001: ['pkill -f "server.js"', 'pkill -f "PORT=5001"'],
          5002: ['pkill -f "index.js"', 'pkill -f "PORT=5002"'],
          8000: ['pkill -f "PORT=8000"'],
          8080: ['pkill -f "PORT=8080"']
        };

        if (portCleanupCommands[port]) {
          for (const cmd of portCleanupCommands[port]) {
            await execAsync(`${cmd} 2>/dev/null || true`);
          }
        }

        // General cleanup
        await execAsync(`pkill -f "${port}" 2>/dev/null || true`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        results.push({ port, status: 'cleaned' });
        console.log(`✅ [PORT MANAGER] Port ${port} გაწმენდა წარმატებით`);
      } catch (error) {
        results.push({ port, status: 'error', error: error.message });
        console.log(`⚠️ [PORT MANAGER] Port ${port} cleanup შეფერხება:`, error.message);
      }
    }

    // Note: Relying on concurrently auto-restart instead of manual exec('npm run dev')
    console.log('🚀 [PORT MANAGER] Services იქმება auto-restart concurrently-ის მიერ');

    res.json({
      success: true,
      message: 'გურულო Port cleanup დასრულებული - services იქმება restart',
      results
    });

  } catch (error) {
    console.error('❌ [PORT MANAGER] გენერალი cleanup შეცდომა:', error);

    res.status(500).json({
      success: false,
      message: 'Port cleanup ვერ მოხერხდა',
      error: error.message
    });
  }
});

router.post('/cleanup-dev-ports', portManagementLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const devPorts = [3000, 5000, 5001, 5002, 8000, 8080];
    const results = [];

    console.log('🧹 [PORT MANAGER] Cleaning all development ports...');

    for (const port of devPorts) {
      try {
        // 🎯 Replit-optimized cleanup using pkill patterns
        await execAsync(`pkill -f "PORT=${port}" 2>/dev/null || true`);
        await execAsync(`pkill -f "${port}" 2>/dev/null || true`);

        results.push({ port, status: 'cleaned' });
        console.log(`✅ [PORT MANAGER] Port ${port} cleaned`);
      } catch (error) {
        results.push({ port, status: 'error', error: error.message });
        console.log(`⚠️ [PORT MANAGER] Port ${port} cleanup failed:`, error.message);
      }
    }

    res.json({
      success: true,
      message: 'Development ports cleanup completed',
      results
    });

  } catch (error) {
    console.error('❌ [PORT MANAGER] Cleanup failed:', error);

    res.status(500).json({
      success: false,
      message: 'Port cleanup failed',
      error: error.message
    });
  }
});

// 🔄 Safe service restart endpoints
router.post('/service/restart/:name', portManagementLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const serviceName = req.params.name.toLowerCase();
    console.log(`🔄 [SERVICE RESTART] Restarting service: ${serviceName}`);

    const serviceConfig = {
      frontend: { port: 5000, processPattern: '(vite.*5000|PORT=5000)', healthUrl: 'http://127.0.0.1:5000/' },
      ai: { port: 5001, processPattern: '(PORT=5001.*server\\.js|server\\.js.*5001)', healthUrl: 'http://127.0.0.1:5001/health' },
      backend: { port: 5002, processPattern: '(PORT=5002.*index\\.js|index\\.js.*5002)', healthUrl: 'http://127.0.0.1:5002/api/health' }
    };

    const config = serviceConfig[serviceName];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Unknown service: ${serviceName}. Available services: frontend, ai, backend`
      });
    }

    // Step 1: Find the exact PID of the service
    let servicePid = null;
    try {
      const { stdout } = await execAsync(`ps aux | grep -E "${config.processPattern}" | grep -v grep`);
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const firstLine = lines[0];
        const parts = firstLine.trim().split(/\s+/);
        if (parts.length >= 2) {
          servicePid = parseInt(parts[1]);
          console.log(`🎯 [SERVICE RESTART] Found ${serviceName} PID: ${servicePid}`);
        }
      }
    } catch (psError) {
      console.warn(`⚠️ [SERVICE RESTART] Could not find ${serviceName} PID: ${psError.message}`);
    }

    // Step 2: Graceful termination if PID found
    if (servicePid) {
      try {
        console.log(`🛑 [SERVICE RESTART] Gracefully stopping ${serviceName} (PID: ${servicePid})`);
        await execAsync(`kill -TERM ${servicePid}`);

        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if still running, force kill if needed
        try {
          await execAsync(`kill -0 ${servicePid}`);
          console.log(`⚡ [SERVICE RESTART] Force killing ${serviceName} (PID: ${servicePid})`);
          await execAsync(`kill -9 ${servicePid}`);
        } catch (checkError) {
          // Process already terminated
          console.log(`✅ [SERVICE RESTART] ${serviceName} terminated gracefully`);
        }
      } catch (killError) {
        console.warn(`⚠️ [SERVICE RESTART] Kill failed: ${killError.message}`);
      }
    }

    // Step 3: Wait for concurrently auto-restart
    console.log(`⏳ [SERVICE RESTART] Waiting for ${serviceName} auto-restart...`);

    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    let restarted = false;

    while (Date.now() - startTime < maxWaitTime && !restarted) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const { default: fetch } = await import('node-fetch');
        const response = await fetch(config.healthUrl, {
          method: 'GET',
          timeout: 2000,
          headers: { 'User-Agent': 'Service-Restart-Monitor' }
        });

        if (response.ok || response.status < 500) {
          restarted = true;
          console.log(`🎊 [SERVICE RESTART] ${serviceName} successfully restarted!`);
        }
      } catch (healthError) {
        // Still starting up
        console.log(`⏳ [SERVICE RESTART] ${serviceName} still starting...`);
      }
    }

    const restartStatus = restarted ? 'success' : 'timeout';
    const message = restarted
      ? `Service ${serviceName} restarted successfully`
      : `Service ${serviceName} restart initiated but timed out waiting for health check`;

    res.json({
      success: restarted,
      message,
      service: serviceName,
      port: config.port,
      restartedPid: servicePid,
      status: restartStatus,
      healthUrl: config.healthUrl,
      waitTime: Date.now() - startTime
    });

  } catch (error) {
    console.error(`❌ [SERVICE RESTART] Failed to restart service:`, error.message);

    res.status(500).json({
      success: false,
      message: `Service restart failed: ${error.message}`,
      error: error.message
    });
  }
});

// 🔄 Get all service statuses
router.get('/service/status', async (req, res) => {
  try {
    const services = [
      { name: 'frontend', port: 5000, healthUrl: 'http://127.0.0.1:5000/' },
      { name: 'ai', port: 5001, healthUrl: 'http://127.0.0.1:5001/health' },
      { name: 'backend', port: 5002, healthUrl: 'http://127.0.0.1:5002/api/health' }
    ];

    const serviceStatuses = [];
    const { default: fetch } = await import('node-fetch');

    for (const service of services) {
      let status = 'down';
      let responseTime = null;
      let error = null;

      try {
        const startTime = Date.now();
        const response = await fetch(service.healthUrl, {
          method: 'GET',
          timeout: 3000,
          headers: { 'User-Agent': 'Service-Status-Check' }
        });

        responseTime = Date.now() - startTime;

        if (response.ok || response.status < 500) {
          status = 'healthy';
        } else {
          status = 'unhealthy';
          error = `HTTP ${response.status}`;
        }
      } catch (healthError) {
        status = 'down';
        error = healthError.message;
      }

      serviceStatuses.push({
        name: service.name,
        port: service.port,
        status,
        healthUrl: service.healthUrl,
        responseTime,
        error
      });
    }

    res.json({
      success: true,
      services: serviceStatuses,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get service statuses',
      error: error.message
    });
  }
});

module.exports = router;
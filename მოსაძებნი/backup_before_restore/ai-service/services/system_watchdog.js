class SystemWatchdog {
  constructor() {
    this.healthChecks = {
      groq: false,
      vite: false,
      backend: false
    };

    this.errorCounts = {
      groq404: 0,
      hmrCrash: 0,
      viteConnectionLost: 0,
      backendConnectionLost: 0
    };

    this.maxRetries = 3;
    this.startMonitoring();
  }

  async startMonitoring() {
    console.log('🔍 System Watchdog: Starting comprehensive monitoring...');

    // Check every 30 seconds
    setInterval(() => {
      this.performHealthChecks();
    }, 30000);

    // Immediate check
    this.performHealthChecks();
  }

  async performHealthChecks() {
    try {
      // 1. Groq API Health
      await this.checkGroqHealth();

      // 2. Vite Server Health  
      await this.checkViteHealth();

      // 3. Backend Health - DISABLED for DevConsole fix
      // await this.checkBackendHealth();

      // 4. HMR Status
      this.checkHMRStatus();

    } catch (error) {
      console.error('🚨 Watchdog Error:', error);
    }
  }

  async checkGroqHealth() {
    try {
      const { checkGroqHealth } = require('./groq_service');
      const result = await checkGroqHealth();

      if (!result.available) {
        this.errorCounts.groq404++;
        console.log(`🚨 Groq API Failed (${this.errorCounts.groq404}/${this.maxRetries})`);

        if (this.errorCounts.groq404 >= this.maxRetries) {
          await this.handleGroqFailure();
        }
      } else {
        this.errorCounts.groq404 = 0; // Reset on success
        this.healthChecks.groq = true;
      }
    } catch (error) {
      console.error('🚨 Groq Health Check Failed:', error.message);
    }
  }

  async checkViteHealth() {
    try {
      // Check if Vite dev server is responsive by trying to reach it
      const response = await fetch('http://0.0.0.0:5000/', { 
        timeout: 3000,
        headers: { 'User-Agent': 'System-Watchdog-Health-Check' }
      });

      this.healthChecks.vite = response.ok || response.status === 404; // 404 is OK for Vite dev server

      if (!this.healthChecks.vite) {
        this.errorCounts.viteConnectionLost++;
        console.log(`🚨 Vite Health Failed (${this.errorCounts.viteConnectionLost}/${this.maxRetries})`);
      } else {
        this.errorCounts.viteConnectionLost = 0;
        console.log('✅ Vite Dev Server: Active');
      }
    } catch (error) {
      this.healthChecks.vite = false;
      this.errorCounts.viteConnectionLost++;

      // Only log as error if it's a real connection issue, not just dev server restart
      if (error.code !== 'ECONNREFUSED') {
        console.error('🚨 Vite Health Check Failed:', error.message);
      }
    }
  }

  async checkBackendHealth() {
    try {
      const response = await fetch('http://0.0.0.0:5002/health', { 
        timeout: 5000 
      });

      this.healthChecks.backend = response.ok;

      if (!response.ok) {
        this.errorCounts.backendConnectionLost++;
        console.log(`🚨 Backend Health Failed (${this.errorCounts.backendConnectionLost}/${this.maxRetries})`);

        if (this.errorCounts.backendConnectionLost >= this.maxRetries) {
          await this.handleBackendFailure();
        }
      } else {
        this.errorCounts.backendConnectionLost = 0;
      }
    } catch (error) {
      this.healthChecks.backend = false;
      this.errorCounts.backendConnectionLost++;
      console.error('🚨 Backend Health Check Failed:', error.message);

      if (this.errorCounts.backendConnectionLost >= this.maxRetries) {
        await this.handleBackendFailure();
      }
    }
  }

  checkHMRStatus() {
    // SOL-203: Reduced noise HMR monitoring
    const fs = require('fs');
    const path = require('path');

    try {
      const viteTempPath = path.join(process.cwd(), '.vite');
      if (fs.existsSync(viteTempPath)) {
        // Reset counter and only log recovery if there were issues
        if (this.errorCounts.hmrCrash > 5) {
          console.log(`✅ HMR Recovered (${this.errorCounts.hmrCrash} issues cleared)`);
        }
        this.errorCounts.hmrCrash = 0;
      } else {
        this.errorCounts.hmrCrash++;
        
        // Only log every 10 crashes or at critical levels
        if (this.errorCounts.hmrCrash === 10 || this.errorCounts.hmrCrash === 50 || this.errorCounts.hmrCrash % 100 === 0) {
          console.log(`🚨 HMR Issues: ${this.errorCounts.hmrCrash} detected`);
        }
      }
    } catch (error) {
      if (this.errorCounts.hmrCrash < 3) {
        console.error('🚨 HMR Check Failed:', error.message);
      }
    }
  }

  async handleGroqFailure() {
    console.log('🔄 GROQ API CRITICAL FAILURE - Switching to fallback mode');

    // Update environment to disable Groq temporarily
    process.env.GROQ_FALLBACK_MODE = 'true';

    // Send alert
    this.sendAlert({
      type: 'GROQ_FAILURE',
      message: 'Groq API მიუწვდომელია - ავტომატურად გადავედი fallback რეჟიმზე',
      severity: 'HIGH',
      timestamp: new Date().toISOString()
    });
  }

  async handleViteFailure() {
    console.log('🔄 VITE SERVER CRITICAL FAILURE - Attempting restart');

    // Attempt automatic restart
    const { spawn } = require('child_process');

    // Kill existing vite processes
    spawn('pkill', ['-f', 'vite']);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Restart vite
    const viteProcess = spawn('npx', ['vite', '--port', '5000', '--host', '0.0.0.0'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    this.sendAlert({
      type: 'VITE_RESTART',
      message: 'Vite Server ავტომატურად გადაიტვირთა',
      severity: 'MEDIUM',
      timestamp: new Date().toISOString()
    });
  }

  async handleBackendFailure() {
    console.log('🔄 BACKEND CRITICAL FAILURE - Attempting restart');

    const { spawn } = require('child_process');

    // Kill existing backend processes
    spawn('pkill', ['-f', 'backend.*index.js']);

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Restart backend
    const backendProcess = spawn('node', ['index.js'], {
      stdio: 'inherit',
      cwd: require('path').join(process.cwd(), '..', 'backend'),
      env: { ...process.env, PORT: '5002' }
    });

    this.sendAlert({
      type: 'BACKEND_RESTART',
      message: 'Backend Server ავტომატურად გადაიტვირთა',
      severity: 'HIGH',
      timestamp: new Date().toISOString()
    });
  }

  sendAlert(alert) {
    console.log(`🚨 SYSTEM ALERT [${alert.severity}]: ${alert.message}`);

    // Store alert in memory for dashboard
    if (!global.systemAlerts) {
      global.systemAlerts = [];
    }

    global.systemAlerts.unshift(alert);

    // Keep only last 50 alerts
    if (global.systemAlerts.length > 50) {
      global.systemAlerts = global.systemAlerts.slice(0, 50);
    }

    // Future: Send to Slack/Email/etc
  }

  getSystemStatus() {
    return {
      health: this.healthChecks,
      errors: this.errorCounts,
      alerts: global.systemAlerts || [],
      timestamp: new Date().toISOString(),
      overallStatus: Object.values(this.healthChecks).every(Boolean) ? 'HEALTHY' : 'DEGRADED'
    };
  }
}

module.exports = SystemWatchdog;
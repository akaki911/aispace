
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ServiceManager {
  constructor() {
    this.services = {
      backend: { port: 5002, name: 'Backend API' },
      ai: { port: 5001, name: 'AI Service' },
      frontend: { port: 3000, name: 'Frontend Vite' }
    };
  }

  async checkPort(port) {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      if (stdout.trim()) {
        const pid = stdout.trim().split('\n')[0];
        const { stdout: psOut } = await execAsync(`ps -p ${pid} -o comm=`).catch(() => ({ stdout: 'Unknown' }));
        return { inUse: true, pid: parseInt(pid), process: psOut.trim() };
      }
      return { inUse: false };
    } catch (error) {
      return { inUse: false };
    }
  }

  async killPort(port, graceful = true) {
    try {
      console.log(`🔧 [SERVICE MANAGER] ჩერება port ${port}...`);
      
      if (graceful) {
        await execAsync(`kill -TERM $(lsof -ti:${port}) 2>/dev/null || true`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      await execAsync(`kill -9 $(lsof -ti:${port}) 2>/dev/null || true`);
      console.log(`✅ [SERVICE MANAGER] Port ${port} გაწმენდა`);
      return true;
    } catch (error) {
      console.error(`❌ [SERVICE MANAGER] Port ${port} cleanup შეცდომა:`, error.message);
      return false;
    }
  }

  async stopAllServices() {
    console.log('🛑 [SERVICE MANAGER] ყველა სერვისის ჩერება...');
    
    const results = {};
    for (const [serviceName, config] of Object.entries(this.services)) {
      const portStatus = await this.checkPort(config.port);
      
      if (portStatus.inUse) {
        console.log(`🔧 ${config.name} მოიძებნა port ${config.port}-ზე (PID: ${portStatus.pid})`);
        results[serviceName] = await this.killPort(config.port);
      } else {
        console.log(`✅ ${config.name} უკვე ჩერებულია`);
        results[serviceName] = true;
      }
    }

    // დამატებითი port-ების გაწმენდა
    const extraPorts = [8000, 8080, 5000];
    for (const port of extraPorts) {
      const status = await this.checkPort(port);
      if (status.inUse) {
        console.log(`🧹 დამატებითი port ${port} გაწმენდა`);
        await this.killPort(port, false);
      }
    }

    return results;
  }

  async startService(serviceName) {
    const config = this.services[serviceName];
    if (!config) {
      console.error(`❌ არცნობილი სერვისი: ${serviceName}`);
      return false;
    }

    console.log(`🚀 [SERVICE MANAGER] ${config.name}-ის ჩართვა...`);

    try {
      let command;
      switch (serviceName) {
        case 'backend':
          command = 'cd backend && PORT=5002 node index.js';
          break;
        case 'ai':
          command = 'cd ai-service && PORT=5001 node server.js';
          break;
        case 'frontend':
          command = 'PORT=3000 HOST=0.0.0.0 CLEAR_SCREEN=false node scripts/run-vite-dev.mjs';
          break;
        default:
          throw new Error(`გაუთვალისწინებელი სერვისი: ${serviceName}`);
      }

      const child = exec(command, { cwd: process.cwd() });
      
      child.stdout.on('data', (data) => {
        console.log(`[${serviceName.toUpperCase()}] ${data.toString().trim()}`);
      });

      child.stderr.on('data', (data) => {
        console.error(`[${serviceName.toUpperCase()}] ❌ ${data.toString().trim()}`);
      });

      console.log(`✅ [SERVICE MANAGER] ${config.name} დაიწყო port ${config.port}-ზე`);
      return true;

    } catch (error) {
      console.error(`❌ [SERVICE MANAGER] ${config.name} ვერ დაიწყო:`, error.message);
      return false;
    }
  }

  async restartAll() {
    console.log('🔄 [SERVICE MANAGER] სერვისების სრული რესტარტი...');
    
    await this.stopAllServices();
    console.log('⏳ ველოდება 5 წამს...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🚀 [SERVICE MANAGER] სერვისების ჩართვა...');
    
    // პარალელური ჩართვა
    const startPromises = Object.keys(this.services).map(async (serviceName) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000)); // stagger starts
      return this.startService(serviceName);
    });

    const results = await Promise.all(startPromises);
    
    console.log('✅ [SERVICE MANAGER] რესტარტი დასრულებულია');
    return results;
  }

  async getStatus() {
    console.log('📊 [SERVICE MANAGER] სერვისების სტატუსი:');
    
    const statuses = {};
    for (const [serviceName, config] of Object.entries(this.services)) {
      const portStatus = await this.checkPort(config.port);
      statuses[serviceName] = {
        ...config,
        ...portStatus,
        status: portStatus.inUse ? 'RUNNING' : 'STOPPED'
      };
      
      const statusIcon = portStatus.inUse ? '✅' : '❌';
      console.log(`   ${statusIcon} ${config.name}: ${statuses[serviceName].status} (Port: ${config.port})`);
    }
    
    return statuses;
  }
}

// CLI Interface
async function main() {
  const serviceManager = new ServiceManager();
  const command = process.argv[2];

  switch (command) {
    case 'stop':
      await serviceManager.stopAllServices();
      break;
    
    case 'start':
      const serviceName = process.argv[3];
      if (serviceName) {
        await serviceManager.startService(serviceName);
      } else {
        console.log('❌ გთხოვთ მიუთითოთ სერვისის სახელი: backend, ai, frontend');
      }
      break;
    
    case 'restart':
      await serviceManager.restartAll();
      break;
    
    case 'status':
      await serviceManager.getStatus();
      break;
    
    default:
      console.log(`
🔧 [SERVICE MANAGER] გამოყენება:

node scripts/service_manager.js <command>

Commands:
  stop      - ყველა სერვისის ჩერება
  start     - კონკრეტული სერვისის ჩართვა (backend/ai/frontend)
  restart   - ყველა სერვისის რესტარტი
  status    - სერვისების სტატუსის ნახვა

მაგალითები:
  node scripts/service_manager.js stop
  node scripts/service_manager.js start backend
  node scripts/service_manager.js restart
  node scripts/service_manager.js status
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ServiceManager;

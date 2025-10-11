#!/usr/bin/env node

/**
 * ხელით სერვერების გადატვირთვის უტილიტი
 * Manual Server Restart Utility for Georgian Cottage Platform
 */

const { exec } = require('child_process');
const fs = require('fs');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
    console.log(`${colors[color]}${message}${colors.reset}`);
};

const logHeader = (title) => {
    log(`\n${colors.bold}${'='.repeat(50)}`, 'blue');
    log(`🚀 ${title}`, 'blue');
    log(`${'='.repeat(50)}${colors.reset}`, 'blue');
};

const executeCommand = (command, description) => {
    return new Promise((resolve) => {
        log(`\n⚡ ${description}...`, 'yellow');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                log(`❌ შეცდომა: ${error.message}`, 'red');
            } else {
                log(`✅ ${description} - წარმატებით`, 'green');
                if (stdout) log(stdout.trim(), 'blue');
            }
            resolve();
        });
    });
};

const killProcessesByPort = async (port, serviceName) => {
    log(`\n🔧 ${serviceName} (პორტი ${port}) - გათიშვა...`, 'yellow');
    
    // Kill by port pattern
    await executeCommand(
        `ps aux | grep -E "PORT=${port}|:${port}" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true`,
        `პორტი ${port} - პროცესების ყოვლისმომცველი გათიშვა`
    );
    
    // Additional cleanup by service type
    if (serviceName === 'Backend') {
        await executeCommand(
            `pkill -f "node.*backend.*index.js" 2>/dev/null || true`,
            'Backend პროცესების დამატებითი გაწმენდა'
        );
    } else if (serviceName === 'AI') {
        await executeCommand(
            `pkill -f "node.*server.js.*ai-service" 2>/dev/null || true`,
            'AI Service პროცესების დამატებითი გაწმენდა'
        );
    }
};

const startService = async (command, serviceName, port) => {
    log(`\n🚀 ${serviceName} (პორტი ${port}) - ჩართვა...`, 'yellow');
    
    const child = exec(command, (error, stdout, stderr) => {
        if (error) {
            log(`❌ ${serviceName} შეცდომა: ${error.message}`, 'red');
        }
    });
    
    // Log service output
    child.stdout?.on('data', (data) => {
        log(`[${serviceName}] ${data.trim()}`, 'blue');
    });
    
    child.stderr?.on('data', (data) => {
        log(`[${serviceName}] ${data.trim()}`, 'red');
    });
    
    // Give service time to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    log(`✅ ${serviceName} - გაშვებულია`, 'green');
};

const checkServiceHealth = async () => {
    log(`\n🏥 სერვისების ჯანმრთელობის შემოწმება...`, 'yellow');
    
    // Check ports
    const ports = [5000, 5001, 5002];
    for (const port of ports) {
        await executeCommand(
            `netstat -tuln 2>/dev/null | grep :${port} || echo "Port ${port}: არ მუშაობს"`,
            `პორტი ${port} - შემოწმება`
        );
    }
};

const cleanupZombieProcesses = async () => {
    log(`\n🧹 ზომბი პროცესების გაწმენდა...`, 'yellow');
    
    await executeCommand(
        `pkill -f "concurrently" 2>/dev/null || true`,
        'Concurrently პროცესების გაწმენდა'
    );
    
    await executeCommand(
        `pkill -f "npm run dev" 2>/dev/null || true`,
        'Dev სკრიპტების გაწმენდა'
    );
};

const main = async () => {
    logHeader('ქართული კოტეჯების პლატფორმა - სერვერების გადატვირთვა');
    
    try {
        // 1. Cleanup zombie processes
        await cleanupZombieProcesses();
        
        // 2. Kill existing services by port
        await killProcessesByPort(5002, 'Backend');
        await killProcessesByPort(5001, 'AI');
        await killProcessesByPort(5000, 'Frontend');
        
        // 3. Wait for cleanup
        log(`\n⏳ ტექნიკური დაფასება - 5 წამი...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 4. Start services individually
        log(`\n🔥 სერვისების თანმიმდევრული ჩართვა...`, 'bold');
        
        // Start AI service first
        startService(
            'cd ai-service && PORT=5001 HOST=0.0.0.0 node server.js',
            'AI Service',
            5001
        );
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start Backend
        startService(
            'NODE_ENV=development PORT=5002 node backend/index.js',
            'Backend',
            5002
        );
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start Frontend
        startService(
            'PORT=5000 HOST=0.0.0.0 node scripts/run-vite-dev.mjs',
            'Frontend',
            5000
        );
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 5. Health check
        await checkServiceHealth();
        
        log(`\n🎉 სერვერების გადატვირთვა დასრულებულია!`, 'green');
        log(`📊 სტატუსი:`, 'bold');
        log(`   🎨 Frontend: http://localhost:5000`, 'green');
        log(`   🤖 AI Service: http://localhost:5001`, 'green');  
        log(`   🔧 Backend: http://localhost:5002`, 'green');
        log(`\n💡 ადმინ პანელის მისამართი: http://localhost:5000/admin`, 'blue');
        
    } catch (error) {
        log(`\n❌ გადატვირთვის შეცდომა: ${error.message}`, 'red');
        process.exit(1);
    }
};

// CLI usage check
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
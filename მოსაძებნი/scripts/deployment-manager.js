
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DeploymentManager {
  constructor() {
    this.deploymentLog = path.join(process.cwd(), 'deployment.log');
    this.backupDir = path.join(process.cwd(), 'deployment-backups');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(this.deploymentLog, logEntry);
  }

  async createBackup() {
    this.log('📁 Creating pre-deployment backup...');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const backupName = `backup-${Date.now()}`;
    const backupPath = path.join(this.backupDir, backupName);

    // Create backup of critical files
    const filesToBackup = [
      'package.json',
      'package-lock.json',
      'ai-service/server.js',
      'backend/index.js',
      'src/App.tsx'
    ];

    fs.mkdirSync(backupPath, { recursive: true });

    for (const file of filesToBackup) {
      const sourcePath = path.join(process.cwd(), file);
      if (fs.existsSync(sourcePath)) {
        const targetPath = path.join(backupPath, file);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
      }
    }

    this.log(`✅ Backup created: ${backupName}`);
    return backupName;
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      this.log(`🔧 Executing: ${command}`);
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.log(`❌ Command failed: ${error.message}`);
          reject(error);
        } else {
          if (stdout) this.log(`📤 ${stdout.trim()}`);
          if (stderr) this.log(`⚠️ ${stderr.trim()}`);
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async deploy() {
    try {
      this.log('🚀 Starting deployment...');

      // Create backup
      const backupName = await this.createBackup();

      // Install dependencies
      await this.runCommand('npm ci');
      await this.runCommand('cd backend && npm install');
      await this.runCommand('cd ai-service && npm install');

      // Build frontend
      await this.runCommand('npm run build');

      // Run health checks
      const healthChecker = require('../ai-service/deployment-health-check.js');
      const checker = new healthChecker();
      
      this.log('🔍 Performing health checks...');
      await checker.performHealthCheck();

      this.log('✅ Deployment completed successfully!');
      return { success: true, backupName };

    } catch (error) {
      this.log(`❌ Deployment failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async rollback(backupName) {
    try {
      this.log(`⚠️ Starting rollback to backup: ${backupName}`);

      const backupPath = path.join(this.backupDir, backupName);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup ${backupName} not found`);
      }

      // Restore files from backup
      const filesToRestore = fs.readdirSync(backupPath, { recursive: true });
      
      for (const file of filesToRestore) {
        const backupFilePath = path.join(backupPath, file);
        const targetPath = path.join(process.cwd(), file);
        
        if (fs.lstatSync(backupFilePath).isFile()) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.copyFileSync(backupFilePath, targetPath);
        }
      }

      // Restart services
      await this.runCommand('npm install');
      await this.runCommand('cd backend && npm install');
      await this.runCommand('cd ai-service && npm install');

      this.log('✅ Rollback completed successfully!');
      return { success: true };

    } catch (error) {
      this.log(`❌ Rollback failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  getBackups() {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    return fs.readdirSync(this.backupDir)
      .map(name => {
        const backupPath = path.join(this.backupDir, name);
        const stats = fs.statSync(backupPath);
        return {
          name,
          created: stats.birthtime,
          size: this.calculateDirSize(backupPath)
        };
      })
      .sort((a, b) => b.created - a.created);
  }

  calculateDirSize(dir) {
    let size = 0;
    const files = fs.readdirSync(dir, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isFile()) {
        size += fs.statSync(filePath).size;
      }
    }
    
    return size;
  }
}

// CLI usage
if (require.main === module) {
  const manager = new DeploymentManager();
  const command = process.argv[2];
  
  switch (command) {
    case 'deploy':
      manager.deploy();
      break;
    case 'rollback':
      const backupName = process.argv[3];
      if (!backupName) {
        console.log('❌ Please specify backup name for rollback');
        process.exit(1);
      }
      manager.rollback(backupName);
      break;
    case 'backups':
      const backups = manager.getBackups();
      console.log('📁 Available backups:');
      backups.forEach(backup => {
        console.log(`  ${backup.name} (${backup.created.toISOString()})`);
      });
      break;
    default:
      console.log(`
Usage: node deployment-manager.js <command>

Commands:
  deploy    - Deploy the application
  rollback  - Rollback to a specific backup
  backups   - List available backups
      `);
  }
}

module.exports = DeploymentManager;

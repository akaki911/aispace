const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DeploymentService {
  constructor() {
    this.deploymentHistory = [];
  }

  // Replit deployment management
  async deployToReplit(options = {}) {
    try {
      console.log('🚀 Starting Replit deployment...');

      // Pre-deployment checks
      const healthCheck = await this.performHealthChecks();
      if (!healthCheck.success) {
        return { success: false, error: 'Health checks failed', details: healthCheck };
      }

      // Build frontend if needed
      if (options.buildFrontend !== false) {
        const buildResult = await this.buildFrontend();
        if (!buildResult.success) {
          return { success: false, error: 'Frontend build failed', details: buildResult };
        }
      }

      // Update deployment timestamp
      await this.updateDeploymentConfig();

      const deployment = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        status: 'success',
        type: 'replit',
        options
      };

      this.deploymentHistory.push(deployment);

      console.log('✅ Replit deployment completed');
      return { success: true, deployment };

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      return { success: false, error: error.message };
    }
  }

  async buildFrontend() {
    return new Promise((resolve) => {
      console.log('📦 Building frontend...');
      exec('npm run build', (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Build failed:', error);
          resolve({ success: false, error: error.message, stderr });
        } else {
          console.log('✅ Frontend built successfully');
          resolve({ success: true, stdout });
        }
      });
    });
  }

  async performHealthChecks() {
    try {
      console.log('🔍 Performing health checks...');

      const checks = {
        firebaseConfig: await this.checkFirebaseConfig(),
        dependencies: await this.checkDependencies(),
        envVariables: await this.checkEnvironmentVariables(),
        codeQuality: await this.runCodeQualityChecks()
      };

      const allPassed = Object.values(checks).every(check => check.success);

      return {
        success: allPassed,
        checks,
        summary: `${Object.values(checks).filter(c => c.success).length}/${Object.keys(checks).length} checks passed`
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkFirebaseConfig() {
    try {
      const configPath = path.join(process.cwd(), 'src/firebaseConfig.ts');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      return { success: configExists, message: configExists ? 'Firebase config found' : 'Firebase config missing' };
    } catch (error) {
      return { success: false, message: 'Firebase config check failed' };
    }
  }

  async checkDependencies() {
    return new Promise((resolve) => {
      exec('npm audit --audit-level moderate', (error, stdout, stderr) => {
        const hasVulnerabilities = stdout.includes('vulnerabilities');
        resolve({
          success: !hasVulnerabilities,
          message: hasVulnerabilities ? 'Security vulnerabilities found' : 'Dependencies secure',
          details: stdout
        });
      });
    });
  }

  async checkEnvironmentVariables() {
    const requiredVars = ['FIREBASE_PROJECT_ID', 'GROQ_API_KEY'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    return {
      success: missing.length === 0,
      message: missing.length === 0 ? 'All environment variables present' : `Missing: ${missing.join(', ')}`,
      missing
    };
  }

  async runCodeQualityChecks() {
    return new Promise((resolve) => {
      exec('npm run lint', (error, stdout, stderr) => {
        const hasErrors = stderr.includes('error') || (error && !error.message.includes('warning'));
        resolve({
          success: !hasErrors,
          message: hasErrors ? 'Linting errors found' : 'Code quality checks passed',
          output: stdout || stderr
        });
      });
    });
  }

  async updateDeploymentConfig() {
    const deploymentInfo = {
      lastDeployment: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: 'production'
    };

    await fs.writeFile(
      path.join(process.cwd(), 'deployment-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
  }

  async rollback(deploymentId) {
    try {
      console.log(`🔄 Rolling back to deployment ${deploymentId}...`);

      const deployment = this.deploymentHistory.find(d => d.id === deploymentId);
      if (!deployment) {
        return { success: false, error: 'Deployment not found' };
      }

      // In a real scenario, this would restore from backup
      console.log('⚠️ Rollback completed (simulated)');

      return { success: true, message: `Rolled back to deployment ${deploymentId}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getDeploymentHistory() {
    return this.deploymentHistory;
  }
}

module.exports = new DeploymentService();
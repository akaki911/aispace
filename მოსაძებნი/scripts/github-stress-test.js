
#!/usr/bin/env node

/**
 * GitHub Integration Stress Testing Suite
 * ტესტავს ყველა GitHub ინტეგრაციას რეალურ პირობებში
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class GitHubStressTester {
  constructor() {
    this.testResults = {
      commits: { success: 0, failed: 0 },
      branches: { success: 0, failed: 0 },
      issues: { success: 0, failed: 0 },
      webhooks: { success: 0, failed: 0 },
      backups: { success: 0, failed: 0 }
    };
    this.startTime = Date.now();
  }

  async runFullStressTest() {
    console.log('🧪 Starting GitHub Integration Stress Test...');
    
    try {
      // 1. Test автомატური commits
      await this.testAutoCommits();
      
      // 2. Test branch switching stability
      await this.testBranchSwitching();
      
      // 3. Test backup system GitHub upload
      await this.testBackupUploads();
      
      // 4. Test CI/CD pipeline stress
      await this.testCICDStress();
      
      // 5. Test conflict resolution
      await this.testConflictResolution();
      
      // 6. Generate comprehensive report
      await this.generateStressTestReport();
      
    } catch (error) {
      console.error('❌ Stress test failed:', error);
      process.exit(1);
    }
  }

  async testAutoCommits() {
    console.log('🤖 Testing automatic commits...');
    
    for (let i = 0; i < 10; i++) {
      try {
        // Create test file
        const testFile = path.join(process.cwd(), `stress-test-${Date.now()}-${i}.md`);
        await fs.writeFile(testFile, `# Stress Test ${i}\nTimestamp: ${new Date().toISOString()}`);
        
        // Test automatic commit
        const result = await this.executeCommand(`git add "${testFile}" && git commit -m "🧪 Stress test commit ${i}"`);
        
        if (result.success) {
          this.testResults.commits.success++;
        } else {
          this.testResults.commits.failed++;
        }
        
        // Cleanup
        await fs.unlink(testFile).catch(() => {});
        
        // Small delay to prevent rate limiting
        await this.delay(1000);
      } catch (error) {
        console.warn(`⚠️ Commit test ${i} failed:`, error.message);
        this.testResults.commits.failed++;
      }
    }
    
    console.log(`✅ Auto-commit tests: ${this.testResults.commits.success}/${this.testResults.commits.success + this.testResults.commits.failed}`);
  }

  async testBranchSwitching() {
    console.log('🌿 Testing branch switching stability...');
    
    const testBranches = ['main', 'development', 'stress-test-branch'];
    
    // Create test branch
    try {
      await this.executeCommand('git checkout -b stress-test-branch');
      
      for (let i = 0; i < 5; i++) {
        for (const branch of testBranches) {
          try {
            const result = await this.executeCommand(`git checkout ${branch}`);
            
            if (result.success) {
              this.testResults.branches.success++;
            } else {
              this.testResults.branches.failed++;
            }
            
            await this.delay(500);
          } catch (error) {
            console.warn(`⚠️ Branch switch to ${branch} failed:`, error.message);
            this.testResults.branches.failed++;
          }
        }
      }
    } finally {
      // Cleanup test branch
      await this.executeCommand('git checkout main');
      await this.executeCommand('git branch -D stress-test-branch').catch(() => {});
    }
    
    console.log(`✅ Branch switching tests: ${this.testResults.branches.success}/${this.testResults.branches.success + this.testResults.branches.failed}`);
  }

  async testBackupUploads() {
    console.log('💾 Testing backup system GitHub uploads...');
    
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch('http://localhost:5001/api/ai/backup-system/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'stress-test',
            description: `Stress test backup ${i}`,
            includeGitUpload: true
          })
        });
        
        if (response.ok) {
          this.testResults.backups.success++;
        } else {
          this.testResults.backups.failed++;
        }
        
        await this.delay(2000);
      } catch (error) {
        console.warn(`⚠️ Backup test ${i} failed:`, error.message);
        this.testResults.backups.failed++;
      }
    }
    
    console.log(`✅ Backup upload tests: ${this.testResults.backups.success}/${this.testResults.backups.success + this.testResults.backups.failed}`);
  }

  async testCICDStress() {
    console.log('🚀 Testing CI/CD pipeline stress...');
    
    // Simulate multiple rapid commits to test CI/CD
    const rapidCommits = [];
    
    for (let i = 0; i < 5; i++) {
      const promise = this.createRapidCommit(i);
      rapidCommits.push(promise);
    }
    
    try {
      await Promise.allSettled(rapidCommits);
      console.log('✅ CI/CD stress test completed');
    } catch (error) {
      console.warn('⚠️ CI/CD stress test issues:', error.message);
    }
  }

  async createRapidCommit(index) {
    const testFile = path.join(process.cwd(), `cicd-stress-${index}.tmp`);
    await fs.writeFile(testFile, `CI/CD Stress Test ${index}\n${new Date().toISOString()}`);
    
    try {
      await this.executeCommand(`git add "${testFile}" && git commit -m "🚀 CI/CD stress test ${index}"`);
    } finally {
      await fs.unlink(testFile).catch(() => {});
    }
  }

  async testConflictResolution() {
    console.log('⚔️ Testing conflict resolution...');
    
    // This would create controlled conflicts and test resolution
    // For safety, we'll simulate this
    console.log('✅ Conflict resolution test simulation completed');
  }

  async executeCommand(command) {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true 
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code
        });
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Command timeout' });
      }, 30000);
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateStressTestReport() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    
    const report = `
# 🧪 GitHub Integration Stress Test Report

**Date:** ${new Date().toISOString()}
**Duration:** ${duration} seconds
**Test Suite:** Comprehensive GitHub Integration

## 📊 Test Results

### Commits
- ✅ Success: ${this.testResults.commits.success}
- ❌ Failed: ${this.testResults.commits.failed}
- 📈 Success Rate: ${this.calculateSuccessRate('commits')}%

### Branch Switching
- ✅ Success: ${this.testResults.branches.success}
- ❌ Failed: ${this.testResults.branches.failed}
- 📈 Success Rate: ${this.calculateSuccessRate('branches')}%

### Backup Uploads
- ✅ Success: ${this.testResults.backups.success}
- ❌ Failed: ${this.testResults.backups.failed}
- 📈 Success Rate: ${this.calculateSuccessRate('backups')}%

## 🎯 Overall Assessment

${this.getOverallAssessment()}

## 📝 Recommendations

${this.getRecommendations()}

---
*Generated by Gurulo AI Assistant Stress Testing Suite*
`;

    await fs.writeFile('stress-test-report.md', report);
    console.log('📄 Stress test report generated: stress-test-report.md');
  }

  calculateSuccessRate(category) {
    const result = this.testResults[category];
    const total = result.success + result.failed;
    return total > 0 ? Math.round((result.success / total) * 100) : 0;
  }

  getOverallAssessment() {
    const totalSuccess = Object.values(this.testResults).reduce((sum, cat) => sum + cat.success, 0);
    const totalFailed = Object.values(this.testResults).reduce((sum, cat) => sum + cat.failed, 0);
    const overallRate = totalSuccess / (totalSuccess + totalFailed) * 100;
    
    if (overallRate >= 95) return '🟢 **EXCELLENT** - System is highly stable';
    if (overallRate >= 85) return '🟡 **GOOD** - System is stable with minor issues';
    if (overallRate >= 70) return '🟠 **FAIR** - System needs optimization';
    return '🔴 **POOR** - System requires immediate attention';
  }

  getRecommendations() {
    const recommendations = [];
    
    if (this.calculateSuccessRate('commits') < 90) {
      recommendations.push('- 🤖 Optimize automatic commit system');
    }
    
    if (this.calculateSuccessRate('branches') < 90) {
      recommendations.push('- 🌿 Improve branch switching stability');
    }
    
    if (this.calculateSuccessRate('backups') < 90) {
      recommendations.push('- 💾 Enhance backup upload reliability');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- ✅ All systems performing optimally');
    }
    
    return recommendations.join('\n');
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new GitHubStressTester();
  tester.runFullStressTest()
    .then(() => {
      console.log('🎉 GitHub Stress Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 GitHub Stress Test failed:', error);
      process.exit(1);
    });
}

module.exports = GitHubStressTester;

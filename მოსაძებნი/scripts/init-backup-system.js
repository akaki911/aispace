
#!/usr/bin/env node

/**
 * Backup System Initialization Script
 * Sets up comprehensive backup system for Bakhmaro AI project
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function initializeBackupSystem() {
  console.log('🔧 Initializing Backup System...');

  try {
    // 1. Create backup directories
    const backupDir = path.join(process.cwd(), '.backups');
    const subdirs = ['daily', 'database', 'config', 'logs', 'verification', 'recovery'];
    
    await fs.mkdir(backupDir, { recursive: true });
    for (const subdir of subdirs) {
      await fs.mkdir(path.join(backupDir, subdir), { recursive: true });
    }
    console.log('✅ Backup directories created');

    // 2. Generate encryption key if not exists
    const encryptionKeyPath = path.join(backupDir, 'encryption.key');
    try {
      await fs.access(encryptionKeyPath);
      console.log('✅ Encryption key already exists');
    } catch (error) {
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      await fs.writeFile(encryptionKeyPath, encryptionKey);
      console.log('🔑 Generated new encryption key');
      console.log('⚠️ Important: Add BACKUP_ENCRYPTION_KEY to your environment variables');
    }

    // 3. Create backup configuration
    const config = {
      version: '1.0',
      schedule: {
        dailyBackup: '03:00',
        configBackup: '*/6 * * * *', // Every 6 hours
        retention: 30 // days
      },
      repositories: [
        'username/bakhmaro-backup-primary',
        'username/bakhmaro-backup-secondary',
        'username/bakhmaro-backup-archive'
      ],
      encryption: {
        algorithm: 'aes-256-gcm',
        keyRotation: 90 // days
      },
      verification: {
        autoVerify: true,
        recoveryTesting: 'weekly'
      }
    };

    await fs.writeFile(
      path.join(backupDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );
    console.log('✅ Backup configuration created');

    // 4. Create .gitignore for backup directory
    const gitignoreContent = `# Backup System Files
.backups/
*.encrypted
*.key
encryption.key
**/backup-*.tar.gz
verification/
recovery/test-*

# GitHub Repository Clones
*-backup-*

# Sensitive backup data
database/
logs/
`;

    const gitignorePath = path.join(backupDir, '.gitignore');
    await fs.writeFile(gitignorePath, gitignoreContent);
    console.log('✅ Backup .gitignore created');

    // 5. Create disaster recovery documentation
    const recoveryDoc = `# Disaster Recovery Plan

## Quick Recovery Steps

### 1. Environment Setup
\`\`\`bash
# Set required environment variables
export BACKUP_ENCRYPTION_KEY="your-encryption-key"
export GITHUB_TOKEN="your-github-token"
\`\`\`

### 2. Download Latest Backup
\`\`\`bash
# Clone backup repositories
git clone https://github.com/username/bakhmaro-backup-primary.git
git clone https://github.com/username/bakhmaro-backup-secondary.git
\`\`\`

### 3. Database Recovery
\`\`\`bash
# Decrypt and restore database
node scripts/restore-database.js backup-YYYY-MM-DD-timestamp
\`\`\`

### 4. Configuration Recovery
\`\`\`bash
# Restore configuration files
node scripts/restore-config.js backup-YYYY-MM-DD-timestamp
\`\`\`

### 5. File Recovery
\`\`\`bash
# Extract project files
tar -xzf backup-YYYY-MM-DD-timestamp.tar.gz
\`\`\`

### 6. Verification
\`\`\`bash
# Run system health check
npm run system-health-check
\`\`\`

## Emergency Contacts
- Primary Admin: your-email@domain.com
- Backup Admin: backup-admin@domain.com
- GitHub Support: If repository access issues

## Recovery Testing Schedule
- Weekly: Automated recovery tests
- Monthly: Full disaster recovery simulation
- Quarterly: Cross-region recovery testing
`;

    await fs.writeFile(
      path.join(backupDir, 'DISASTER_RECOVERY.md'),
      recoveryDoc
    );
    console.log('✅ Disaster recovery documentation created');

    // 6. Initialize backup system service
    try {
      const backupService = require('../ai-service/services/backup_system_service');
      await backupService.initialize();
      console.log('✅ Backup service initialized');
    } catch (error) {
      console.warn('⚠️ Could not initialize backup service:', error.message);
    }

    console.log('\n🎉 Backup System Initialization Complete!');
    console.log('\nNext Steps:');
    console.log('1. Set BACKUP_ENCRYPTION_KEY in your environment');
    console.log('2. Set GITHUB_TOKEN with repository access');
    console.log('3. Create GitHub repositories for backup storage');
    console.log('4. Update repository names in backup configuration');
    console.log('5. Test backup system with: npm run test-backup');

  } catch (error) {
    console.error('❌ Backup initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
if (require.main === module) {
  initializeBackupSystem();
}

module.exports = { initializeBackupSystem };


const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection with proper SSL handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? true : false
});

class GitHubIntegrationService {
  constructor() {
    this.projectRoot = process.cwd();
    this.isInitialized = false;
    this.remoteUrl = null;
    this.branch = 'main';
    this.syncInterval = null;
    this.autoCommitInterval = null;
    this.lastCommitHash = null;
    this.branchStrategy = {
      main: 'production',
      development: 'staging',
      feature: 'development'
    };
    this.activeBranches = new Map();
    this.conflictResolutionEnabled = true;
    
    // GitHub API configuration
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_REPO_OWNER || 'bakhmaro';
    this.repoName = process.env.GITHUB_REPO_NAME || 'gurulo-ai';
    
    // Initialize settings from database
    this.initializeSettings().catch(console.error);
    
    // Rate limiting
    this.lastGitHubRequest = 0;
    this.githubRateLimit = 1000; // 1 second between requests
  }

  // Database Functions for Persistent Storage
  async initializeSettings() {
    try {
      const result = await pool.query('SELECT * FROM github_settings WHERE user_id = $1', ['system']);
      if (result.rows.length === 0) {
        // Create default settings
        await pool.query(
          'INSERT INTO github_settings (user_id, auto_sync_enabled, auto_commit_enabled) VALUES ($1, $2, $3)',
          ['system', false, false]
        );
        console.log('🔧 GitHub settings ინიციალიზებული database-ში');
      } else {
        console.log('📊 GitHub settings წაკითხული database-დან');
      }
    } catch (error) {
      console.error('❌ GitHub settings ინიციალიზაციის შეცდომა:', error);
    }
  }

  async getSettings() {
    try {
      const result = await pool.query('SELECT * FROM github_settings WHERE user_id = $1', ['system']);
      return result.rows[0] || { auto_sync_enabled: false, auto_commit_enabled: false };
    } catch (error) {
      console.error('❌ Settings წაკითხვის შეცდომა:', error);
      return { auto_sync_enabled: false, auto_commit_enabled: false };
    }
  }

  async saveSettings(settings) {
    try {
      // CRITICAL FIX: Use UPSERT to handle race condition between initializeSettings() and saveSettings()
      await pool.query(
        `INSERT INTO github_settings (user_id, auto_sync_enabled, auto_commit_enabled, sync_interval_minutes, updated_at)
         VALUES ($4, $1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
         auto_sync_enabled = $1, 
         auto_commit_enabled = $2, 
         sync_interval_minutes = $3,
         updated_at = CURRENT_TIMESTAMP`,
        [settings.auto_sync_enabled, settings.auto_commit_enabled, settings.sync_interval_minutes || 10, 'system']
      );
      console.log('💾 GitHub settings შენახულია database-ში (UPSERT)');
    } catch (error) {
      console.error('❌ Settings შენახვის შეცდომა:', error);
    }
  }

  async isAutoSyncEnabled() {
    const settings = await this.getSettings();
    return settings.auto_sync_enabled;
  }

  async isAutoCommitEnabled() {
    const settings = await this.getSettings();
    return settings.auto_commit_enabled;
  }

  // Bootstrap existing timers from database on startup  
  async bootstrapFromDatabase() {
    try {
      const settings = await this.getSettings();
      
      console.log('🔧 Bootstrapping GitHub settings from database...');
      
      // Restore auto-sync timer if enabled
      if (settings.auto_sync_enabled && this.remoteUrl) {
        const interval = settings.sync_interval_minutes || 10;
        console.log(`🔄 Restoring auto-sync timer: ${interval} minutes`);
        
        // Start the interval directly (don't call enableAutoSync to avoid DB update)
        const intervalMs = interval * 60 * 1000;
        this.syncInterval = setInterval(async () => {
          console.log('⏰ Auto-sync მოწმდება...');
          const status = await this.getStatus();
          if (status.hasChanges && this.remoteUrl) {
            await this.performAutoSync();
          }
        }, intervalMs);
      }
      
      // Restore auto-commit timer if enabled  
      if (settings.auto_commit_enabled && this.remoteUrl) {
        const interval = settings.sync_interval_minutes || 5; // Use same interval for both
        console.log(`📝 Restoring auto-commit timer: ${interval} minutes`);
        
        // Start the interval directly (don't call enableAutoCommit to avoid DB update)
        const intervalMs = interval * 60 * 1000;
        this.autoCommitInterval = setInterval(async () => {
          console.log('🔄 Auto-commit მოწმდება...');
          const status = await this.getStatus();
          if (status.hasChanges && this.remoteUrl) {
            const result = await this.fullSync();
            if (result.success && !result.skipped) {
              console.log('✅ Auto-commit წარმატებული:', result.commitMessage);
            }
          }
        }, intervalMs);
      }
      
      console.log('✅ GitHub settings bootstrap წარმატებული');
      return { success: true, message: 'Settings bootstrap complete' };
    } catch (error) {
      console.error('❌ Bootstrap შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // GitHub API helper with rate limiting
  async makeGitHubRequest(endpoint, options = {}) {
    if (!this.githubToken) {
      console.warn('⚠️ GitHub token not configured');
      return null;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastGitHubRequest;
    if (timeSinceLastRequest < this.githubRateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.githubRateLimit - timeSinceLastRequest));
    }
    this.lastGitHubRequest = Date.now();

    const url = `https://api.github.com${endpoint}`;
    const headers = {
      'Authorization': `token ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gurulo-AI-Assistant',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers, timeout: 30000 });
      
      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        console.warn(`GitHub rate limit hit, reset at ${resetTime}`);
        return null;
      }

      if (!response.ok) {
        console.error(`GitHub API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('GitHub API request failed:', error.message);
      return null;
    }
  }

  // Get repository status from GitHub API
  async getGitHubRepoStatus() {
    try {
      const repo = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}`);
      if (!repo) return null;

      const branches = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/branches`);
      const commits = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/commits?per_page=10`);

      return {
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        branches: branches || [],
        recentCommits: commits || [],
        private: repo.private,
        url: repo.html_url
      };
    } catch (error) {
      console.error('Failed to get GitHub repo status:', error);
      return null;
    }
  }

  // Initialize Git repository if not exists
  async initializeGit() {
    try {
      // Check if .git exists
      const gitDir = path.join(this.projectRoot, '.git');
      if (!fs.existsSync(gitDir)) {
        await this.executeCommand('git init');
        console.log('🎯 Git repository ინიციალიზებული');
      }

      // Set user config if not set
      await this.executeCommand('git config user.name "Gurulo AI Assistant"');
      await this.executeCommand('git config user.email "gurulo@bakhmaro.ai"');
      
      // Ensure .gitignore exists and is properly configured
      await this.ensureGitignore();
      
      // CRITICAL FIX: Set initialized BEFORE calling addRemote to prevent infinite recursion
      this.isInitialized = true;
      
      // CRITICAL FIX: Detect existing remote URLs on startup
      await this.detectExistingRemote();
      
      // Auto-setup GitHub remote if configured and no remote exists
      if (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME && !this.remoteUrl) {
        const repoUrl = `https://github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}.git`;
        await this.addRemote(repoUrl);
      }
      
      // Bootstrap existing timers from database
      await this.bootstrapFromDatabase();
      
      // Enable auto-sync if not already enabled (check from database)
      if (!(await this.isAutoSyncEnabled()) && this.remoteUrl) {
        await this.enableAutoSync(10); // Every 10 minutes
      }
      
      return { success: true, message: 'Git ინიციალიზაცია და auto-sync გააქტიურებული' };
    } catch (error) {
      console.error('❌ Git ინიციალიზაციის შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Ensure .gitignore is properly configured
  async ensureGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    const essentialIgnores = [
      '# Dependencies',
      'node_modules/',
      'package-lock.json',
      '',
      '# Environment Variables',
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
      '',
      '# Build outputs',
      'dist/',
      'build/',
      'out/',
      '.next/',
      '',
      '# IDE and Editor files',
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '.DS_Store',
      '',
      '# Logs',
      'logs/',
      '*.log',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      '',
      '# Runtime data',
      'pids/',
      '*.pid',
      '*.seed',
      '*.pid.lock',
      '',
      '# Temporary files',
      '.tmp/',
      '.temp/',
      '',
      '# AI Service specific',
      'memory_data/',
      'memory_facts/',
      'attached_assets/*.txt',
      '',
      '# Cache directories',
      '.cache/',
      '.npm/',
      '.yarn/',
      '',
      '# Coverage and test outputs',
      'coverage/',
      '.nyc_output/',
      '',
      '# Optional npm cache directory',
      '.npm',
      '',
      '# Optional eslint cache',
      '.eslintcache'
    ];

    try {
      let existingContent = '';
      if (fs.existsSync(gitignorePath)) {
        existingContent = fs.readFileSync(gitignorePath, 'utf8');
      }

      // Check which ignores are missing
      const missingIgnores = essentialIgnores.filter(ignore => 
        !existingContent.includes(ignore) && ignore.trim() !== ''
      );

      if (missingIgnores.length > 0) {
        const newContent = existingContent + '\n' + missingIgnores.join('\n') + '\n';
        fs.writeFileSync(gitignorePath, newContent);
        console.log('📝 .gitignore განახლებული');
      }
    } catch (error) {
      console.warn('⚠️ .gitignore შექმნის შეცდომა:', error.message);
    }
  }

  // CRITICAL FIX: Detect existing git remote URL on startup
  async detectExistingRemote() {
    try {
      const remoteUrl = await this.executeCommand('git remote get-url origin');
      if (remoteUrl && remoteUrl.trim()) {
        this.remoteUrl = remoteUrl.trim();
        console.log('🔗 Existing GitHub remote detected:', this.remoteUrl);
        return { success: true, remoteUrl: this.remoteUrl };
      }
    } catch (error) {
      // No remote exists or git not initialized, which is fine
      console.log('ℹ️ No existing git remote found');
    }
    return { success: false, remoteUrl: null };
  }

  // Add GitHub remote
  async addRemote(repoUrl) {
    try {
      if (!this.isInitialized) {
        await this.initializeGit();
      }

      // Remove existing origin if exists
      try {
        await this.executeCommand('git remote remove origin');
      } catch (e) {
        // Remote doesn't exist, continue
      }

      // Add new remote
      await this.executeCommand(`git remote add origin ${repoUrl}`);
      this.remoteUrl = repoUrl;
      
      console.log('🔗 GitHub remote დამატებული:', repoUrl);
      return { success: true, message: 'GitHub remote წარმატებით დაემატა' };
    } catch (error) {
      console.error('❌ Remote დამატების შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate intelligent commit message
  async generateIntelligentCommitMessage() {
    try {
      // Get changed files
      const statusOutput = await this.executeCommand('git status --porcelain');
      const changedFiles = statusOutput.split('\n').filter(line => line.trim());
      
      if (changedFiles.length === 0) {
        return '🤖 No changes detected';
      }

      const fileCategories = {
        frontend: [],
        backend: [],
        ai: [],
        config: [],
        docs: [],
        tests: [],
        other: []
      };

      // Categorize files
      changedFiles.forEach(line => {
        const filePath = line.substring(3); // Remove git status prefix
        
        if (filePath.includes('src/') || filePath.includes('.tsx') || filePath.includes('.jsx')) {
          fileCategories.frontend.push(filePath);
        } else if (filePath.includes('backend/') || filePath.includes('index.js')) {
          fileCategories.backend.push(filePath);
        } else if (filePath.includes('ai-service/')) {
          fileCategories.ai.push(filePath);
        } else if (filePath.includes('package.json') || filePath.includes('.config') || filePath.includes('.replit')) {
          fileCategories.config.push(filePath);
        } else if (filePath.includes('.md') || filePath.includes('docs/')) {
          fileCategories.docs.push(filePath);
        } else if (filePath.includes('test') || filePath.includes('.spec.') || filePath.includes('.test.')) {
          fileCategories.tests.push(filePath);
        } else {
          fileCategories.other.push(filePath);
        }
      });

      // Generate message parts
      const messageParts = [];
      const emojis = {
        frontend: '⚛️',
        backend: '🔧',
        ai: '🤖',
        config: '⚙️',
        docs: '📝',
        tests: '🧪',
        other: '📁'
      };

      Object.entries(fileCategories).forEach(([category, files]) => {
        if (files.length > 0) {
          const emoji = emojis[category];
          const count = files.length;
          const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
          messageParts.push(`${emoji} ${categoryName} (${count} files)`);
        }
      });

      // Create final message
      const timestamp = new Date().toLocaleString('ka-GE');
      const mainMessage = messageParts.length > 0 ? messageParts.join(' | ') : 'General updates';
      
      return `🚀 ${mainMessage} - ${timestamp}`;
    } catch (error) {
      console.error('❌ Commit message generation error:', error);
      return `🤖 Auto-commit: ${new Date().toISOString()}`;
    }
  }

  // Check repository status
  async getStatus() {
    try {
      const status = await this.executeCommand('git status --porcelain');
      const branch = await this.executeCommand('git branch --show-current');
      
      const changes = status.split('\n').filter(line => line.trim()).length;
      
      // Get settings from database instead of memory
      const settings = await this.getSettings();
      
      return {
        success: true,
        branch: branch.trim() || this.branch,
        hasChanges: changes > 0,
        changesCount: changes,
        remoteUrl: this.remoteUrl,
        autoSync: settings.auto_sync_enabled,
        autoCommit: settings.auto_commit_enabled
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Stage all changes (excluding ignored files)
  async stageChanges() {
    try {
      await this.executeCommand('git add .');
      console.log('📝 ყველა ცვლილება staged');
      return { success: true, message: 'ცვლილებები staged' };
    } catch (error) {
      console.error('❌ Staging შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Commit changes with intelligent message
  async commitChanges(message = null) {
    try {
      const commitMessage = message || await this.generateIntelligentCommitMessage();
      
      await this.executeCommand(`git commit -m "${commitMessage}"`);
      console.log('✅ კომიტი შექმნილი:', commitMessage);
      
      // Store last commit hash
      try {
        this.lastCommitHash = await this.executeCommand('git rev-parse HEAD');
      } catch (e) {
        // Ignore hash retrieval errors
      }
      
      return { success: true, message: 'კომიტი წარმატებული', commitMessage };
    } catch (error) {
      console.error('❌ კომიტის შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Push to GitHub
  async pushToGitHub() {
    try {
      if (!this.remoteUrl) {
        throw new Error('GitHub remote არ არის კონფიგურირებული');
      }

      const currentBranch = await this.executeCommand('git branch --show-current');
      const branch = currentBranch.trim() || this.branch;
      
      await this.executeCommand(`git push origin ${branch}`);
      console.log('🚀 ცვლილებები GitHub-ზე გაიგზავნა');
      return { success: true, message: 'Push წარმატებული' };
    } catch (error) {
      console.error('❌ Push შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Pull from GitHub
  async pullFromGitHub() {
    try {
      if (!this.remoteUrl) {
        throw new Error('GitHub remote არ არის კონფიგურირებული');
      }

      await this.executeCommand('git pull origin main');
      console.log('⬇️ ცვლილებები GitHub-დან ჩამოტვირთული');
      return { success: true, message: 'Pull წარმატებული' };
    } catch (error) {
      console.error('❌ Pull შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Full sync (stage, commit, push)
  async fullSync(commitMessage = null) {
    try {
      console.log('🔄 GitHub სინქრონიზაცია დაწყებული...');
      
      // Check if there are changes
      const status = await this.getStatus();
      if (!status.hasChanges) {
        return { success: true, message: 'ცვლილებები არ არის', skipped: true };
      }

      // Stage changes
      const stageResult = await this.stageChanges();
      if (!stageResult.success) return stageResult;

      // Commit changes
      const commitResult = await this.commitChanges(commitMessage);
      if (!commitResult.success) return commitResult;

      // Push to GitHub
      const pushResult = await this.pushToGitHub();
      if (!pushResult.success) return pushResult;

      console.log('✅ GitHub სინქრონიზაცია დასრულებული');
      return { 
        success: true, 
        message: 'სრული სინქრონიზაცია წარმატებული',
        commitMessage: commitResult.commitMessage
      };
    } catch (error) {
      console.error('❌ სინქრონიზაციის შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Enable auto-commit system
  async enableAutoCommit(intervalMinutes = 10) {
    try {
      if (this.autoCommitInterval) {
        clearInterval(this.autoCommitInterval);
      }

      // Save to database instead of memory
      await this.saveSettings({ auto_commit_enabled: true, auto_sync_enabled: await this.isAutoSyncEnabled(), sync_interval_minutes: intervalMinutes });
      const intervalMs = intervalMinutes * 60 * 1000;
      
      this.autoCommitInterval = setInterval(async () => {
        console.log('🔄 Auto-commit მოწმდება...');
        
        try {
          const status = await this.getStatus();
          if (status.hasChanges && this.remoteUrl) {
            const result = await this.fullSync();
            if (result.success && !result.skipped) {
              console.log('✅ Auto-commit წარმატებული:', result.commitMessage);
            }
          }
        } catch (error) {
          console.error('⚠️ Auto-commit შეცდომა:', error.message);
        }
      }, intervalMs);

      console.log(`🔄 Auto-commit ჩაირთო (${intervalMinutes} წუთი)`);
      return { success: true, message: `Auto-commit ჩაირთო ${intervalMinutes} წუთით` };
    } catch (error) {
      console.error('❌ Auto-commit ჩართვის შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  async disableAutoCommit() {
    if (this.autoCommitInterval) {
      clearInterval(this.autoCommitInterval);
      this.autoCommitInterval = null;
    }
    // Save to database instead of memory
    await this.saveSettings({ auto_commit_enabled: false, auto_sync_enabled: await this.isAutoSyncEnabled() });
    console.log('⏹️ Auto-commit გამორთული');
    return { success: true, message: 'Auto-commit გამორთული' };
  }

  // Enable/disable auto-sync
  async enableAutoSync(intervalMinutes = 5) {
    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      // Save to database instead of memory
      await this.saveSettings({ auto_sync_enabled: true, auto_commit_enabled: await this.isAutoCommitEnabled(), sync_interval_minutes: intervalMinutes });
      const intervalMs = intervalMinutes * 60 * 1000;
      
      this.syncInterval = setInterval(async () => {
        console.log('⏰ Auto-sync მოწმდება...');
        await this.fullSync(`🤖 Auto-sync: ${new Date().toLocaleString('ka-GE')}`);
      }, intervalMs);

      console.log(`🔄 Auto-sync ჩაირთო (${intervalMinutes} წუთი)`);
      return { success: true, message: `Auto-sync ჩაირთო ${intervalMinutes} წუთით` };
    } catch (error) {
      console.error('❌ Auto-sync ჩართვის შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  async disableAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    // Save to database instead of memory
    await this.saveSettings({ auto_sync_enabled: false, auto_commit_enabled: await this.isAutoCommitEnabled() });
    console.log('⏹️ Auto-sync გამორთული');
    return { success: true, message: 'Auto-sync გამორთული' };
  }

  // Manual commit with custom message
  async manualCommit(customMessage) {
    try {
      const status = await this.getStatus();
      if (!status.hasChanges) {
        return { success: false, error: 'ცვლილებები არ არის' };
      }

      // Stage and commit
      await this.stageChanges();
      const result = await this.commitChanges(customMessage);
      
      if (result.success && this.remoteUrl) {
        // Auto-push if remote is configured
        await this.pushToGitHub();
      }

      return result;
    } catch (error) {
      console.error('❌ Manual commit შეცდომა:', error);
      return { success: false, error: error.message };
    }
  }

  // Execute git command
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.toString().trim());
        }
      });
    });
  }

  // Get recent commits
  async getRecentCommits(limit = 10) {
    try {
      const commits = await this.executeCommand(
        `git log --oneline -${limit} --pretty=format:"%h|%an|%ad|%s" --date=relative`
      );
      
      const commitList = commits.split('\n').map(line => {
        const [hash, author, date, message] = line.split('|');
        return { hash, author, date, message };
      });

      return { success: true, commits: commitList };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get commit statistics
  async getCommitStats() {
    try {
      const totalCommits = await this.executeCommand('git rev-list --count HEAD');
      const todayCommits = await this.executeCommand(
        'git rev-list --count --since="midnight" HEAD'
      );
      const lastCommitDate = await this.executeCommand(
        'git log -1 --format="%ad" --date=relative'
      );

      // Get settings from database instead of memory
      const settings = await this.getSettings();
      
      return {
        success: true,
        stats: {
          total: parseInt(totalCommits) || 0,
          today: parseInt(todayCommits) || 0,
          lastCommit: lastCommitDate || 'არასდროს',
          autoCommitEnabled: settings.auto_commit_enabled,
          autoSyncEnabled: settings.auto_sync_enabled
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // === BRANCH MANAGEMENT SYSTEM ===

  // Create branch structure
  async setupBranchStructure() {
    try {
      console.log('🌿 Setting up branch structure...');
      
      // Ensure we're on main branch
      await this.executeCommand('git checkout main || git checkout -b main');
      
      // Create development branch if it doesn't exist
      try {
        await this.executeCommand('git checkout development');
      } catch (error) {
        await this.executeCommand('git checkout -b development');
        console.log('🌿 Created development branch');
      }
      
      // Setup tracking for development
      try {
        await this.executeCommand('git push -u origin development');
      } catch (error) {
        console.log('⚠️ Development branch not pushed to remote yet');
      }
      
      // Return to main
      await this.executeCommand('git checkout main');
      
      return { success: true, message: 'Branch structure setup complete' };
    } catch (error) {
      console.error('❌ Branch structure setup error:', error);
      return { success: false, error: error.message };
    }
  }

  // Create feature branch
  async createFeatureBranch(featureName) {
    try {
      if (!featureName) {
        throw new Error('Feature name is required');
      }
      
      const branchName = `feature/${featureName.replace(/\s+/g, '-').toLowerCase()}`;
      
      // Switch to development first
      await this.executeCommand('git checkout development');
      await this.executeCommand('git pull origin development');
      
      // Create feature branch from development
      await this.executeCommand(`git checkout -b ${branchName}`);
      
      console.log(`🌿 Created feature branch: ${branchName}`);
      
      // Track in memory
      this.activeBranches.set(branchName, {
        type: 'feature',
        parent: 'development',
        created: new Date().toISOString()
      });
      
      return { 
        success: true, 
        message: `Feature branch ${branchName} created`,
        branchName 
      };
    } catch (error) {
      console.error('❌ Feature branch creation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Switch branch with safety checks
  async switchBranch(targetBranch) {
    try {
      const currentBranch = await this.executeCommand('git branch --show-current');
      
      if (currentBranch.trim() === targetBranch) {
        return { success: true, message: `Already on ${targetBranch}` };
      }
      
      // Check for uncommitted changes
      const statusOutput = await this.executeCommand('git status --porcelain');
      const hasChanges = statusOutput.trim().length > 0;
      
      if (hasChanges) {
        // Auto-stash changes
        await this.executeCommand('git stash push -m "Auto-stash before branch switch"');
        console.log('📦 Stashed uncommitted changes');
      }
      
      // Switch branch
      await this.executeCommand(`git checkout ${targetBranch}`);
      
      // Try to restore stash if it was for this branch
      if (hasChanges) {
        try {
          await this.executeCommand('git stash pop');
          console.log('📦 Restored stashed changes');
        } catch (error) {
          console.log('⚠️ Could not restore stash automatically');
        }
      }
      
      this.branch = targetBranch;
      console.log(`🌿 Switched to branch: ${targetBranch}`);
      
      return { 
        success: true, 
        message: `Switched to ${targetBranch}`,
        previousBranch: currentBranch.trim()
      };
    } catch (error) {
      console.error('❌ Branch switch error:', error);
      return { success: false, error: error.message };
    }
  }

  // List all branches with status
  async listBranches() {
    try {
      const localBranches = await this.executeCommand('git branch');
      const remoteBranches = await this.executeCommand('git branch -r');
      const currentBranch = await this.executeCommand('git branch --show-current');
      
      const branches = {
        current: currentBranch.trim(),
        local: localBranches.split('\n').map(branch => ({
          name: branch.replace('*', '').trim(),
          isCurrent: branch.includes('*'),
          type: this.getBranchType(branch.replace('*', '').trim())
        })).filter(b => b.name),
        remote: remoteBranches.split('\n').map(branch => ({
          name: branch.trim().replace('origin/', ''),
          remote: 'origin'
        })).filter(b => b.name && !b.name.includes('HEAD'))
      };
      
      return { success: true, branches };
    } catch (error) {
      console.error('❌ Branch listing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get branch type based on name
  getBranchType(branchName) {
    if (branchName === 'main') return 'production';
    if (branchName === 'development') return 'staging';
    if (branchName.startsWith('feature/')) return 'feature';
    if (branchName.startsWith('hotfix/')) return 'hotfix';
    if (branchName.startsWith('release/')) return 'release';
    return 'other';
  }

  // Merge branch with conflict detection
  async mergeBranch(sourceBranch, targetBranch = null) {
    try {
      const target = targetBranch || this.getDefaultMergeTarget(sourceBranch);
      
      console.log(`🔀 Merging ${sourceBranch} into ${target}`);
      
      // Switch to target branch
      await this.switchBranch(target);
      
      // Pull latest changes
      await this.executeCommand(`git pull origin ${target}`);
      
      // Attempt merge
      try {
        await this.executeCommand(`git merge ${sourceBranch} --no-ff`);
        console.log(`✅ Successfully merged ${sourceBranch} into ${target}`);
        
        return { 
          success: true, 
          message: `Successfully merged ${sourceBranch} into ${target}`,
          hasConflicts: false
        };
      } catch (mergeError) {
        // Check if it's a conflict
        const status = await this.executeCommand('git status --porcelain');
        const conflictedFiles = status.split('\n')
          .filter(line => line.startsWith('UU') || line.startsWith('AA'))
          .map(line => line.substring(3));
        
        if (conflictedFiles.length > 0) {
          console.log('⚠️ Merge conflicts detected');
          return {
            success: false,
            hasConflicts: true,
            conflictedFiles,
            error: 'Merge conflicts detected - manual resolution required'
          };
        } else {
          throw mergeError;
        }
      }
    } catch (error) {
      console.error('❌ Merge error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get default merge target based on branch type
  getDefaultMergeTarget(sourceBranch) {
    if (sourceBranch.startsWith('feature/')) return 'development';
    if (sourceBranch.startsWith('hotfix/')) return 'main';
    if (sourceBranch === 'development') return 'main';
    return 'main';
  }

  // Auto-resolve simple conflicts
  async autoResolveConflicts(strategy = 'smart') {
    try {
      const status = await this.executeCommand('git status --porcelain');
      const conflictedFiles = status.split('\n')
        .filter(line => line.startsWith('UU') || line.startsWith('AA'))
        .map(line => line.substring(3));
      
      if (conflictedFiles.length === 0) {
        return { success: true, message: 'No conflicts to resolve' };
      }
      
      const resolvedFiles = [];
      const failedFiles = [];
      
      for (const file of conflictedFiles) {
        try {
          const resolved = await this.resolveFileConflict(file, strategy);
          if (resolved) {
            resolvedFiles.push(file);
            await this.executeCommand(`git add ${file}`);
          } else {
            failedFiles.push(file);
          }
        } catch (error) {
          console.error(`Failed to resolve ${file}:`, error);
          failedFiles.push(file);
        }
      }
      
      if (resolvedFiles.length > 0) {
        console.log(`✅ Auto-resolved conflicts in: ${resolvedFiles.join(', ')}`);
      }
      
      if (failedFiles.length > 0) {
        console.log(`⚠️ Manual resolution needed for: ${failedFiles.join(', ')}`);
      }
      
      return {
        success: true,
        resolved: resolvedFiles,
        failed: failedFiles,
        message: `Resolved ${resolvedFiles.length}/${conflictedFiles.length} conflicts`
      };
    } catch (error) {
      console.error('❌ Auto-resolve error:', error);
      return { success: false, error: error.message };
    }
  }

  // Resolve individual file conflict
  async resolveFileConflict(filePath, strategy) {
    try {
      const fs = require('fs');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Simple auto-resolution strategies
      let resolvedContent = fileContent;
      
      switch (strategy) {
        case 'ours':
          // Take our version
          resolvedContent = fileContent.replace(/<<<<<<< HEAD\n([\s\S]*?)\n=======\n[\s\S]*?\n>>>>>>> .*\n/g, '$1\n');
          break;
          
        case 'theirs':
          // Take their version
          resolvedContent = fileContent.replace(/<<<<<<< HEAD\n[\s\S]*?\n=======\n([\s\S]*?)\n>>>>>>> .*\n/g, '$1\n');
          break;
          
        case 'smart':
          // Smart resolution for simple cases
          if (this.isSimpleConflict(fileContent)) {
            resolvedContent = this.smartResolveConflict(fileContent);
          } else {
            return false; // Needs manual resolution
          }
          break;
          
        default:
          return false;
      }
      
      // Only write if we actually resolved something
      if (resolvedContent !== fileContent && !resolvedContent.includes('<<<<<<<')) {
        fs.writeFileSync(filePath, resolvedContent);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error resolving ${filePath}:`, error);
      return false;
    }
  }

  // Check if conflict is simple enough for auto-resolution
  isSimpleConflict(content) {
    const conflicts = content.match(/<<<<<<< HEAD\n[\s\S]*?\n>>>>>>> .*\n/g);
    if (!conflicts || conflicts.length > 3) return false; // Too many conflicts
    
    // Check for simple additive conflicts (no overlapping changes)
    return conflicts.every(conflict => {
      const parts = conflict.split('\n=======\n');
      if (parts.length !== 2) return false;
      
      const ours = parts[0].replace('<<<<<<< HEAD\n', '');
      const theirs = parts[1].replace(/\n>>>>>>> .*/, '');
      
      // Simple heuristics for safe auto-merge
      return (
        ours.trim() === '' ||  // Empty on our side
        theirs.trim() === '' || // Empty on their side
        (ours.includes('import') && theirs.includes('import')) || // Both are imports
        (ours.includes('//') && theirs.includes('//')) // Both are comments
      );
    });
  }

  // Smart conflict resolution
  smartResolveConflict(content) {
    return content.replace(/<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> .*\n/g, (match, ours, theirs) => {
      // If one side is empty, take the other
      if (ours.trim() === '') return theirs;
      if (theirs.trim() === '') return ours;
      
      // If both are imports, combine them
      if (ours.includes('import') && theirs.includes('import')) {
        const oursLines = ours.split('\n').filter(line => line.trim());
        const theirsLines = theirs.split('\n').filter(line => line.trim());
        const combined = [...new Set([...oursLines, ...theirsLines])];
        return combined.join('\n') + '\n';
      }
      
      // If both are comments, combine them
      if (ours.includes('//') && theirs.includes('//')) {
        return ours + '\n' + theirs;
      }
      
      // Default: take both with separator
      return ours + '\n' + theirs;
    });
  }

  // Complete merge after conflict resolution
  async completeMerge(commitMessage = null) {
    try {
      // Check if all conflicts are resolved
      const status = await this.executeCommand('git status --porcelain');
      const hasUnresolvedConflicts = status.split('\n').some(line => 
        line.startsWith('UU') || line.startsWith('AA')
      );
      
      if (hasUnresolvedConflicts) {
        return { 
          success: false, 
          error: 'Unresolved conflicts remain - please resolve manually' 
        };
      }
      
      // Commit the merge
      const message = commitMessage || `🔀 Merge completed: ${new Date().toLocaleString('ka-GE')}`;
      await this.executeCommand(`git commit -m "${message}"`);
      
      console.log('✅ Merge completed successfully');
      return { success: true, message: 'Merge completed successfully' };
    } catch (error) {
      console.error('❌ Complete merge error:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete feature branch after successful merge
  async deleteFeatureBranch(branchName, force = false) {
    try {
      const currentBranch = await this.executeCommand('git branch --show-current');
      
      // Don't delete current branch
      if (currentBranch.trim() === branchName) {
        await this.switchBranch('development');
      }
      
      // Delete local branch
      const deleteFlag = force ? '-D' : '-d';
      await this.executeCommand(`git branch ${deleteFlag} ${branchName}`);
      
      // Delete remote branch if exists
      try {
        await this.executeCommand(`git push origin --delete ${branchName}`);
      } catch (error) {
        console.log('⚠️ Remote branch deletion failed or not needed');
      }
      
      // Remove from tracking
      this.activeBranches.delete(branchName);
      
      console.log(`🗑️ Deleted branch: ${branchName}`);
      return { success: true, message: `Branch ${branchName} deleted` };
    } catch (error) {
      console.error('❌ Branch deletion error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get branch status and health
  async getBranchStatus() {
    try {
      const currentBranch = await this.executeCommand('git branch --show-current');
      const branches = await this.listBranches();
      const status = await this.getStatus();
      
      // Get ahead/behind info for current branch
      let aheadBehind = null;
      try {
        const aheadBehindOutput = await this.executeCommand(
          `git rev-list --left-right --count origin/${currentBranch.trim()}...HEAD`
        );
        const [behind, ahead] = aheadBehindOutput.split('\t').map(n => parseInt(n) || 0);
        aheadBehind = { ahead, behind };
      } catch (error) {
        // Branch might not have upstream
      }
      
      return {
        success: true,
        branchStatus: {
          current: currentBranch.trim(),
          type: this.getBranchType(currentBranch.trim()),
          hasChanges: status.hasChanges,
          changesCount: status.changesCount,
          aheadBehind,
          branches: branches.branches,
          activeBranches: Array.from(this.activeBranches.entries()).map(([name, info]) => ({
            name,
            ...info
          }))
        }
      };
    } catch (error) {
      console.error('❌ Branch status error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const gitHubService = new GitHubIntegrationService();

module.exports = gitHubService;

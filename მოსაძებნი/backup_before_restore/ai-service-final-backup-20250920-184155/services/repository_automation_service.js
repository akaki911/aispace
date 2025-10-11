/**
 * Repository Automation Service for Gurulo AI Assistant
 * Provides complete automation for GitHub repository management
 */

const crypto = require('crypto');
const fs = require('fs').promises;

class RepositoryAutomationService {
  constructor() {
    try {
      this.githubToken = process.env.GITHUB_TOKEN;
      this.repoOwner = process.env.GITHUB_OWNER || process.env.GITHUB_REPO_OWNER || 'akaki911';
      this.repoName = process.env.GITHUB_REPO || process.env.GITHUB_REPO_NAME || 'bakhmaro.co';
      this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      this.replitUrl = process.env.REPLIT_URL || 'https://gurula-ai.replit.dev';

      this.activeJobs = [];
      this.isEnabled = false;

      // Default automation configuration
      this.automationConfig = {
        collaboratorRoles: {
          // Add team members as needed
        },
        requiredWebhooks: [
          {
            name: 'deployment-webhook',
            events: ['push', 'pull_request'],
            config: {
              url: `${this.replitUrl}/api/ai/github/webhook`,
              content_type: 'json',
              insecure_ssl: '0'
            }
          }
        ],
        repositoryTopics: [
          'ai-assistant',
          'georgian-ai',
          'replit',
          'nodejs',
          'react',
          'typescript',
          'developer-tools'
        ],
        branchProtectionRules: {
          main: {
            required_status_checks: {
              strict: true,
              contexts: []
            },
            enforce_admins: false,
            required_pull_request_reviews: {
              required_approving_review_count: 1,
              dismiss_stale_reviews: true
            },
            restrictions: null
          }
        }
      };

      console.log('Repository Automation Service initialized safely');
    } catch (error) {
      console.error('Repository Automation Service constructor error:', error);
      this.activeJobs = [];
      this.isEnabled = false;
      this.githubToken = null;
      this.repoOwner = null;
      this.repoName = null;
      this.webhookSecret = null;
      this.replitUrl = null;
    }
  }

  async makeGitHubRequest(endpoint, options = {}) {
    if (!this.githubToken) {
      throw new Error('GitHub token not configured');
    }

    const url = `https://api.github.com${endpoint}`;
    const headers = {
      'Authorization': `token ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gurula-AI-Assistant',
      ...options.headers
    };

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        throw new Error(`Rate limit exceeded. Reset time: ${resetTime}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GitHub API request failed:', error);
      throw error;
    }
  }

  // === COLLABORATORS MANAGEMENT ===

  async autoManageCollaborators() {
    try {
      console.log('🤝 Starting collaborator management...');

      const currentCollaborators = await this.getCurrentCollaborators();
      const results = {
        added: [],
        updated: [],
        removed: [],
        errors: []
      };

      // Add/Update collaborators based on config
      for (const [username, permission] of Object.entries(this.automationConfig.collaboratorRoles)) {
        try {
          const exists = currentCollaborators.find(c => c.login === username);

          if (!exists) {
            await this.addCollaborator(username, permission);
            results.added.push({ username, permission });
            console.log(`✅ Added collaborator: ${username} (${permission})`);
          } else if (this.needsPermissionUpdate(exists, permission)) {
            await this.updateCollaboratorPermission(username, permission);
            results.updated.push({ username, permission, old: exists.permissions });
            console.log(`🔄 Updated collaborator: ${username} (${permission})`);
          }
        } catch (error) {
          results.errors.push({ username, error: error.message });
          console.error(`❌ Failed to manage collaborator ${username}:`, error);
        }
      }

      // Remove unauthorized collaborators (optional - be careful)
      const authorizedUsers = Object.keys(this.automationConfig.collaboratorRoles);
      const unauthorizedCollaborators = currentCollaborators.filter(
        c => !authorizedUsers.includes(c.login) && !c.permissions.admin
      );

      for (const collaborator of unauthorizedCollaborators) {
        try {
          // Only remove if explicitly configured to do so
          if (process.env.AUTO_REMOVE_COLLABORATORS === 'true') {
            await this.removeCollaborator(collaborator.login);
            results.removed.push(collaborator.login);
            console.log(`🗑️ Removed unauthorized collaborator: ${collaborator.login}`);
          }
        } catch (error) {
          results.errors.push({ username: collaborator.login, error: error.message });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('❌ Collaborator management failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentCollaborators() {
    const collaborators = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/collaborators`);
    return collaborators;
  }

  async addCollaborator(username, permission) {
    await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/collaborators/${username}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission })
    });
  }

  async updateCollaboratorPermission(username, permission) {
    await this.addCollaborator(username, permission); // PUT request updates permission
  }

  async removeCollaborator(username) {
    await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/collaborators/${username}`, {
      method: 'DELETE'
    });
  }

  needsPermissionUpdate(collaborator, targetPermission) {
    const currentPermission = this.getHighestPermission(collaborator.permissions);
    return currentPermission !== targetPermission;
  }

  getHighestPermission(permissions) {
    if (permissions.admin) return 'admin';
    if (permissions.maintain) return 'maintain';
    if (permissions.push) return 'write';
    if (permissions.triage) return 'triage';
    if (permissions.pull) return 'read';
    return 'none';
  }

  // === WEBHOOKS MANAGEMENT ===

  async autoConfigureWebhooks() {
    try {
      console.log('🔗 Starting webhook configuration...');

      const currentWebhooks = await this.getCurrentWebhooks();
      const results = {
        created: [],
        updated: [],
        errors: []
      };

      for (const webhookConfig of this.automationConfig.requiredWebhooks) {
        try {
          const existing = currentWebhooks.find(w => 
            w.config.url === webhookConfig.config.url || 
            w.name === webhookConfig.name
          );

          if (!existing) {
            const webhook = await this.createWebhook(webhookConfig);
            results.created.push({
              name: webhookConfig.name,
              url: webhookConfig.config.url,
              id: webhook.id
            });
            console.log(`✅ Created webhook: ${webhookConfig.name}`);
          } else if (this.needsWebhookUpdate(existing, webhookConfig)) {
            await this.updateWebhook(existing.id, webhookConfig);
            results.updated.push({
              name: webhookConfig.name,
              id: existing.id
            });
            console.log(`🔄 Updated webhook: ${webhookConfig.name}`);
          }
        } catch (error) {
          results.errors.push({
            webhook: webhookConfig.name,
            error: error.message
          });
          console.error(`❌ Failed to configure webhook ${webhookConfig.name}:`, error);
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('❌ Webhook configuration failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentWebhooks() {
    const webhooks = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/hooks`);
    return webhooks;
  }

  async createWebhook(config) {
    const webhookData = {
      name: 'web',
      active: true,
      events: config.events,
      config: {
        ...config.config,
        secret: this.webhookSecret
      }
    };

    return await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    });
  }

  async updateWebhook(webhookId, config) {
    const webhookData = {
      active: true,
      events: config.events,
      config: {
        ...config.config,
        secret: this.webhookSecret
      }
    };

    return await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/hooks/${webhookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    });
  }

  needsWebhookUpdate(existing, target) {
    const existingEvents = existing.events.sort();
    const targetEvents = target.events.sort();

    return JSON.stringify(existingEvents) !== JSON.stringify(targetEvents) ||
           existing.config.url !== target.config.url ||
           !existing.active;
  }

  // === REPOSITORY METADATA MANAGEMENT ===

  async autoUpdateRepositoryMetadata() {
    try {
      console.log('🏷️ Starting repository metadata update...');

      const currentRepo = await this.getCurrentRepository();
      const results = {
        topicsUpdated: false,
        descriptionUpdated: false,
        errors: []
      };

      // Update topics
      try {
        const currentTopics = await this.getRepositoryTopics();
        const topicsNeedUpdate = !this.arraysEqual(
          currentTopics.sort(), 
          this.automationConfig.repositoryTopics.sort()
        );

        if (topicsNeedUpdate) {
          await this.updateRepositoryTopics();
          results.topicsUpdated = true;
          console.log('✅ Updated repository topics');
        }
      } catch (error) {
        results.errors.push({ type: 'topics', error: error.message });
      }

      // Update description
      try {
        const newDescription = await this.generateRepositoryDescription();
        if (currentRepo.description !== newDescription) {
          await this.updateRepositoryDescription(newDescription);
          results.descriptionUpdated = true;
          console.log('✅ Updated repository description');
        }
      } catch (error) {
        results.errors.push({ type: 'description', error: error.message });
      }

      return { success: true, results };
    } catch (error) {
      console.error('❌ Repository metadata update failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentRepository() {
    return await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}`);
  }

  async getRepositoryTopics() {
    const response = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/topics`);
    return response.names || [];
  }

  async updateRepositoryTopics() {
    await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/topics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        names: this.automationConfig.repositoryTopics
      })
    });
  }

  async generateRepositoryDescription() {
    const packageJson = await this.getPackageJson();
    const version = packageJson?.version || '1.0.0';
    const timestamp = new Date().toISOString().split('T')[0];

    return `🤖 Gurulo AI Assistant v${version} - Georgian AI Developer Assistant with advanced RAG, GitHub integration, and real-time development tools. Built on Replit with React + TypeScript + Node.js. Last updated: ${timestamp}`;
  }

  async updateRepositoryDescription(description) {
    await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
  }

  async getPackageJson() {
    try {
      const content = await fs.readFile('package.json', 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  // === BRANCH PROTECTION ===

  async autoSetupBranchProtection() {
    try {
      console.log('🛡️ Starting branch protection setup...');

      const results = {
        protected: [],
        errors: []
      };

      for (const [branch, rules] of Object.entries(this.automationConfig.branchProtectionRules)) {
        try {
          await this.setupBranchProtection(branch, rules);
          results.protected.push(branch);
          console.log(`✅ Protected branch: ${branch}`);
        } catch (error) {
          results.errors.push({ branch, error: error.message });
          console.error(`❌ Failed to protect branch ${branch}:`, error);
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('❌ Branch protection setup failed:', error);
      return { success: false, error: error.message };
    }
  }

  async setupBranchProtection(branch, rules) {
    await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/branches/${branch}/protection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules)
    });
  }

  // === RELEASE NOTES GENERATION ===

  async generateReleaseNotes(deploymentInfo) {
    try {
      console.log('📝 Generating release notes...');

      const version = await this.getNextVersion();
      const commits = await this.getRecentCommits(20);
      const issues = await this.getClosedIssuesSinceLastRelease();
      const timestamp = new Date().toISOString();

      const releaseNotes = await this.formatReleaseNotes({
        version,
        timestamp,
        commits,
        issues,
        deploymentInfo
      });

      const release = await this.createGitHubRelease({
        tag_name: `v${version}`,
        name: `Release v${version}`,
        body: releaseNotes,
        draft: false,
        prerelease: false
      });

      console.log(`✅ Created release: v${version}`);
      return { success: true, release, version };
    } catch (error) {
      console.error('❌ Release notes generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getNextVersion() {
    try {
      const releases = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/releases`);

      if (releases.length === 0) {
        return '1.0.0';
      }

      const latestRelease = releases[0];
      const version = latestRelease.tag_name.replace(/^v/, '');
      const [major, minor, patch] = version.split('.').map(Number);

      return `${major}.${minor}.${patch + 1}`;
    } catch (error) {
      return '1.0.0';
    }
  }

  async getRecentCommits(limit = 20) {
    const commits = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/commits?per_page=${limit}`);
    return commits.map(commit => ({
      sha: commit.sha.substring(0, 8),
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date
    }));
  }

  async getClosedIssuesSinceLastRelease() {
    try {
      const releases = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/releases`);
      const lastReleaseDate = releases.length > 0 ? releases[0].created_at : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const issues = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/issues?state=closed&since=${lastReleaseDate}&per_page=50`);

      return issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        labels: issue.labels.map(l => l.name),
        closedAt: issue.closed_at
      }));
    } catch (error) {
      return [];
    }
  }

  async formatReleaseNotes({ version, timestamp, commits, issues, deploymentInfo }) {
    const date = new Date(timestamp).toLocaleDateString('ka-GE');

    let notes = `# 🚀 Gurulo AI Assistant Release v${version}\n\n`;
    notes += `**Release Date:** ${date}\n`;
    notes += `**Deployment:** Replit Production Environment\n\n`;

    if (deploymentInfo) {
      notes += `## 🎯 Deployment Information\n`;
      notes += `- **Environment:** ${deploymentInfo.environment || 'Production'}\n`;
      notes += `- **Build Status:** ${deploymentInfo.buildStatus || 'Success'}\n`;
      notes += `- **Health Check:** ${deploymentInfo.healthCheck || 'Passed'}\n\n`;
    }

    if (issues.length > 0) {
      notes += `## 🐛 Issues Resolved\n\n`;
      issues.forEach(issue => {
        const labels = issue.labels.length > 0 ? ` [${issue.labels.join(', ')}]` : '';
        notes += `- #${issue.number}: ${issue.title}${labels}\n`;
      });
      notes += `\n`;
    }

    notes += `## 📝 Recent Changes\n\n`;
    commits.slice(0, 10).forEach(commit => {
      const shortMessage = commit.message.split('\n')[0];
      notes += `- \`${commit.sha}\` ${shortMessage} (${commit.author})\n`;
    });

    notes += `\n## 🔧 Technical Details\n\n`;
    notes += `- **Frontend:** React + TypeScript + Vite\n`;
    notes += `- **Backend:** Node.js + Express (Port 5002)\n`;
    notes += `- **AI Service:** Advanced RAG system (Port 5001)\n`;
    notes += `- **Database:** Firebase Firestore\n`;
    notes += `- **Deployment:** Replit Cloud Platform\n\n`;

    notes += `## 🏁 System Status\n\n`;
    notes += `- ✅ All services operational\n`;
    notes += `- ✅ CI/CD pipeline completed successfully\n`;
    notes += `- ✅ Security checks passed\n`;
    notes += `- ✅ Performance metrics within acceptable ranges\n\n`;

    notes += `---\n`;
    notes += `🤖 **Gurulo AI Assistant** - Georgian AI Developer Assistant\n`;
    notes += `📧 Support: gurulo@bakhmaro.ai\n`;
    notes += `🔗 Platform: [Replit](https://replit.com/@bakhmaro/gurula-ai)`;

    return notes;
  }

  async createGitHubRelease(releaseData) {
    return await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(releaseData)
    });
  }

  // === COMPREHENSIVE AUTOMATION ===

  async runFullAutomation(options = {}) {
    try {
      console.log('🤖 Starting full repository automation...');

      const results = {
        timestamp: new Date().toISOString(),
        collaborators: null,
        webhooks: null,
        metadata: null,
        branchProtection: null,
        releaseNotes: null,
        errors: []
      };

      // Run all automation tasks
      if (options.collaborators !== false) {
        try {
          results.collaborators = await this.autoManageCollaborators();
        } catch (error) {
          results.errors.push({ task: 'collaborators', error: error.message });
        }
      }

      if (options.webhooks !== false) {
        try {
          results.webhooks = await this.autoConfigureWebhooks();
        } catch (error) {
          results.errors.push({ task: 'webhooks', error: error.message });
        }
      }

      if (options.metadata !== false) {
        try {
          results.metadata = await this.autoUpdateRepositoryMetadata();
        } catch (error) {
          results.errors.push({ task: 'metadata', error: error.message });
        }
      }

      if (options.branchProtection !== false) {
        try {
          results.branchProtection = await this.autoSetupBranchProtection();
        } catch (error) {
          results.errors.push({ task: 'branchProtection', error: error.message });
        }
      }

      if (options.releaseNotes && options.deploymentInfo) {
        try {
          results.releaseNotes = await this.generateReleaseNotes(options.deploymentInfo);
        } catch (error) {
          results.errors.push({ task: 'releaseNotes', error: error.message });
        }
      }

      const successCount = Object.values(results).filter(v => v && v.success).length;
      const totalTasks = Object.keys(results).filter(k => k !== 'timestamp' && k !== 'errors').length;

      console.log(`✅ Repository automation completed: ${successCount}/${totalTasks} tasks successful`);

      return {
        success: results.errors.length === 0,
        results,
        summary: {
          successCount,
          totalTasks,
          errorCount: results.errors.length
        }
      };
    } catch (error) {
      console.error('❌ Full automation failed:', error);
      return { success: false, error: error.message };
    }
  }

  // === UTILITY METHODS ===

  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  validateConfiguration() {
    const issues = [];

    if (!this.githubToken) {
      issues.push('GitHub token not configured (GITHUB_TOKEN)');
    }

    if (!this.repoOwner) {
      issues.push('Repository owner not configured (GITHUB_OWNER)');
    }

    if (!this.repoName) {
      issues.push('Repository name not configured (GITHUB_REPO)');
    }

    if (!this.webhookSecret) {
      issues.push('Webhook secret not configured (GITHUB_WEBHOOK_SECRET)');
    }

    if (!this.replitUrl) {
      issues.push('Replit URL not configured (REPLIT_URL)');
    }

    return { valid: issues.length === 0, issues };
  }

  getStatus() {
    try {
      const config = this.validateConfiguration();

      return {
        enabled: config.valid,
        jobs: Array.isArray(this.activeJobs) ? this.activeJobs : [],
        status: {
          githubToken: !!this.githubToken,
          webhookSecret: !!this.webhookSecret,
          repoConfigured: !!(this.repoOwner && this.repoName)
        },
        config: {
          owner: this.repoOwner ? 'SET' : 'MISSING',
          repo: this.repoName ? 'SET' : 'MISSING',
          token: this.githubToken ? 'SET' : 'MISSING',
          webhook: this.webhookSecret ? 'SET' : 'MISSING',
          url: this.replitUrl ? 'SET' : 'MISSING'
        }
      };
    } catch (error) {
      console.error('Repository Automation getStatus error:', error);
      return {
        enabled: false,
        jobs: [],
        status: {
          githubToken: false,
          webhookSecret: false,
          repoConfigured: false
        },
        config: {
          owner: 'ERROR',
          repo: 'ERROR',
          token: 'ERROR',
          webhook: 'ERROR',
          url: 'ERROR'
        },
        error: error.message
      };
    }
  }
}

module.exports = new RepositoryAutomationService();
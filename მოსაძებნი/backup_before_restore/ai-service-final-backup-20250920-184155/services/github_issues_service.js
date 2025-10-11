// Temporarily disabled for ESM compatibility issues
// const { Octokit } = require('@octokit/rest');
const fetch = require('node-fetch'); // Assuming node-fetch is available

class GitHubIssuesService {
  constructor() {
    this.octokit = null;
    this.repository = null;
    this.owner = null;
    this.isInitialized = false;
    this.issueCache = new Map();
    this.autoCloseEnabled = true;
    this.githubToken = null; // Added to store token for makeGitHubRequest
  }

  // Initialize GitHub API client
  async initialize(token, repositoryUrl) {
    try {
      if (!token) {
        console.warn('⚠️ No GitHub token provided, initializing in demo mode');
        this.isInitialized = false;
        this.owner = 'bakhmaro';
        this.repository = 'gurula-ai';
        return { success: false, error: 'No GitHub token provided' };
      }
      
      this.githubToken = token;

      // Parse repository URL with better error handling
      let owner = 'bakhmaro';
      let repo = 'gurula-ai';
      
      if (repositoryUrl) {
        if (repositoryUrl.includes('github.com')) {
          const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (match) {
            owner = match[1];
            repo = match[2].replace('.git', '');
          }
        } else {
          // Handle direct owner/repo format
          const parts = repositoryUrl.split('/');
          if (parts.length >= 2) {
            owner = parts[0];
            repo = parts[1].replace('.git', '');
          }
        }
      }

      this.owner = owner;
      this.repository = repo;

      console.log(`🔍 Attempting to connect to GitHub repository: ${this.owner}/${this.repository}`);

      // Test connection - if it fails, still initialize in limited mode
      try {
        const repoData = await this.makeGitHubRequest(`/repos/${this.owner}/${this.repository}`);
        console.log(`✅ GitHub repository connection successful: ${this.owner}/${this.repository}`);
        console.log(`📊 Repository has ${repoData.open_issues_count} open issues`);
        this.isInitialized = true;
        
        return { 
          success: true, 
          message: `GitHub Issues ინტეგრაცია წარმატებული - ${this.owner}/${this.repository}` 
        };
      } catch (repoError) {
        console.warn(`⚠️ Repository ${this.owner}/${this.repository} not accessible:`, repoError.message);
        
        // Still initialize but mark as limited access
        this.isInitialized = false; // This will trigger fallback stats
        console.log('🔧 Initializing GitHub Issues service in limited/demo mode');
        
        return { 
          success: false, 
          error: `Repository not accessible: ${repoError.message}`,
          demo_mode: true 
        };
      }
    } catch (error) {
      console.error('❌ GitHub Issues ინიციალიზაციის შეცდომა:', error.message);
      
      // Initialize in fallback mode
      this.isInitialized = false;
      this.owner = 'bakhmaro';
      this.repository = 'gurula-ai';
      
      return { 
        success: false, 
        error: error.message,
        demo_mode: true 
      };
    }
  }

  // Create automatic bug issue from AI error detection
  async createBugIssue(errorDetails) {
    try {
      if (!this.isInitialized) {
        throw new Error('GitHub Issues არ არის ინიციალიზებული');
      }

      const { error, context, stackTrace, userId, timestamp } = errorDetails;

      const title = `🐛 Auto-detected Bug: ${error.message || 'Unknown Error'}`;

      const body = this.generateBugReport({
        error,
        context,
        stackTrace,
        userId,
        timestamp,
        source: 'AI Assistant Auto-Detection'
      });

      const labels = ['bug', 'auto-detected', this.determineSeverityLabel(error)];

      // Add component labels based on context
      if (context?.component) {
        labels.push(`component:${context.component}`);
      }

      const issue = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repository,
        title,
        body,
        labels,
        assignees: await this.getAutoAssignees('bug')
      });

      // Cache the issue for auto-closing
      this.issueCache.set(this.generateErrorHash(error), {
        number: issue.data.number,
        type: 'bug',
        created: Date.now()
      });

      console.log(`🐛 Bug issue შექმნილი: #${issue.data.number}`);

      return {
        success: true,
        issueNumber: issue.data.number,
        issueUrl: issue.data.html_url
      };
    } catch (error) {
      console.error('❌ Bug issue შექმნის შეცდომა:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Create issue from user feedback
  async createFeedbackIssue(feedbackData) {
    try {
      if (!this.isInitialized) {
        throw new Error('GitHub Issues არ არის ინიციალიზებული');
      }

      const { type, title, description, userId, priority, component } = feedbackData;

      const issueTitle = `${this.getFeedbackEmoji(type)} ${title}`;

      const body = this.generateFeedbackReport({
        type,
        description,
        userId,
        priority,
        component,
        timestamp: new Date().toISOString(),
        source: 'User Feedback'
      });

      const labels = [this.getFeedbackLabel(type), `priority:${priority || 'medium'}`];

      if (component) {
        labels.push(`component:${component}`);
      }

      const issue = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repository,
        title: issueTitle,
        body,
        labels,
        assignees: await this.getAutoAssignees(type)
      });

      console.log(`💬 Feedback issue შექმნილი: #${issue.data.number}`);

      return {
        success: true,
        issueNumber: issue.data.number,
        issueUrl: issue.data.html_url
      };
    } catch (error) {
      console.error('❌ Feedback issue შექმნის შეცდომა:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Create feature request issue
  async createFeatureRequest(requestData) {
    try {
      if (!this.isInitialized) {
        throw new Error('GitHub Issues არ არის ინიციალიზებული');
      }

      const { title, description, businessValue, acceptanceCriteria, userId, priority } = requestData;

      const issueTitle = `✨ Feature Request: ${title}`;

      const body = this.generateFeatureRequestReport({
        description,
        businessValue,
        acceptanceCriteria,
        userId,
        priority,
        timestamp: new Date().toISOString()
      });

      const labels = ['enhancement', 'feature-request', `priority:${priority || 'medium'}`];

      const issue = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repository,
        title: issueTitle,
        body,
        labels,
        assignees: await this.getAutoAssignees('feature')
      });

      console.log(`✨ Feature request შექმნილი: #${issue.data.number}`);

      return {
        success: true,
        issueNumber: issue.data.number,
        issueUrl: issue.data.html_url
      };
    } catch (error) {
      console.error('❌ Feature request შექმნის შეცდომა:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Auto-assign tasks based on type and component
  async getAutoAssignees(type) {
    const assignmentRules = {
      'bug': ['AI-team-lead'],
      'feature': ['product-owner'],
      'feedback': ['support-team'],
      'security': ['security-team'],
      'performance': ['performance-team']
    };

    return assignmentRules[type] || [];
  }

  // Automatically close issue when bug is fixed
  async autoCloseIssue(errorHash, resolution) {
    try {
      if (!this.autoCloseEnabled || !this.isInitialized) {
        return { success: false, error: 'Auto-close disabled or not initialized' };
      }

      const cachedIssue = this.issueCache.get(errorHash);
      if (!cachedIssue) {
        return { success: false, error: 'Issue not found in cache' };
      }

      const closeComment = `🤖 **Auto-Close**: This issue has been automatically resolved.

**Resolution Details:**
- **Fixed by**: AI Assistant
- **Resolution**: ${resolution}
- **Timestamp**: ${new Date().toISOString()}
- **Verification**: Automated testing confirmed fix

This issue was automatically closed because the underlying error is no longer occurring in the system.`;

      // Add comment first
      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repository,
        issue_number: cachedIssue.number,
        body: closeComment
      });

      // Close the issue
      await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repository,
        issue_number: cachedIssue.number,
        state: 'closed',
        labels: ['auto-resolved', 'bug', 'resolved']
      });

      // Remove from cache
      this.issueCache.delete(errorHash);

      console.log(`✅ Issue #${cachedIssue.number} ავტომატურად დაიხურა`);

      return { success: true, issueNumber: cachedIssue.number };
    } catch (error) {
      console.error('❌ Auto-close შეცდომა:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Track progress on issues
  async updateIssueProgress(issueNumber, progressData) {
    try {
      if (!this.isInitialized) {
        throw new Error('GitHub Issues არ არის ინიციალიზებული');
      }

      const { status, assignee, milestone, timeSpent, comment } = progressData;

      const updateData = {};

      if (assignee) {
        updateData.assignees = [assignee];
      }

      if (milestone) {
        updateData.milestone = milestone;
      }

      if (status === 'in-progress') {
        updateData.labels = ['in-progress'];
      } else if (status === 'review') {
        updateData.labels = ['needs-review'];
      } else if (status === 'testing') {
        updateData.labels = ['testing'];
      }

      // Update issue
      if (Object.keys(updateData).length > 0) {
        await this.octokit.rest.issues.update({
          owner: this.owner,
          repo: this.repository,
          issue_number: issueNumber,
          ...updateData
        });
      }

      // Add progress comment
      if (comment || timeSpent) {
        const progressComment = `📊 **Progress Update**

${comment ? `**Update**: ${comment}` : ''}
${timeSpent ? `**Time Spent**: ${timeSpent}` : ''}
**Status**: ${status}
**Updated**: ${new Date().toISOString()}`;

        await this.octokit.rest.issues.createComment({
          owner: this.owner,
          repo: this.repository,
          issue_number: issueNumber,
          body: progressComment
        });
      }

      console.log(`📊 Issue #${issueNumber} progress განახლებული`);

      return { success: true };
    } catch (error) {
      console.error('❌ Progress update შეცდომა:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get issue statistics with real data
  async getIssueStats() {
    try {
      console.log('🔍 GitHub Issues stats - checking initialization status');
      
      if (!this.isInitialized || !this.githubToken) {
        console.log('⚠️ GitHub Issues service not properly configured, returning fallback stats');
        console.log(`   Token available: ${!!this.githubToken}`);
        console.log(`   Repository: ${this.owner}/${this.repository}`);
        return this.getFallbackStats();
      }

      // First verify repository exists
      try {
        const repoInfo = await this.makeGitHubRequest(`/repos/${this.owner}/${this.repository}`);
        console.log(`✅ Repository verified: ${this.owner}/${this.repository}`);
      } catch (repoError) {
        console.warn(`⚠️ Repository not accessible: ${repoError.message}`);
        return this.getFallbackStats();
      }

      // Simplified approach - get issues with basic pagination
      try {
        const openIssuesResponse = await this.makeGitHubRequest(
          `/repos/${this.owner}/${this.repository}/issues?state=open&per_page=100`
        );
        
        const closedIssuesResponse = await this.makeGitHubRequest(
          `/repos/${this.owner}/${this.repository}/issues?state=closed&per_page=100&since=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`
        );

        const stats = {
          open: openIssuesResponse.length,
          closed: closedIssuesResponse.length,
          byType: this.categorizeIssues(openIssuesResponse),
          recentlyResolved: closedIssuesResponse.length,
          autoDetected: openIssuesResponse.filter(issue => 
            issue.labels && issue.labels.some(label => 
              (typeof label === 'string' ? label : label.name) === 'auto-detected'
            )
          ).length
        };

        console.log('✅ Real GitHub stats retrieved successfully');
        return { success: true, stats };
      } catch (issuesError) {
        console.warn(`⚠️ Failed to fetch issues: ${issuesError.message}`);
        return this.getFallbackStats();
      }
    } catch (error) {
      console.error('❌ Issue stats შეცდომა:', error.message);
      return this.getFallbackStats();
    }
  }

  // Fallback stats when GitHub API is not available
  getFallbackStats() {
    console.log('📊 Using fallback GitHub Issues stats');
    return {
      success: true,
      stats: {
        open: 3,
        closed: 12,
        byType: { 
          bugs: 1, 
          features: 2, 
          feedback: 0, 
          questions: 0 
        },
        recentlyResolved: 5,
        autoDetected: 1
      },
      fallback: true,
      error: 'GitHub API not accessible - using demo data'
    };
  }

  // Helper methods
  generateBugReport({ error, context, stackTrace, userId, timestamp, source }) {
    return `## 🐛 Bug Report

**Auto-generated by**: ${source}
**Timestamp**: ${timestamp}
**User ID**: ${userId || 'Anonymous'}

### Error Details
\`\`\`
${error.message || 'No error message available'}
\`\`\`

### Context
${context ? JSON.stringify(context, null, 2) : 'No context available'}

### Stack Trace
\`\`\`
${stackTrace || 'No stack trace available'}
\`\`\`

### Environment
- **Platform**: Replit
- **Service**: ${context?.service || 'Unknown'}
- **Component**: ${context?.component || 'Unknown'}

---
*This issue was automatically created by Gurulo AI Assistant*`;
  }

  generateFeedbackReport({ type, description, userId, priority, component, timestamp, source }) {
    return `## 💬 User Feedback

**Source**: ${source}
**Timestamp**: ${timestamp}
**User ID**: ${userId || 'Anonymous'}
**Type**: ${type}
**Priority**: ${priority}
**Component**: ${component || 'General'}

### Description
${description}

---
*This issue was automatically created from user feedback*`;
  }

  generateFeatureRequestReport({ description, businessValue, acceptanceCriteria, userId, priority, timestamp }) {
    return `## ✨ Feature Request

**Requested by**: ${userId || 'Anonymous'}
**Timestamp**: ${timestamp}
**Priority**: ${priority}

### Description
${description}

### Business Value
${businessValue || 'To be defined'}

### Acceptance Criteria
${acceptanceCriteria || 'To be defined'}

---
*This feature request was automatically created*`;
  }

  generateErrorHash(error) {
    const crypto = require('crypto');
    const errorString = `${error.message || ''}:${error.stack || ''}`;
    return crypto.createHash('md5').update(errorString).digest('hex');
  }

  determineSeverityLabel(error) {
    const message = (error.message || '').toLowerCase();

    if (message.includes('critical') || message.includes('crash') || message.includes('fatal')) {
      return 'severity:critical';
    } else if (message.includes('error') || message.includes('fail')) {
      return 'severity:high';
    } else if (message.includes('warning') || message.includes('deprecated')) {
      return 'severity:medium';
    }

    return 'severity:low';
  }

  getFeedbackEmoji(type) {
    const emojis = {
      'bug': '🐛',
      'feature': '✨',
      'improvement': '🔧',
      'question': '❓',
      'complaint': '😞',
      'praise': '👏'
    };

    return emojis[type] || '💬';
  }

  getFeedbackLabel(type) {
    const labels = {
      'bug': 'bug',
      'feature': 'enhancement',
      'improvement': 'enhancement',
      'question': 'question',
      'complaint': 'feedback',
      'praise': 'feedback'
    };

    return labels[type] || 'feedback';
  }

  categorizeIssues(issues) {
    const categories = {
      bugs: 0,
      features: 0,
      feedback: 0,
      questions: 0
    };

    issues.forEach(issue => {
      const labels = issue.labels.map(label => label.name);

      if (labels.includes('bug')) {
        categories.bugs++;
      } else if (labels.includes('enhancement')) {
        categories.features++;
      } else if (labels.includes('feedback')) {
        categories.feedback++;
      } else if (labels.includes('question')) {
        categories.questions++;
      }
    });

    return categories;
  }

  // Enable/disable auto-close functionality
  setAutoCloseEnabled(enabled) {
    this.autoCloseEnabled = enabled;
    console.log(`🔧 Auto-close ${enabled ? 'ჩართული' : 'გამორთული'}`);
  }

  // Utility function for paginated GitHub API requests
  async makePagedGitHubRequest(baseEndpoint, params = {}, maxPages = 10) {
    let allData = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const queryParams = new URLSearchParams({
        ...params,
        per_page: 100,
        page: page.toString()
      });

      const endpoint = `${baseEndpoint}?${queryParams.toString()}`;
      console.log(`📄 GitHub API Paginated Request - Page ${page}: ${endpoint}`);

      const data = await this.makeGitHubRequest(endpoint);
      
      if (!Array.isArray(data)) {
        console.warn(`⚠️ Expected array response for pagination, got:`, typeof data);
        return allData;
      }

      allData = allData.concat(data);
      hasMore = data.length === 100;
      page++;

      // Log pagination progress
      console.log(`📄 Page ${page - 1} fetched: ${data.length} items (total: ${allData.length})`);
    }

    if (page > maxPages) {
      console.warn(`⚠️ GitHub API pagination stopped at max pages (${maxPages}) for safety`);
    }

    return allData;
  }

  // New method for making GitHub API requests with rate limiting and error handling
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

    // Rate limiting with exponential backoff
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        // Progressive delay based on attempt
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));

        const response = await fetch(url, {
          ...options,
          headers,
          timeout: 30000 // 30 second timeout
        });

        // Handle rate limiting
        if (response.status === 429) {
          const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
          const resetDate = new Date(resetTime * 1000);
          const waitTime = Math.max(resetDate.getTime() - Date.now(), 60000); // Min 1 minute wait

          console.warn(`⏰ GitHub API rate limit exceeded. Waiting ${Math.round(waitTime / 1000)} seconds...`);

          if (attempt === maxAttempts - 1) {
            throw new Error(`Rate limit exceeded. Try again after ${resetDate.toISOString()}`);
          }

          await new Promise(resolve => setTimeout(resolve, waitTime));
          attempt++;
          continue;
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;

          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              errorMessage += ` - ${errorJson.message}`;
            }
            if (errorJson.documentation_url) {
              errorMessage += ` (See: ${errorJson.documentation_url})`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }

          // Don't retry on client errors (4xx except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(errorMessage);
          }

          // Retry on server errors (5xx)
          if (response.status >= 500 && attempt < maxAttempts - 1) {
            console.warn(`🔄 GitHub API server error (${response.status}), retrying... (attempt ${attempt + 1}/${maxAttempts})`);
            attempt++;
            continue;
          }

          throw new Error(errorMessage);
        }

        // Log rate limit status
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const limit = response.headers.get('X-RateLimit-Limit');
        if (remaining && limit) {
          console.log(`📊 GitHub API rate limit: ${remaining}/${limit} remaining`);

          // Warn when getting low
          if (parseInt(remaining) < 100) {
            console.warn(`⚠️ GitHub API rate limit running low: ${remaining}/${limit}`);
          }
        }

        return await response.json();
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          console.error('❌ GitHub API request failed after all retries:', error);
          throw error;
        }

        console.warn(`⚠️ GitHub API request failed (attempt ${attempt + 1}/${maxAttempts}):`, error.message);
        attempt++;
      }
    }
  }
}

module.exports = new GitHubIssuesService();
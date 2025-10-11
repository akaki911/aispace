const gitHubIssuesService = require('./github_issues_service');

class AutoIssueDetector {
  constructor() {
    this.errorPatterns = new Map();
    this.githubIssuesService = require('./github_issues_service');
    this.isEnabled = process.env.AUTO_ISSUE_CREATION === 'true';
    this.errorCache = new Map(); // Prevent duplicate issues
    this.severityThresholds = {
      critical: ['crash', 'fatal', 'cannot', 'failed to start', 'uncaught exception'],
      high: ['error', 'exception', 'failed', 'timeout', 'connection refused'],
      medium: ['warning', 'deprecated', 'slow', 'performance'],
      low: ['info', 'debug', 'notice']
    };
    
    // Initialize GitHub service connection
    this.initializeGitHubService();
    
    // Statistics tracking
    this.stats = {
      totalDetected: 0,
      totalCreated: 0,
      totalResolved: 0,
      byseverity: { critical: 0, high: 0, medium: 0, low: 0 }
    };
  }

  async initializeGitHubService() {
    try {
      if (!this.githubIssuesService.isInitialized && process.env.GITHUB_TOKEN) {
        const repoUrl = process.env.GITHUB_REPO_URL || 'https://github.com/bakhmaro/gurula-ai';
        await this.githubIssuesService.initialize(process.env.GITHUB_TOKEN, repoUrl);
        console.log('🔗 Auto-issue detector connected to GitHub');
      }
    } catch (error) {
      console.warn('⚠️ Auto-issue detector GitHub initialization failed:', error.message);
    }
  }

  // Monitor errors and auto-create issues
  async detectAndCreateIssue(error, context = {}) {
    try {
      if (!this.isEnabled) {
        return { success: false, reason: 'Auto-detection disabled' };
      }

      const errorHash = this.generateErrorHash(error);

      // Check if we already created an issue for this error
      if (this.errorCache.has(errorHash)) {
        return { success: false, reason: 'Issue already exists' };
      }

      // Determine severity
      const severity = this.determineSeverity(error.message);

      // Add to cache with severity and timestamp
      this.errorCache.set(errorHash, {
        severity,
        timestamp: Date.now(),
        count: (this.errorCache.get(errorHash)?.count || 0) + 1,
        context: { ...context }
      });

      const errorData = this.errorCache.get(errorHash);

      // Auto-create issue if severity threshold is met
      if (this.shouldCreateIssue(severity, errorData.count)) {
        const errorDetails = {
          error,
          context: {
            ...context,
            severity,
            occurrences: errorData.count,
            service: context.service || 'AI Service',
            component: context.component || 'Unknown'
          },
          stackTrace: error.stack || 'No stack trace available',
          userId: context.userId || 'system',
          timestamp: new Date().toISOString()
        };

        const result = await this.githubIssuesService.createBugIssue(errorDetails);

        if (result.success) {
          this.errorCache.delete(errorHash); // Remove from cache after issue creation
          console.log(`🤖 Auto-created issue #${result.issueNumber} for error: ${error.message} (Severity: ${severity})`);

          return {
            success: true,
            issueNumber: result.issueNumber,
            issueUrl: result.issueUrl,
            reason: 'Threshold reached'
          };
        }
      }

      return {
        success: false,
        reason: `Error detected (Severity: ${severity}, Count: ${errorData.count})`
      };
    } catch (error) {
      console.error('❌ Auto issue detection error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Detect when error is resolved and auto-close issue
  async detectResolution(errorHash, context = {}) {
    try {
      if (!this.isEnabled) {
        return { success: false, reason: 'Auto-detection disabled' };
      }

      if (this.errorCache.has(errorHash)) {
        const errorData = this.errorCache.get(errorHash);
        const resolution = `Error resolved in ${context.component || 'system'}.

**Resolution Context:**
- Fixed at: ${new Date().toISOString()}
- Service: ${context.service || errorData.context.service || 'AI Service'}
- Component: ${context.component || errorData.context.component || 'Unknown'}
- Method: ${context.method || 'Automatic detection'}
- Original Error Count: ${errorData.count}
- Original Severity: ${errorData.severity}`;

        const result = await this.githubIssuesService.autoCloseIssue(errorHash, resolution);

        if (result.success) {
          this.errorCache.delete(errorHash); // Remove from cache
          console.log(`✅ Auto-closed issue #${result.issueNumber} for resolved error`);

          return {
            success: true,
            issueNumber: result.issueNumber,
            reason: 'Error resolved'
          };
        }
      }

      return { success: false, reason: 'No error found for this hash in cache' };
    } catch (error) {
      console.error('❌ Auto resolution detection error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Process user feedback as issue
  async processFeedback(feedbackData) {
    try {
      if (!this.isEnabled) {
        return { success: false, reason: 'Auto-processing disabled' };
      }

      // Auto-categorize feedback
      const type = this.categorizeFeedback(feedbackData.content);
      const priority = this.determinePriority(feedbackData);

      const processedFeedback = {
        type,
        title: feedbackData.title || this.generateTitle(feedbackData.content, type),
        description: feedbackData.content,
        priority,
        component: feedbackData.component || this.detectComponent(feedbackData.content),
        userId: feedbackData.userId
      };

      const result = await this.githubIssuesService.createFeedbackIssue(processedFeedback);

      if (result.success) {
        console.log(`💬 Auto-created feedback issue #${result.issueNumber}`);

        return {
          success: true,
          issueNumber: result.issueNumber,
          issueUrl: result.issueUrl,
          type,
          priority
        };
      }

      return result;
    } catch (error) {
      console.error('❌ Feedback processing error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  generateErrorHash(error) {
    const crypto = require('crypto');
    const errorString = `${error.message || ''}:${error.name || ''}:${error.stack || ''}`;
    return crypto.createHash('md5').update(errorString).digest('hex');
  }

  // Determine severity based on keywords in error message
  determineSeverity(errorMessage) {
    const lowerMessage = errorMessage.toLowerCase();
    for (const severity in this.severityThresholds) {
      for (const keyword of this.severityThresholds[severity]) {
        if (lowerMessage.includes(keyword)) {
          return severity;
        }
      }
    }
    return 'low'; // Default to low if no keywords match
  }

  // Determine if an issue should be created based on severity and count
  shouldCreateIssue(severity, count) {
    switch (severity) {
      case 'critical':
        return count >= 1; // Create issue immediately for critical errors
      case 'high':
        return count >= 2; // Create issue after 2 high severity errors
      case 'medium':
        return count >= 3; // Create issue after 3 medium severity errors
      case 'low':
        return count >= 5; // Create issue after 5 low severity errors
      default:
        return false;
    }
  }

  // Categorize feedback
  categorizeFeedback(content) {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('error') || lowerContent.includes('bug') || lowerContent.includes('broken')) {
      return 'bug';
    } else if (lowerContent.includes('feature') || lowerContent.includes('add') || lowerContent.includes('new')) {
      return 'feature';
    } else if (lowerContent.includes('improve') || lowerContent.includes('better') || lowerContent.includes('enhance')) {
      return 'improvement';
    } else if (lowerContent.includes('question') || lowerContent.includes('how') || lowerContent.includes('?')) {
      return 'question';
    }

    return 'feedback';
  }

  // Determine priority for feedback issues
  determinePriority(feedbackData) {
    const content = (feedbackData.content || '').toLowerCase();

    if (content.includes('critical') || content.includes('urgent') || content.includes('crash')) {
      return 'critical';
    } else if (content.includes('important') || content.includes('high') || content.includes('blocking')) {
      return 'high';
    } else if (content.includes('minor') || content.includes('low') || content.includes('nice to have')) {
      return 'low';
    }

    return 'medium';
  }

  // Detect component from feedback content
  detectComponent(content) {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('ai') || lowerContent.includes('assistant') || lowerContent.includes('chat')) {
      return 'ai-assistant';
    } else if (lowerContent.includes('file') || lowerContent.includes('tree') || lowerContent.includes('explorer')) {
      return 'file-explorer';
    } else if (lowerContent.includes('github') || lowerContent.includes('git') || lowerContent.includes('commit')) {
      return 'git-integration';
    } else if (lowerContent.includes('ui') || lowerContent.includes('interface') || lowerContent.includes('design')) {
      return 'ui-ux';
    }

    return 'general';
  }

  // Generate a title for feedback issues
  generateTitle(content, type) {
    const words = content.split(' ').slice(0, 8).join(' ');
    const typeEmoji = {
      'bug': '🐛',
      'feature': '✨',
      'improvement': '🔧',
      'question': '❓',
      'feedback': '💬'
    };

    return `${typeEmoji[type] || '💬'} ${words}${words.length < content.length ? '...' : ''}`;
  }

  // Enable/disable auto-detection
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`🤖 Auto-issue detection ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Monitor successful operations and auto-close related issues
  async monitorSuccessfulOperation(operation, context = {}) {
    try {
      if (!this.isEnabled) {
        return { success: false, reason: 'Auto-monitoring disabled' };
      }

      // Generate operation hash to match with error hashes
      const operationHash = this.generateOperationHash(operation, context);

      // Find related error hashes in cache
      const relatedErrorHashes = this.findRelatedErrorHashes(operation, context);

      let closedIssues = 0;

      for (const errorHash of relatedErrorHashes) {
        if (this.errorCache.has(errorHash)) {
          const errorData = this.errorCache.get(errorHash);
          const resolution = `Operation "${operation}" completed successfully.

**Success Context:**
- Completed at: ${new Date().toISOString()}
- Service: ${context.service || errorData.context.service || 'AI Service'}
- Component: ${context.component || errorData.context.component || 'Unknown'}
- User: ${context.userId || 'System'}
- Operation: ${operation}
- Details: ${context.details || 'Operation completed without errors'}`;

          const result = await this.detectResolution(errorHash, {
            ...context,
            operation,
            method: 'Successful operation monitoring'
          });

          if (result.success) {
            closedIssues++;
            console.log(`✅ Auto-closed issue due to successful operation: ${operation}`);
          }
        }
      }

      return {
        success: true,
        closedIssues,
        operationHash,
        monitoredOperation: operation
      };

    } catch (error) {
      console.error('❌ Success monitoring error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Generate hash for successful operations
  generateOperationHash(operation, context) {
    const crypto = require('crypto');
    const operationString = `${operation}:${context.component || ''}:${context.service || ''}:${context.endpoint || ''}`;
    return crypto.createHash('md5').update(operationString).digest('hex');
  }

  // Find related error hashes in cache based on operation and context
  findRelatedErrorHashes(operation, context) {
    const relatedHashes = [];
    const operationLower = operation.toLowerCase();
    const componentLower = context.component?.toLowerCase();
    const serviceLower = context.service?.toLowerCase();

    for (const errorHash of this.errorCache.keys()) {
      // This is a simplified matching logic. In a real-world scenario,
      // you'd want a more robust way to link operations to specific errors.
      // For now, we'll check if the operation/component/service keywords
      // appear in the error hash or if the context matches.

      // Crude check: if any part of the operation/context matches keywords in the error hash
      if (operationLower.includes('commit') && errorHash.includes('commit')) {
        relatedHashes.push(errorHash);
      } else if (componentLower && errorHash.includes(componentLower)) {
        relatedHashes.push(errorHash);
      } else if (serviceLower && errorHash.includes(serviceLower)) {
        relatedHashes.push(errorHash);
      }
      // Add more sophisticated matching logic here if needed
    }

    return relatedHashes;
  }

  // Get detection statistics
  getStats() {
    return {
      enabled: this.isEnabled,
      errorCacheSize: this.errorCache.size,
      errorCache: Array.from(this.errorCache.entries()).map(([hash, data]) => ({
        hash,
        severity: data.severity,
        count: data.count,
        timestamp: new Date(data.timestamp).toISOString()
      }))
    };
  }

  // Clear cache (for testing)
  clearCache() {
    this.errorCache.clear();
    console.log('🧹 Auto-issue detector cache cleared');
  }
}

module.exports = new AutoIssueDetector();

const express = require('express');
const router = express.Router();
const gitHubIssuesService = require('../services/github_issues_service');
const { requireAssistantAuth } = require('../middleware/authz');

// Use requireAssistantAuth as authenticateUser
const authenticateUser = requireAssistantAuth;

// Initialize GitHub Issues integration
router.post('/init', authenticateUser, async (req, res) => {
  try {
    const { token, repositoryUrl } = req.body;
    
    if (!token || !repositoryUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'GitHub token და repository URL აუცილებელია' 
      });
    }
    
    const result = await gitHubIssuesService.initialize(token, repositoryUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create bug issue automatically
router.post('/bugs', authenticateUser, async (req, res) => {
  try {
    const { error, context, stackTrace, userId } = req.body;
    
    if (!error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Error details აუცილებელია' 
      });
    }
    
    const errorDetails = {
      error,
      context,
      stackTrace,
      userId: userId || req.user?.id,
      timestamp: new Date().toISOString()
    };
    
    const result = await gitHubIssuesService.createBugIssue(errorDetails);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create feedback issue
router.post('/feedback', authenticateUser, async (req, res) => {
  try {
    const { type, title, description, priority, component } = req.body;
    
    if (!type || !title || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Type, title და description აუცილებელია' 
      });
    }
    
    const feedbackData = {
      type,
      title,
      description,
      priority: priority || 'medium',
      component,
      userId: req.user?.id
    };
    
    const result = await gitHubIssuesService.createFeedbackIssue(feedbackData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create feature request
router.post('/features', authenticateUser, async (req, res) => {
  try {
    const { title, description, businessValue, acceptanceCriteria, priority } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title და description აუცილებელია' 
      });
    }
    
    const requestData = {
      title,
      description,
      businessValue,
      acceptanceCriteria,
      priority: priority || 'medium',
      userId: req.user?.id
    };
    
    const result = await gitHubIssuesService.createFeatureRequest(requestData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update issue progress
router.patch('/issues/:issueNumber/progress', authenticateUser, async (req, res) => {
  try {
    const { issueNumber } = req.params;
    const { status, assignee, milestone, timeSpent, comment } = req.body;
    
    const progressData = {
      status,
      assignee,
      milestone,
      timeSpent,
      comment
    };
    
    const result = await gitHubIssuesService.updateIssueProgress(
      parseInt(issueNumber), 
      progressData
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-close issue
router.post('/issues/auto-close', authenticateUser, async (req, res) => {
  try {
    const { errorHash, resolution } = req.body;
    
    if (!errorHash || !resolution) {
      return res.status(400).json({ 
        success: false, 
        error: 'Error hash და resolution აუცილებელია' 
      });
    }
    
    const result = await gitHubIssuesService.autoCloseIssue(errorHash, resolution);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get issue statistics with real GitHub API integration
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    // Initialize GitHub service if not already initialized
    if (!gitHubIssuesService.isInitialized) {
      const token = process.env.GITHUB_TOKEN || req.headers['x-github-token'];
      const repoUrl = process.env.GITHUB_REPO_URL || 'https://github.com/bakhmaro/gurula-ai';
      
      if (token) {
        await gitHubIssuesService.initialize(token, repoUrl);
      }
    }

    const result = await gitHubIssuesService.getIssueStats();
    
    // Add real-time metrics
    const enhancedStats = {
      ...result,
      realTimeMetrics: {
        timestamp: new Date().toISOString(),
        autoDetectionEnabled: process.env.AUTO_ISSUE_CREATION === 'true',
        totalProcessedFeedback: await getTotalProcessedFeedback(),
        activeErrors: await getActiveErrorCount()
      }
    };

    res.json(enhancedStats);
  } catch (error) {
    console.error('GitHub Issues stats error:', error);
    
    // Fallback stats if GitHub API fails
    res.json({
      success: true,
      stats: {
        open: 0,
        closed: 0,
        byType: { bugs: 0, features: 0, feedback: 0, questions: 0 },
        recentlyResolved: 0,
        autoDetected: 0
      },
      fallback: true,
      error: error.message,
      realTimeMetrics: {
        timestamp: new Date().toISOString(),
        autoDetectionEnabled: process.env.AUTO_ISSUE_CREATION === 'true',
        totalProcessedFeedback: 0,
        activeErrors: 0
      }
    });
  }
});

// Helper functions for enhanced stats
async function getTotalProcessedFeedback() {
  try {
    // Query feedback processing logs or database
    return 0; // Placeholder
  } catch (error) {
    return 0;
  }
}

async function getActiveErrorCount() {
  try {
    const autoIssueDetector = require('../services/auto_issue_detector');
    const stats = autoIssueDetector.getStats();
    return stats.errorCacheSize || 0;
  } catch (error) {
    return 0;
  }
}

// Enable/disable auto-close
router.post('/auto-close/toggle', authenticateUser, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    gitHubIssuesService.setAutoCloseEnabled(enabled);
    
    res.json({ 
      success: true, 
      message: `Auto-close ${enabled ? 'ჩართული' : 'გამორთული'}` 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GitHub webhook endpoint for real-time sync
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // Verify webhook signature
    if (secret && signature) {
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const eventType = req.headers['x-github-event'];
    const data = req.body;

    console.log(`🔔 GitHub webhook received: ${eventType}`);

    // Handle different webhook events
    switch (eventType) {
      case 'issues':
        await handleIssueEvent(data);
        break;
      case 'issue_comment':
        await handleIssueCommentEvent(data);
        break;
      case 'push':
        await handlePushEvent(data);
        break;
      default:
        console.log(`📝 Unhandled GitHub event: ${eventType}`);
    }

    res.json({ success: true, event: eventType });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook event handlers
async function handleIssueEvent(data) {
  try {
    const { action, issue } = data;
    console.log(`📝 Issue ${action}: #${issue.number} - ${issue.title}`);
    
    if (action === 'closed' && issue.labels.some(l => l.name === 'auto-detected')) {
      // Update auto-issue detector cache
      const autoIssueDetector = require('../services/auto_issue_detector');
      // Remove from error cache if it was auto-detected
      console.log(`✅ Auto-detected issue #${issue.number} closed via GitHub`);
    }
  } catch (error) {
    console.error('Issue event handling error:', error);
  }
}

async function handleIssueCommentEvent(data) {
  try {
    const { action, issue, comment } = data;
    console.log(`💬 Comment ${action} on issue #${issue.number}`);
    
    // Could be used for AI assistant interaction
    if (comment.body.includes('@gurulo-ai') || comment.body.includes('@bakhmaro')) {
      console.log('🤖 AI mention detected in issue comment');
      // Implement AI response logic here
    }
  } catch (error) {
    console.error('Issue comment event handling error:', error);
  }
}

async function handlePushEvent(data) {
  try {
    const { commits, ref } = data;
    console.log(`📤 Push to ${ref}: ${commits.length} commits`);
    
    // Check commit messages for issue fixes
    commits.forEach(commit => {
      const message = commit.message.toLowerCase();
      const fixMatches = message.match(/(fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#?(\d+)/gi);
      
      if (fixMatches) {
        console.log(`🔧 Commit ${commit.id.substring(0, 8)} mentions issue fixes: ${fixMatches.join(', ')}`);
        // Auto-close related issues could be implemented here
      }
    });
  } catch (error) {
    console.error('Push event handling error:', error);
  }
}

module.exports = router;

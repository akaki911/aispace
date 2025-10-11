// AI User Feedback to GitHub Issues Integration
const express = require('express');
const router = express.Router();
const autoIssueDetector = require('../services/auto_issue_detector');
const { requireAssistantAuth } = require('../middleware/authz');

// Use requireAssistantAuth as authenticateUser
const authenticateUser = requireAssistantAuth;

// Submit user feedback and auto-create GitHub issue
router.post('/submit', authenticateUser, async (req, res) => {
  try {
    const { type, title, description, priority, component, metadata } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title და description აუცილებელია'
      });
    }

    const feedbackData = {
      type: type || 'feedback',
      title,
      content: description, // Use 'content' for consistency with detector
      priority: priority || 'medium',
      component: component || 'general',
      userId: req.user?.id || 'anonymous',
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: new Date().toISOString(),
        source: 'user-feedback-form',
        ...metadata
      }
    };

    // Process through auto-issue detector
    const result = await autoIssueDetector.processFeedback(feedbackData);

    if (result.success) {
      console.log(`💬 User feedback auto-converted to GitHub issue #${result.issueNumber}`);

      res.json({
        success: true,
        message: 'Feedback წარმატებით გადაიგზავნა და GitHub Issue-ად გარდაიქმნა',
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl,
        type: result.type,
        priority: result.priority
      });
    } else {
      // Fallback - store locally even if GitHub fails
      await storeLocalFeedback(feedbackData);

      res.json({
        success: true,
        message: 'Feedback მიღებულია (GitHub ხელმიუწვდომელი)',
        stored: 'locally',
        reason: result.reason || result.error
      });
    }

  } catch (error) {
    console.error('❌ User feedback submission error:', error);

    // Always try to store feedback locally as fallback
    try {
      await storeLocalFeedback(req.body);
    } catch (storeError) {
      console.error('❌ Local feedback storage failed:', storeError);
    }

    res.status(500).json({
      success: false,
      error: 'Feedback-ის გაგზავნის შეცდომა',
      details: error.message
    });
  }
});

// Get feedback statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const detectorStats = autoIssueDetector.getStats();
    const localStats = await getLocalFeedbackStats();

    res.json({
      success: true,
      stats: {
        autoDetection: detectorStats,
        localFeedback: localStats,
        integration: {
          enabled: autoIssueDetector.isEnabled,
          githubConnected: autoIssueDetector.githubIssuesService?.isInitialized || false
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Toggle auto-processing
router.post('/toggle', authenticateUser, async (req, res) => {
  try {
    const { enabled } = req.body;
    autoIssueDetector.setEnabled(enabled);

    res.json({
      success: true,
      message: `Auto-processing ${enabled ? 'ჩართული' : 'გამორთული'}`,
      enabled: autoIssueDetector.isEnabled
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper functions
async function storeLocalFeedback(feedbackData) {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    const feedbackDir = path.join(__dirname, '../feedback_data');
    await fs.mkdir(feedbackDir, { recursive: true });

    const filename = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
    const filepath = path.join(feedbackDir, filename);

    await fs.writeFile(filepath, JSON.stringify({
      ...feedbackData,
      storedAt: new Date().toISOString(),
      id: filename.replace('.json', '')
    }, null, 2));

    console.log(`📝 Feedback stored locally: ${filename}`);
    return filename;
  } catch (error) {
    console.error('❌ Local feedback storage error:', error);
    throw error;
  }
}

async function getLocalFeedbackStats() {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    const feedbackDir = path.join(__dirname, '../feedback_data');

    try {
      const files = await fs.readdir(feedbackDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      return {
        totalLocal: jsonFiles.length,
        lastStored: jsonFiles.length > 0 ? Math.max(...jsonFiles.map(f => {
          const match = f.match(/feedback-(\d+)-/);
          return match ? parseInt(match[1]) : 0;
        })) : null
      };
    } catch {
      return { totalLocal: 0, lastStored: null };
    }
  } catch (error) {
    return { totalLocal: 0, lastStored: null, error: error.message };
  }
}

// Convert user feedback to GitHub issue
router.post('/submit', authenticateUser, async (req, res) => {
  try {
    const { type, title, description, priority, component, rating } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title და description აუცილებელია'
      });
    }

    const feedbackData = {
      content: description,
      title: title,
      component: component || 'general',
      priority: priority || 'medium',
      userId: req.user?.id || 'anonymous',
      type: type || 'feedback',
      rating: rating,
      timestamp: new Date().toISOString()
    };

    console.log(`💬 [User Feedback] Processing feedback from user ${feedbackData.userId}: ${title}`);

    // Process feedback and create GitHub issue automatically
    const result = await autoIssueDetector.processFeedback(feedbackData);

    if (result.success) {
      console.log(`✅ [User Feedback] Auto-created GitHub issue #${result.issueNumber}`);

      res.json({
        success: true,
        message: 'თქვენი feedback წარმატებით გაიგზავნა და GitHub issue შეიქმნა',
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl,
        type: result.type,
        priority: result.priority
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Feedback processing ვერ მოხერხდა'
      });
    }

  } catch (error) {
    console.error('❌ [User Feedback] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'User feedback processing ვერ მოხერხდა'
    });
  }
});

// Get feedback statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const stats = autoIssueDetector.getStats();

    res.json({
      success: true,
      stats: {
        ...stats,
        feedbackProcessingEnabled: stats.enabled,
        totalProcessedFeedback: stats.trackedIssues
      }
    });
  } catch (error) {
    console.error('❌ [Feedback Stats] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Statistics retrieval ვერ მოხერხდა'
    });
  }
});

// Enable/disable automatic feedback processing
router.post('/auto-processing/toggle', authenticateUser, async (req, res) => {
  try {
    const { enabled } = req.body;

    autoIssueDetector.setEnabled(enabled);

    res.json({
      success: true,
      message: `Automatic feedback processing ${enabled ? 'ჩართული' : 'გამორთული'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
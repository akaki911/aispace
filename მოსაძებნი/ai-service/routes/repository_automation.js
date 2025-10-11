
const express = require('express');
const router = express.Router();
const { requireAssistantAuth } = require('../middleware/authz');
const repositoryAutomationService = require('../services/repository_automation_service');

// Run full repository automation
router.post('/run-full', requireAssistantAuth, async (req, res) => {
  try {
    const options = req.body || {};
    const result = await repositoryAutomationService.runFullAutomation(options);
    
    res.json({
      success: result.success,
      message: result.success ? 'Repository automation completed successfully' : 'Repository automation completed with errors',
      ...result
    });
  } catch (error) {
    console.error('Repository automation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manage collaborators automatically
router.post('/collaborators/auto-manage', requireAssistantAuth, async (req, res) => {
  try {
    const result = await repositoryAutomationService.autoManageCollaborators();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure webhooks automatically
router.post('/webhooks/auto-configure', requireAssistantAuth, async (req, res) => {
  try {
    const result = await repositoryAutomationService.autoConfigureWebhooks();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update repository metadata
router.post('/metadata/auto-update', requireAssistantAuth, async (req, res) => {
  try {
    const result = await repositoryAutomationService.autoUpdateRepositoryMetadata();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Setup branch protection
router.post('/branches/auto-protect', requireAssistantAuth, async (req, res) => {
  try {
    const result = await repositoryAutomationService.autoSetupBranchProtection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate release notes
router.post('/release/generate-notes', requireAssistantAuth, async (req, res) => {
  try {
    const deploymentInfo = req.body.deploymentInfo || {};
    const result = await repositoryAutomationService.generateReleaseNotes(deploymentInfo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get automation status
router.get('/status', requireAssistantAuth, async (req, res) => {
  try {
    const validation = await repositoryAutomationService.validateConfiguration();
    
    res.json({
      success: true,
      configuration: validation,
      capabilities: {
        collaboratorManagement: true,
        webhookConfiguration: true,
        metadataManagement: true,
        branchProtection: true,
        releaseNotesGeneration: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoint for real-time sync
router.post('/webhook/trigger-automation', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const eventType = req.headers['x-github-event'];
    const payload = req.body;

    // Verify webhook signature for security
    if (process.env.GITHUB_WEBHOOK_SECRET && signature) {
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn('🚫 Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    console.log(`🔔 GitHub webhook received: ${eventType}`);

    // Trigger specific automation based on event type
    let automationResult = null;
    const automationPromises = [];
    
    switch (eventType) {
      case 'push':
        if (payload.ref === 'refs/heads/main') {
          // Main branch push - trigger release notes and metadata update
          automationPromises.push(
            repositoryAutomationService.generateReleaseNotes({
              environment: 'production',
              buildStatus: 'success',
              healthCheck: 'passed',
              commitSha: payload.after,
              pusher: payload.pusher?.name || 'unknown',
              commits: payload.commits || []
            })
          );
          automationPromises.push(
            repositoryAutomationService.autoUpdateRepositoryMetadata()
          );
        }
        break;
        
      case 'member':
      case 'membership':
        // Trigger collaborator management when members are added/removed
        automationPromises.push(
          repositoryAutomationService.autoManageCollaborators()
        );
        break;
        
      case 'repository':
        // Trigger metadata update when repository settings change
        automationPromises.push(
          repositoryAutomationService.autoUpdateRepositoryMetadata()
        );
        break;

      case 'create':
        if (payload.ref_type === 'branch') {
          // New branch created - potentially set up branch protection
          automationPromises.push(
            repositoryAutomationService.autoSetupBranchProtection()
          );
        }
        break;

      case 'release':
        if (payload.action === 'published') {
          // Release published - trigger full automation sync
          automationPromises.push(
            repositoryAutomationService.runFullAutomation({
              releaseNotes: false, // Already done
              metadata: true,
              collaborators: true,
              webhooks: true,
              branchProtection: true
            })
          );
        }
        break;

      case 'issues':
        // Issue events - could trigger issue management automation
        console.log(`📝 Issue ${payload.action}: #${payload.issue?.number}`);
        break;

      default:
        console.log(`📝 Unhandled GitHub event: ${eventType}`);
    }

    // Execute automations in parallel
    if (automationPromises.length > 0) {
      try {
        const results = await Promise.allSettled(automationPromises);
        automationResult = {
          total: results.length,
          successful: results.filter(r => r.status === 'fulfilled').length,
          failed: results.filter(r => r.status === 'rejected').length,
          results: results.map((r, i) => ({
            index: i,
            status: r.status,
            ...(r.status === 'fulfilled' ? { result: r.value } : { error: r.reason?.message })
          }))
        };
      } catch (error) {
        automationResult = { error: error.message };
      }
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      eventType,
      automationTriggered: automationResult !== null,
      automationResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook automation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint for webhook
router.get('/webhook/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint healthy',
    timestamp: new Date().toISOString(),
    configuration: {
      secretConfigured: !!process.env.GITHUB_WEBHOOK_SECRET,
      automationEnabled: true
    }
  });
});

module.exports = router;
// Get repository automation status
router.get('/status', requireAssistantAuth, async (req, res) => {
  try {
    const validation = await repositoryAutomationService.validateConfiguration();
    
    res.json({
      success: true,
      configuration: validation,
      capabilities: {
        collaboratorManagement: true,
        webhookConfiguration: true,
        metadataManagement: true,
        branchProtection: true,
        releaseNotesGeneration: true,
        fullAutomation: true
      },
      status: {
        githubToken: !!process.env.GITHUB_TOKEN,
        webhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
        repoConfigured: !!(process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

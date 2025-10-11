
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireEnv } = require('../lib/requireEnv');

// Simulate webhook data for now
const mockWebhooks = [
  {
    id: 1,
    name: 'CI/CD Webhook',
    config: {
      url: 'https://api.github.com/repos/bakhmaro/workspace/hooks',
      content_type: 'json',
      secret: '***configured***'
    },
    events: ['push', 'pull_request', 'issues'],
    active: true,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    name: 'Issue Automation',
    config: {
      url: 'https://bakhmaro-ai.replit.dev/api/github/webhook',
      content_type: 'json',
      secret: '***configured***'
    },
    events: ['issues', 'issue_comment'],
    active: true,
    created_at: '2024-01-10T14:20:00Z',
    updated_at: '2024-01-10T14:20:00Z'
  }
];

// GET /api/ai/github/webhooks - List all webhooks
router.get('/webhooks', (req, res) => {
  try {
    console.log('📋 Loading GitHub webhooks...');
    
    res.json({
      success: true,
      webhooks: mockWebhooks,
      total: mockWebhooks.length
    });
  } catch (error) {
    console.error('❌ Failed to load webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load webhooks',
      details: error.message
    });
  }
});

// DELETE /api/ai/github/webhooks/:id - Delete webhook
router.delete('/webhooks/:id', (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    console.log(`🗑️ Deleting webhook ${webhookId}...`);
    
    const webhookIndex = mockWebhooks.findIndex(w => w.id === webhookId);
    
    if (webhookIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    mockWebhooks.splice(webhookIndex, 1);
    
    res.json({
      success: true,
      message: `Webhook ${webhookId} deleted successfully`
    });
  } catch (error) {
    console.error('❌ Failed to delete webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete webhook',
      details: error.message
    });
  }
});

// POST /api/ai/github/webhooks/:id/rotate-secret - Rotate webhook secret
router.post('/webhooks/:id/rotate-secret', (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    console.log(`🔄 Rotating secret for webhook ${webhookId}...`);
    
    const webhook = mockWebhooks.find(w => w.id === webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    // Generate new secret
    const newSecret = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    webhook.config.secret = '***configured***';
    webhook.updated_at = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Webhook secret rotated successfully',
      newSecret: newSecret
    });
  } catch (error) {
    console.error('❌ Failed to rotate webhook secret:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate webhook secret',
      details: error.message
    });
  }
});

// PATCH /api/ai/github/webhooks/:id - Update webhook
router.patch('/webhooks/:id', (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    const { active } = req.body;
    
    console.log(`⚙️ Updating webhook ${webhookId}, active: ${active}...`);
    
    const webhook = mockWebhooks.find(w => w.id === webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    if (typeof active === 'boolean') {
      webhook.active = active;
      webhook.updated_at = new Date().toISOString();
    }
    
    res.json({
      success: true,
      message: 'Webhook updated successfully',
      webhook: webhook
    });
  } catch (error) {
    console.error('❌ Failed to update webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update webhook',
      details: error.message
    });
  }
});

// HMAC verification middleware for GitHub webhooks
function verifyGitHubWebhook(req, res, next) {
  try {
    const cfg = requireEnv();
    const webhookSecret = cfg.GITHUB_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('⚠️ [Webhook HMAC] GITHUB_WEBHOOK_SECRET not configured - skipping verification');
      return next();
    }
    
    const signature = req.headers['x-hub-signature-256'];
    
    if (!signature) {
      console.error('❌ [Webhook HMAC] Missing X-Hub-Signature-256 header');
      return res.status(401).json({
        success: false,
        error: 'Missing signature header',
        code: 'MISSING_SIGNATURE'
      });
    }
    
    // Extract signature without 'sha256=' prefix
    const githubSignature = signature.replace('sha256=', '');
    
    // Get raw body for HMAC verification
    const rawBody = req.rawBody || req.body;
    if (!rawBody) {
      console.error('❌ [Webhook HMAC] Missing request body for verification');
      return res.status(400).json({
        success: false,
        error: 'Missing request body',
        code: 'MISSING_BODY'
      });
    }
    
    // Calculate expected HMAC
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');
    
    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(githubSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error('❌ [Webhook HMAC] Signature length mismatch');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'SIGNATURE_MISMATCH'
      });
    }
    
    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    
    if (!isValid) {
      console.error('❌ [Webhook HMAC] Signature verification failed');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'SIGNATURE_INVALID'
      });
    }
    
    console.log('✅ [Webhook HMAC] Signature verified successfully');
    next();
    
  } catch (error) {
    console.error('❌ [Webhook HMAC] Verification error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Signature verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
}

// POST /webhook - GitHub webhook endpoint with HMAC verification
router.post('/webhook', verifyGitHubWebhook, express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const delivery = req.headers['x-github-delivery'];
    
    console.log(`🔔 [GitHub Webhook] Received ${event} event (delivery: ${delivery})`);
    
    // Parse webhook payload
    const payload = JSON.parse(req.body.toString());
    
    // Process different webhook events
    switch (event) {
      case 'push':
        console.log(`📤 [Webhook] Push to ${payload.ref} by ${payload.pusher?.name}`);
        break;
        
      case 'pull_request':
        console.log(`🔀 [Webhook] PR ${payload.action}: #${payload.number} - ${payload.pull_request?.title}`);
        break;
        
      case 'issues':
        console.log(`🐛 [Webhook] Issue ${payload.action}: #${payload.issue?.number} - ${payload.issue?.title}`);
        break;
        
      case 'issue_comment':
        console.log(`💬 [Webhook] Comment ${payload.action} on issue #${payload.issue?.number}`);
        break;
        
      default:
        console.log(`📋 [Webhook] Unhandled event: ${event}`);
    }
    
    // Respond to GitHub
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      event,
      delivery
    });
    
  } catch (error) {
    console.error('❌ [Webhook] Processing error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

module.exports = router;

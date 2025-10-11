
const express = require('express');
const router = express.Router();
const { requireSuperAdmin } = require('../middleware/admin_guards');
const NotificationHooksService = require('../services/notificationHooks');

const notificationHooks = new NotificationHooksService();

// Get notification configuration
router.get('/config', requireSuperAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        email: {
          enabled: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',
          recipients: (process.env.NOTIFICATION_EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
        },
        webhooks: {
          enabled: process.env.NOTIFICATION_WEBHOOKS_ENABLED === 'true',
          urls: (process.env.NOTIFICATION_WEBHOOK_URLS || '').split(',').filter(Boolean)
        },
        events: {
          enabled: (process.env.NOTIFICATION_EVENTS || 'proposal_created,applied,smoke_failed,rollback_done').split(','),
          rateLimit: parseInt(process.env.NOTIFICATION_RATE_LIMIT || '100')
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Config error:', error);
    res.status(500).json({
      success: false,
      error: 'კონფიგურაციის ჩატვირთვის შეცდომა'
    });
  }
});

// Test notification sending
router.post('/test', requireSuperAdmin, async (req, res) => {
  try {
    const { eventType = 'proposal_created', proposalId = 'test-proposal' } = req.body;

    const testPayload = {
      proposalId,
      title: 'ტესტური წინადადება',
      summary: 'ეს არის ტესტური შეტყობინება ნოტიფიკაციის სისტემისთვის',
      risk: { level: 'medium', score: 75 },
      files: [{ path: 'test.js', lines: '1-10', rule: 'test-rule', note: 'ტესტური ფაილი' }],
      impact: { perf: 'medium', security: 'low' },
      dependencies: [],
      scope: ['testing'],
      correlationId: `test_${Date.now()}`
    };

    const result = await notificationHooks.notify(eventType, testPayload);

    res.json({
      success: true,
      message: 'ტესტური შეტყობინება გაიგზავნა',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Test error:', error);
    res.status(500).json({
      success: false,
      error: 'ტესტური შეტყობინების გაგზავნის შეცდომა',
      details: error.message
    });
  }
});

// Get dead letter queue
router.get('/dead-letter', requireSuperAdmin, async (req, res) => {
  try {
    const deadLetterQueue = notificationHooks.getDeadLetterQueue();
    
    res.json({
      success: true,
      deadLetterQueue,
      count: deadLetterQueue.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Dead letter error:', error);
    res.status(500).json({
      success: false,
      error: 'Dead letter queue-ის ჩატვირთვის შეცდომა'
    });
  }
});

// Process dead letter queue manually
router.post('/dead-letter/process', requireSuperAdmin, async (req, res) => {
  try {
    await notificationHooks.processDeadLetterQueue();
    
    res.json({
      success: true,
      message: 'Dead letter queue წარმატებით დამუშავდა',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Dead letter processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Dead letter queue-ის დამუშავების შეცდომა'
    });
  }
});

// Webhook signature verification helper endpoint
router.post('/verify-webhook', (req, res) => {
  try {
    const { payload, signature, secret } = req.body;
    
    if (!payload || !signature || !secret) {
      return res.status(400).json({
        success: false,
        error: 'payload, signature და secret სავალდებულოა'
      });
    }

    const isValid = NotificationHooksService.verifyHMACSignature(payload, signature, secret);
    
    res.json({
      success: true,
      valid: isValid,
      message: isValid ? 'ხელმოწერა ვალიდურია' : 'ხელმოწერა არავალიდურია'
    });

  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'ხელმოწერის შემოწმების შეცდომა'
    });
  }
});

module.exports = router;

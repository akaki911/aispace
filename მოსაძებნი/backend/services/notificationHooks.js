
const crypto = require('crypto');
const nodemailer = require('nodemailer');

class NotificationHooksService {
  constructor() {
    this.config = {
      email: {
        enabled: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        },
        recipients: (process.env.NOTIFICATION_EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
      },
      webhooks: {
        enabled: process.env.NOTIFICATION_WEBHOOKS_ENABLED === 'true',
        urls: (process.env.NOTIFICATION_WEBHOOK_URLS || '').split(',').filter(Boolean),
        secret: process.env.NOTIFICATION_WEBHOOK_SECRET || 'dev-secret-key',
        timeout: parseInt(process.env.NOTIFICATION_WEBHOOK_TIMEOUT || '10000')
      },
      events: {
        enabled: (process.env.NOTIFICATION_EVENTS || 'proposal_created,applied,smoke_failed,rollback_done').split(','),
        rateLimit: {
          maxPerHour: parseInt(process.env.NOTIFICATION_RATE_LIMIT || '100'),
          window: 60 * 60 * 1000 // 1 hour
        }
      },
      retry: {
        maxAttempts: parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS || '3'),
        backoffMs: parseInt(process.env.NOTIFICATION_RETRY_BACKOFF || '5000')
      }
    };

    this.rateLimitStore = new Map();
    this.deadLetterQueue = [];
    this.sentNotifications = new Set(); // Duplicate prevention
    
    // Initialize email transport
    if (this.config.email.enabled && this.config.email.smtp.auth.user) {
      this.emailTransport = nodemailer.createTransporter(this.config.email.smtp);
    }

    console.log('🔔 [NOTIFICATIONS] Service initialized:', {
      emailEnabled: this.config.email.enabled,
      webhooksEnabled: this.config.webhooks.enabled,
      events: this.config.events.enabled
    });
  }

  // Main notification dispatcher
  async notify(eventType, payload) {
    try {
      console.log(`🔔 [NOTIFICATIONS] Event: ${eventType}`, { proposalId: payload.proposalId });

      // Check if event is enabled
      if (!this.config.events.enabled.includes(eventType)) {
        console.log(`🔕 [NOTIFICATIONS] Event ${eventType} disabled in config`);
        return { success: true, reason: 'disabled' };
      }

      // Rate limiting check
      if (!this.checkRateLimit(eventType)) {
        console.warn(`⚠️ [NOTIFICATIONS] Rate limit exceeded for ${eventType}`);
        return { success: false, reason: 'rate_limited' };
      }

      // Duplicate prevention (within 60 seconds)
      const notificationKey = `${eventType}-${payload.proposalId}-${Date.now().toString().slice(0, -4)}`;
      if (this.sentNotifications.has(notificationKey)) {
        console.log(`🔕 [NOTIFICATIONS] Duplicate notification prevented: ${notificationKey}`);
        return { success: true, reason: 'duplicate_prevented' };
      }

      // Create standardized notification payload
      const notification = this.createNotificationPayload(eventType, payload);
      
      // Send notifications
      const results = await Promise.allSettled([
        this.sendEmailNotification(notification),
        this.sendWebhookNotifications(notification)
      ]);

      // Mark as sent
      this.sentNotifications.add(notificationKey);
      
      // Clean up old entries (older than 5 minutes)
      setTimeout(() => {
        this.sentNotifications.delete(notificationKey);
      }, 5 * 60 * 1000);

      const emailResult = results[0];
      const webhookResult = results[1];

      console.log(`✅ [NOTIFICATIONS] Sent ${eventType}:`, {
        email: emailResult.status === 'fulfilled' ? 'success' : 'failed',
        webhook: webhookResult.status === 'fulfilled' ? 'success' : 'failed'
      });

      return {
        success: true,
        results: {
          email: emailResult.status === 'fulfilled' ? emailResult.value : { error: emailResult.reason },
          webhook: webhookResult.status === 'fulfilled' ? webhookResult.value : { error: webhookResult.reason }
        }
      };

    } catch (error) {
      console.error(`❌ [NOTIFICATIONS] Error sending ${eventType}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Create standardized Georgian notification payload
  createNotificationPayload(eventType, payload) {
    const eventTitles = {
      proposal_created: '🆕 ახალი AI წინადადება შეიქმნა',
      applied: '✅ წინადადება გამოყენებულია',
      smoke_failed: '💥 Smoke ტესტები ვერ ჩაიარა',
      rollback_done: '🔄 Rollback წარმატებით განხორციელდა'
    };

    const riskLabels = {
      low: 'დაბალი',
      medium: 'საშუალო', 
      high: 'მაღალი'
    };

    const impactLabels = {
      perf: 'პერფორმანსი',
      readability: 'წაკითხვადობა',
      security: 'უსაფრთხოება',
      risk: 'რისკი'
    };

    return {
      id: payload.proposalId,
      event: eventType,
      title: eventTitles[eventType] || eventType,
      timestamp: new Date().toISOString(),
      proposal: {
        id: payload.proposalId,
        title: payload.title || 'უსახელო წინადადება',
        summary: payload.summary || '',
        risk: {
          level: payload.risk?.level || 'medium',
          score: payload.risk?.score || 50,
          label: riskLabels[payload.risk?.level] || 'საშუალო'
        },
        files: (payload.files || []).map(f => ({
          path: f.path,
          lines: f.lines,
          rule: f.rule,
          note: f.note
        })),
        impact: Object.entries(payload.impact || {}).map(([key, value]) => ({
          category: impactLabels[key] || key,
          level: value,
          georgian: value === 'high' ? 'მაღალი' : 
                   value === 'medium' ? 'საშუალო' : 'დაბალი'
        })),
        dependencies: payload.dependencies || [],
        scope: payload.scope || []
      },
      correlationId: payload.correlationId || `cid_${Date.now()}`,
      actions: this.getNotificationActions(eventType, payload.proposalId),
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        service: 'AutoImprove',
        version: '1.0.0'
      }
    };
  }

  // Get action buttons for different event types
  getNotificationActions(eventType, proposalId) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    
    switch (eventType) {
      case 'proposal_created':
        return [
          {
            type: 'primary',
            label: '👀 ნახვა',
            url: `${baseUrl}/admin/ai/auto-improve?proposal=${proposalId}`
          },
          {
            type: 'success', 
            label: '✅ დამტკიცება',
            url: `${baseUrl}/admin/ai/auto-improve?action=approve&proposal=${proposalId}`
          }
        ];
      
      case 'applied':
        return [
          {
            type: 'primary',
            label: '🔍 შემოწმება',
            url: `${baseUrl}/admin/ai/auto-improve?proposal=${proposalId}&tab=verification`
          }
        ];
      
      case 'smoke_failed':
        return [
          {
            type: 'warning',
            label: '🔄 ხელახლა ცდა',
            url: `${baseUrl}/admin/ai/auto-improve?action=retry&proposal=${proposalId}`
          },
          {
            type: 'danger',
            label: '⏪ Rollback',
            url: `${baseUrl}/admin/ai/auto-improve?action=rollback&proposal=${proposalId}`
          }
        ];
      
      case 'rollback_done':
        return [
          {
            type: 'primary',
            label: '📊 სტატუსი',
            url: `${baseUrl}/admin/ai/auto-improve?proposal=${proposalId}`
          }
        ];
      
      default:
        return [];
    }
  }

  // Send email notification
  async sendEmailNotification(notification) {
    if (!this.config.email.enabled || !this.emailTransport) {
      return { success: true, reason: 'email_disabled' };
    }

    const html = this.generateEmailHTML(notification);
    
    const mailOptions = {
      from: this.config.email.smtp.auth.user,
      to: this.config.email.recipients,
      subject: `${notification.title} - ${notification.proposal.title}`,
      html: html
    };

    try {
      const result = await this.emailTransport.sendMail(mailOptions);
      console.log(`📧 [EMAIL] Sent notification for ${notification.event}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`❌ [EMAIL] Failed to send ${notification.event}:`, error);
      this.addToDeadLetter('email', notification, error);
      throw error;
    }
  }

  // Generate email HTML template
  generateEmailHTML(notification) {
    const { proposal, actions } = notification;
    
    return `
      <div style="font-family: 'Noto Sans Georgian', 'Inter', 'Manrope', sans-serif; letter-spacing: 0.015em; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a1a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${notification.title}</h1>
          <p style="margin: 10px 0 0; opacity: 0.8;">${new Date(notification.timestamp).toLocaleString('ka-GE')}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #007bff;">
          <h2 style="margin: 0 0 10px; color: #333;">${proposal.title}</h2>
          <p style="color: #666; margin: 0;">${proposal.summary}</p>
        </div>

        <div style="padding: 20px; background: white;">
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 10px;">რისკის დონე</h3>
            <span style="padding: 4px 12px; border-radius: 4px; font-weight: bold; 
                         background: ${proposal.risk.level === 'high' ? '#dc3545' : 
                                      proposal.risk.level === 'medium' ? '#ffc107' : '#28a745'};
                         color: white;">
              ${proposal.risk.label} (${proposal.risk.score} ქულა)
            </span>
          </div>

          ${proposal.files.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 10px;">ფაილები (${proposal.files.length})</h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${proposal.files.map(f => `<li style="margin: 5px 0;"><code>${f.path}</code> (${f.lines})</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          ${proposal.impact.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 10px;">ზეგავლენა</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              ${proposal.impact.map(i => `
                <span style="padding: 4px 8px; border-radius: 4px; background: #e9ecef; font-size: 12px;">
                  ${i.category}: ${i.georgian}
                </span>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${actions.length > 0 ? `
          <div style="margin-top: 30px; text-align: center;">
            <h3 style="color: #333; margin: 0 0 15px;">მოქმედებები</h3>
            ${actions.map(action => `
              <a href="${action.url}" 
                 style="display: inline-block; margin: 5px; padding: 10px 20px; 
                        text-decoration: none; border-radius: 4px; font-weight: bold;
                        background: ${action.type === 'primary' ? '#007bff' : 
                                     action.type === 'success' ? '#28a745' :
                                     action.type === 'warning' ? '#ffc107' : '#dc3545'};
                        color: white;">
                ${action.label}
              </a>
            `).join('')}
          </div>
          ` : ''}
        </div>

        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; color: #666; font-size: 12px;">
            Correlation ID: ${notification.correlationId} | 
            AutoImprove System v${notification.metadata.version}
          </p>
        </div>
      </div>
    `;
  }

  // Send webhook notifications with HMAC signature
  async sendWebhookNotifications(notification) {
    if (!this.config.webhooks.enabled || this.config.webhooks.urls.length === 0) {
      return { success: true, reason: 'webhooks_disabled' };
    }

    const payload = JSON.stringify(notification);
    const signature = this.generateHMACSignature(payload);
    
    const webhookPromises = this.config.webhooks.urls.map(url => 
      this.sendSingleWebhook(url, payload, signature)
    );

    try {
      const results = await Promise.allSettled(webhookPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`🪝 [WEBHOOK] Sent to ${successful}/${this.config.webhooks.urls.length} endpoints`);
      
      return {
        success: successful > 0,
        results: results.map((r, i) => ({
          url: this.config.webhooks.urls[i],
          success: r.status === 'fulfilled',
          error: r.status === 'rejected' ? r.reason.message : null
        }))
      };
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send notifications:', error);
      throw error;
    }
  }

  // Send single webhook with retry logic
  async sendSingleWebhook(url, payload, signature, attempt = 1) {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AutoImprove-Signature': signature,
          'X-AutoImprove-Event': JSON.parse(payload).event,
          'User-Agent': 'AutoImprove-Webhooks/1.0'
        },
        body: payload,
        timeout: this.config.webhooks.timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ [WEBHOOK] Sent to ${url} (attempt ${attempt})`);
      return { success: true, url, attempt };

    } catch (error) {
      console.error(`❌ [WEBHOOK] Failed to send to ${url} (attempt ${attempt}):`, error.message);
      
      if (attempt < this.config.retry.maxAttempts) {
        console.log(`🔄 [WEBHOOK] Retrying ${url} in ${this.config.retry.backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.config.retry.backoffMs * attempt));
        return this.sendSingleWebhook(url, payload, signature, attempt + 1);
      } else {
        this.addToDeadLetter('webhook', { url, payload: JSON.parse(payload) }, error);
        throw error;
      }
    }
  }

  // Generate HMAC signature for webhook security
  generateHMACSignature(payload) {
    return crypto
      .createHmac('sha256', this.config.webhooks.secret)
      .update(payload)
      .digest('hex');
  }

  // Verify HMAC signature (for webhook receivers)
  static verifyHMACSignature(payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Rate limiting check
  checkRateLimit(eventType) {
    const now = Date.now();
    const windowStart = now - this.config.events.rateLimit.window;
    
    if (!this.rateLimitStore.has(eventType)) {
      this.rateLimitStore.set(eventType, []);
    }
    
    const events = this.rateLimitStore.get(eventType);
    
    // Remove old events outside the window
    const recentEvents = events.filter(timestamp => timestamp > windowStart);
    
    if (recentEvents.length >= this.config.events.rateLimit.maxPerHour) {
      return false;
    }
    
    recentEvents.push(now);
    this.rateLimitStore.set(eventType, recentEvents);
    
    return true;
  }

  // Add to dead letter queue for failed notifications
  addToDeadLetter(type, notification, error) {
    this.deadLetterQueue.push({
      type,
      notification,
      error: error.message,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });

    // Keep only last 100 failed notifications
    if (this.deadLetterQueue.length > 100) {
      this.deadLetterQueue.shift();
    }

    console.log(`💀 [DEAD-LETTER] Added ${type} notification to queue`);
  }

  // Get dead letter queue for monitoring
  getDeadLetterQueue() {
    return this.deadLetterQueue;
  }

  // Process dead letter queue (for background job)
  async processDeadLetterQueue() {
    const retryableItems = this.deadLetterQueue.filter(item => item.retryCount < 3);
    
    for (const item of retryableItems) {
      try {
        if (item.type === 'email') {
          await this.sendEmailNotification(item.notification);
        } else if (item.type === 'webhook') {
          await this.sendWebhookNotifications(item.notification);
        }
        
        // Remove from dead letter queue on success
        const index = this.deadLetterQueue.indexOf(item);
        this.deadLetterQueue.splice(index, 1);
        
      } catch (error) {
        item.retryCount++;
        item.lastRetry = new Date().toISOString();
        console.log(`🔄 [DEAD-LETTER] Retry failed for ${item.type}, count: ${item.retryCount}`);
      }
    }
  }
}

module.exports = NotificationHooksService;

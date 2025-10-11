const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

const buildIds = () => ({
  correlationId: crypto.randomUUID(),
  traceId: crypto.randomUUID(),
  spanId: crypto.randomUUID().slice(0, 16),
});

const logStructured = (level, message, metadata = {}) => {
  const payload = {
    service: 'backend',
    scope: 'audit-service',
    level,
    message,
    ...buildIds(),
    ...metadata,
  };

  if (level === 'error' || level === 'fatal') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
};

class AuditService {
  constructor() {
    try {
      this.db = getFirestore();
    } catch (error) {
      console.warn('⚠️ [AUDIT] Firestore unavailable for audit logging:', error.message);
      this.db = null;
    }
    this.HASH_SECRET = process.env.AUDIT_HASH_SECRET || 'bakhmaro-audit-salt-2024';
  }

  hashIP = (ip) => {
    if (!ip) return 'unknown';
    const cleanIP = ip.replace(/:\d+$/, '');
    return crypto.createHash('sha256').update(this.HASH_SECRET + cleanIP).digest('hex').substring(0, 16);
  };

  extractDeviceInfo = (req) => {
    const userAgent = req?.get?.('User-Agent') || '';
    const acceptLanguage = req?.get?.('Accept-Language') || '';
    const fingerprint = crypto.createHash('md5').update(userAgent + acceptLanguage).digest('hex').substring(0, 8);

    return {
      userAgent: userAgent.substring(0, 200),
      fingerprint,
      language: acceptLanguage.split(',')[0] || 'unknown',
    };
  };

  getClientIP = (req) => {
    if (!req) return 'unknown';
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const forwardedIP = forwarded.split(',')[0].trim();
      if (forwardedIP) {
        return forwardedIP;
      }
    }
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.connection?.socket?.remoteAddress ||
      'unknown'
    );
  };

  logEvent = async (eventType, payload = {}) => {
    try {
      const entry = {
        eventType,
        payload,
        createdAt: FieldValue.serverTimestamp(),
        insertedAt: new Date().toISOString(),
      };
      const docRef = await this.db.collection('audit_events').add(entry);
      logStructured('info', 'audit event recorded', { eventType });
      return docRef.id;
    } catch (error) {
      logStructured('warn', 'audit event logging failed', { eventType, error: error.message });
      return null;
    }
  };

  logSecurityEvent = async ({
    action,
    userId = null,
    role = null,
    deviceId = null,
    ipAddress = null,
    userAgent = null,
    success = true,
    details = {},
    req = null,
  }) => {
    try {
      const requestIp = req ? this.getClientIP(req) : ipAddress;
      const resolvedUserAgent = req?.get?.('User-Agent') || userAgent || '';
      const auditEntry = {
        timestamp: FieldValue.serverTimestamp(),
        action,
        userId,
        role,
        deviceId,
        ipHash: this.hashIP(requestIp),
        success,
        userAgentHash: resolvedUserAgent
          ? crypto.createHash('md5').update(resolvedUserAgent).digest('hex').substring(0, 8)
          : null,
        details: {
          ...details,
          originalIP: requestIp ? `${requestIp}`.substring(0, 7) + 'xxx' : null,
        },
        createdAt: new Date().toISOString(),
      };

      const docRef = await this.db.collection('audit_logs').add(auditEntry);
      logStructured('info', 'security event logged', { action, userId, role, success });
      return docRef.id;
    } catch (error) {
      logStructured('error', 'failed to log security event', { action, error: error.message });
      return null;
    }
  };

  logLoginSuccess = async (userId, role, deviceId, req, authMethod = 'unknown') =>
    this.logSecurityEvent({
      action: 'LOGIN_SUCCESS',
      userId,
      role,
      deviceId,
      req,
      success: true,
      details: {
        authMethod,
        sessionCreated: true,
      },
    });

  logLoginFail = async (attemptedUserId, reason, req, authMethod = 'unknown') =>
    this.logSecurityEvent({
      action: 'LOGIN_FAIL',
      userId: attemptedUserId,
      req,
      success: false,
      details: {
        reason,
        authMethod,
        timestamp: new Date().toISOString(),
      },
    });

  logDeviceTrusted = async (userId, deviceId, req) =>
    this.logSecurityEvent({
      action: 'DEVICE_TRUSTED',
      userId,
      deviceId,
      req,
      success: true,
      details: {
        trustLevel: 'user_granted',
        deviceRegistered: true,
      },
    });

  logPasskeyVerification = async (userId, credentialId, req, success) => {
    try {
      await this.logEvent('PASSKEY_VERIFICATION', {
        userId,
        credentialId: credentialId ? `${credentialId.substring(0, 16)}…` : null,
        success,
        userAgent: req?.get?.('User-Agent')?.substring(0, 100),
        ip: this.getClientIP(req),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logStructured('warn', 'passkey verification log error', { error: error.message });
    }
  };

  logRouteDecision = async (userId, role, target, reason, req) => {
    try {
      await this.logEvent('ROUTE_DECIDED', {
        userId: userId || 'anonymous',
        role: role || 'none',
        target,
        reason,
        userAgent: req?.get?.('User-Agent')?.substring(0, 100),
        ip: this.getClientIP(req),
        sessionId: req?.sessionID?.substring(0, 8) || null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logStructured('warn', 'route decision log error', { error: error.message });
    }
  };

  logSecretsEvent = async ({
    actorId = 'unknown',
    action,
    key = null,
    hasValue = false,
    correlationId = crypto.randomUUID(),
    metadata = {},
  }) => {
    const structuredPayload = {
      channel: 'audit.secrets',
      actorId,
      action,
      key,
      hasValue,
      correlationId,
      metadata,
    };

    logStructured('info', 'audit.secrets event', structuredPayload);

    if (!this.db) {
      return correlationId;
    }

    try {
      await this.db.collection('audit_secrets').add({
        ...structuredPayload,
        recordedAt: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logStructured('warn', 'failed to persist audit.secrets event', {
        error: error.message,
        action,
        key,
      });
    }

    return correlationId;
  };

  logLogout = async (userId, role, req) =>
    this.logSecurityEvent({
      action: 'LOGOUT_SUCCESS',
      userId,
      role,
      req,
      success: true,
      details: {
        sessionDestroyed: true,
      },
    });

  logAdminAccess = async (userId, resource, action, req) =>
    this.logSecurityEvent({
      action: 'ADMIN_ACCESS',
      userId,
      role: 'SUPER_ADMIN',
      req,
      success: true,
      details: {
        resource,
        adminAction: action,
      },
    });

  getAuditLogs = async (limit = 100, startAfter = null, filters = {}) => {
    try {
      let query = this.db.collection('audit_logs').orderBy('timestamp', 'desc').limit(limit);

      if (filters.action) {
        query = query.where('action', '==', filters.action);
      }
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.role) {
        query = query.where('role', '==', filters.role);
      }
      if (filters.success !== undefined) {
        query = query.where('success', '==', filters.success);
      }
      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
    } catch (error) {
      logStructured('error', 'failed to retrieve audit logs', { error: error.message });
      throw error;
    }
  };

  getAuditStats = async (timeRange = 24) => {
    try {
      const since = new Date(Date.now() - timeRange * 60 * 60 * 1000);
      const snapshot = await this.db.collection('audit_logs').where('timestamp', '>=', since).get();
      const stats = {
        total: snapshot.size,
        byAction: {},
        byRole: {},
        successRate: 0,
        uniqueUsers: new Set(),
        uniqueDevices: new Set(),
      };

      let successCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        stats.byAction[data.action] = (stats.byAction[data.action] || 0) + 1;
        if (data.role) {
          stats.byRole[data.role] = (stats.byRole[data.role] || 0) + 1;
        }
        if (data.success) {
          successCount += 1;
        }
        if (data.userId) {
          stats.uniqueUsers.add(data.userId);
        }
        if (data.deviceId) {
          stats.uniqueDevices.add(data.deviceId);
        }
      });

      stats.successRate = stats.total > 0 ? Number(((successCount / stats.total) * 100).toFixed(1)) : 0;
      stats.uniqueUsers = stats.uniqueUsers.size;
      stats.uniqueDevices = stats.uniqueDevices.size;

      return stats;
    } catch (error) {
      logStructured('error', 'failed to compute audit stats', { error: error.message });
      throw error;
    }
  };
}

module.exports = new AuditService();

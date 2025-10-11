const express = require('express');
const router = express.Router();
// Dynamic import for node-fetch v3+ ES module compatibility
let fetch;
(async () => {
  try {
    const { default: nodeFetch } = await import('node-fetch');
    fetch = nodeFetch;
  } catch (err) {
    console.warn('⚠️ node-fetch not available, fetch calls will fail:', err.message);
  }
})();
const fs = require('fs');
const path = require('path');
const {
  startTraceRun,
  appendTraceEvent,
  completeTraceRun
} = require('../services/ai_trace_hub');
const {
  recordEvent: persistAutoImproveEvent,
  getEventsSince: getPersistedEventsSince,
  createCheckpoint: persistCheckpoint,
  recordControlAction: persistControlAction,
  recursivelyRedact: redactAutoImprovePayload
} = require('../services/auto_improve_run_store');
const { createServiceToken, verifyServiceToken, getServiceAuthConfigs } = require('../../shared/serviceToken');
const { requireInternalToken } = require('../middleware/internal_token');

const proposalsFilePath = path.join(__dirname, '../data/auto_update_proposals.json');
const feedbackHistoryPath = path.join(__dirname, '../data/auto_feedback_history.json');
const aiServiceFeedbackPath = path.resolve(__dirname, '../../ai-service/feedback_data/proposal_outcomes.json');

const ensureDirExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadStoredProposals = () => {
  try {
    if (!fs.existsSync(proposalsFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(proposalsFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('⚠️ [AUTO-IMPROVE] Failed to load stored proposals:', error.message);
    return [];
  }
};

const saveStoredProposals = (proposals) => {
  try {
    ensureDirExists(proposalsFilePath);
    fs.writeFileSync(proposalsFilePath, JSON.stringify(proposals, null, 2));
  } catch (error) {
    console.warn('⚠️ [AUTO-IMPROVE] Failed to persist proposals:', error.message);
  }
};

const appendFeedbackHistory = (entry) => {
  try {
    ensureDirExists(feedbackHistoryPath);
    const existing = fs.existsSync(feedbackHistoryPath)
      ? JSON.parse(fs.readFileSync(feedbackHistoryPath, 'utf8') || '[]')
      : [];
    existing.unshift(entry);
    const trimmed = existing.slice(0, 50);
    fs.writeFileSync(feedbackHistoryPath, JSON.stringify(trimmed, null, 2));

    ensureDirExists(aiServiceFeedbackPath);
    fs.writeFileSync(aiServiceFeedbackPath, JSON.stringify(trimmed, null, 2));
  } catch (error) {
    console.warn('⚠️ [AUTO-IMPROVE] Failed to record feedback history:', error.message);
  }
};

const getRecentSimilarHistory = (kpiKey, limit = 5) => {
  try {
    if (!featureFlags.memoryEnabled || !fs.existsSync(feedbackHistoryPath)) {
      return [];
    }
    const raw = fs.readFileSync(feedbackHistoryPath, 'utf8') || '[]';
    const parsed = JSON.parse(raw);
    const filtered = parsed.filter((entry) => {
      if (!kpiKey) {
        return true;
      }
      return entry.kpiKey === kpiKey;
    });
    return filtered.slice(0, Math.max(limit, 5));
  } catch (error) {
    console.warn('⚠️ [AUTO-IMPROVE] Failed to read feedback history:', error.message);
    return [];
  }
};

const determineSmartRouting = (proposal = {}) => {
  const fileCount = Array.isArray(proposal.files) ? proposal.files.length : 0;
  const severity = proposal.severity || '';
  const riskLevel = typeof proposal.risk === 'string' ? proposal.risk : proposal.risk?.level;

  const complexityScore = [
    fileCount >= SMART_ROUTING_FILE_THRESHOLD ? 1 : 0,
    severity && severity.toUpperCase() === 'P1' ? 1 : 0,
    riskLevel && SMART_ROUTING_RISK_LEVELS.includes(String(riskLevel).toLowerCase()) ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);

  const isComplex = complexityScore >= 1;
  const routeDecision = isComplex ? 'complex' : 'simple';
  const modelUsed = isComplex ? 'llama3-70b-8192' : 'llama3-8b-8192';

  return {
    routeDecision,
    modelUsed,
    complexityScore,
    fileCount,
    severity,
    riskLevel: riskLevel || 'unknown'
  };
};

const evaluateKpiOutcome = ({ proposal, baseline, observed }) => {
  const safeBaseline = Number.isFinite(baseline) && baseline !== 0 ? baseline : 100;
  const safeObserved = Number.isFinite(observed) ? observed : safeBaseline;

  const delta = ((safeObserved - safeBaseline) / safeBaseline) * 100;

  let outcome = 'no-change';
  if (delta >= KPI_IMPROVEMENT_THRESHOLD) {
    outcome = 'improved';
  } else if (delta <= -1 * KPI_REGRESSION_THRESHOLD) {
    outcome = 'regressed';
  }

  const rollbackRecommended = outcome === 'regressed' && Math.abs(delta) >= KPI_SEVERE_REGRESSION_THRESHOLD;

  return {
    kpiKey: proposal?.kpiKey || 'autoimprove:unknown',
    baseline: safeBaseline,
    observed: safeObserved,
    delta: Number(delta.toFixed(2)),
    outcome,
    rollbackRecommended
  };
};

// --- Environment Variables ---
// Assuming AI_SERVICE_URL is set in the environment
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5003'; // Default to a local AI service
const SERVICE_AUTH_CONFIG = getServiceAuthConfigs()[0] || null;

if (SERVICE_AUTH_CONFIG?.isFallback) {
  console.warn('⚠️ [AUTO-IMPROVE] Using fallback service auth secret. Configure AI_SERVICE_SHARED_SECRET for production-like environments.');
}

const issueAutoImproveServiceToken = () => {
  try {
    return createServiceToken({
      svc: 'backend-auto-improve',
      service: 'backend-auto-improve',
      role: 'SYSTEM_BOT',
      permissions: ['chat', 'models', 'proposals', 'auto_improve'],
    });
  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Failed to issue service token', { message: error.message });
    return null;
  }
};

const extractInboundServiceToken = (req) => {
  const headerToken = req.headers['x-service-token'] || req.headers['x-ai-internal-token'];
  if (headerToken) {
    return headerToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
};

const resolveFlag = (value, defaultEnabled = true) => {
  if (typeof value === 'undefined') {
    return defaultEnabled;
  }
  return value === 'true' || value === true;
};

const featureFlags = {
  smartRouting: resolveFlag(process.env.AI_SMART_ROUTING, true),
  hitlApprovals: resolveFlag(process.env.AI_HITL_APPROVALS, true),
  feedbackLoop: resolveFlag(process.env.AI_FEEDBACK_LOOP, true),
  memoryEnabled: resolveFlag(process.env.AI_MEMORY_ENABLED, true)
};

const SMART_ROUTING_FILE_THRESHOLD = Number(process.env.AI_SMART_ROUTING_COMPLEX_FILES || 3);
const SMART_ROUTING_RISK_LEVELS = (process.env.AI_SMART_ROUTING_COMPLEX_RISK_LEVELS || 'high,critical')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const KPI_IMPROVEMENT_THRESHOLD = Number(process.env.AI_KPI_IMPROVEMENT_THRESHOLD || 5);
const KPI_REGRESSION_THRESHOLD = Number(process.env.AI_KPI_REGRESSION_THRESHOLD || 5);
const KPI_SEVERE_REGRESSION_THRESHOLD = Number(process.env.AI_KPI_SEVERE_REGRESSION_THRESHOLD || 10);

// Import required middleware
const { requireSuperAdmin } = require('../middleware/admin_guards');

// Alias for backwards compatibility
const requireAdminAuth = requireSuperAdmin;

// Notification hooks service
const NotificationHooksService = require('../services/notificationHooks');
const notificationHooks = new NotificationHooksService();

// Firebase Admin - optional for development
let admin;
try {
  admin = require('../firebase');
  console.log('✅ Firebase Admin loaded for AutoImprove');
} catch (err) {
  console.warn('⚠️ Firebase Admin not available for AutoImprove - using development fallback');
  admin = null;
}

// --- Risk Classifier Implementation ---

// Import the production Risk Classifier
const RiskClassifier = require('../services/riskClassifier');
const riskClassifierInstance = new RiskClassifier();

// Wrapper object for backwards compatibility
const riskClassifier = {
  classifyRisk: (proposal) => {
    return riskClassifierInstance.classifyRisk(proposal);
  },

  checkAutoApplyEligibility: (riskAnalysis) => {
    return riskClassifierInstance.checkAutoApplyEligibility(riskAnalysis);
  },

  getRiskBadgeData: (riskAnalysis) => {
    return riskClassifierInstance.getRiskBadgeData(riskAnalysis);
  }
};

// --- End Risk Classifier ---

// --- AI Guard Implementation ---
// Mock AI Guard instance for development
const aiGuardInstance = {
  validateBatch: async (operations) => {
    console.log('🔒 [AI GUARD] Validating batch operations:', operations);
    // Simulate validation logic
    const results = operations.map(op => {
      const isBlocked = op.filePath.includes('secrets') || op.filePath.includes('.env') || op.filePath.includes('db/migrations');
      return {
        operation: op,
        validation: {
          allowed: !isBlocked,
          rule: isBlocked ? 'neverTouch' : null,
          reason: isBlocked ? 'File is configured to be never touched.' : null
        }
      };
    });
    const hasViolations = results.some(r => !r.validation.allowed);
    return {
      hasViolations,
      results,
      summary: `Performed ${operations.length} validations. ${hasViolations ? 'Violations found.' : 'No violations.'}`
    };
  },
  validateFileOperation: async (filePath, operation) => {
    console.log(`🔒 [AI GUARD] Validating single file operation: ${filePath} (${operation})`);
    const isBlocked = filePath.includes('secrets') || filePath.includes('.env') || filePath.includes('db/migrations');
    return {
      filePath,
      operation,
      validation: {
        allowed: !isBlocked,
        rule: isBlocked ? 'neverTouch' : null,
        reason: isBlocked ? 'File is configured to be never touched.' : null
      }
    };
  },
  getStats: () => ({
    filesScanned: 150,
    violationsFound: 5,
    rulesApplied: 3,
    lastScan: Date.now()
  }),
  getAuditLog: (limit = 50) => [
    { id: 'audit_1', timestamp: Date.now() - 60000, event: 'guard-blocked', details: { file: 'secrets/api.key', rule: 'neverTouch' } },
    { id: 'audit_2', timestamp: Date.now() - 120000, event: 'guard-applied', details: { file: 'src/components/button.js', rule: 'allowAuto' } },
    { id: 'audit_3', timestamp: Date.now() - 180000, event: 'guard-blocked', details: { file: '.env.prod', rule: 'neverTouch' } }
  ].slice(0, limit),
  getConfig: () => ({
    neverTouch: ['secrets/**', '.env*', 'db/migrations/**'],
    manualReview: ['config/**', 'infrastructure/**'],
    allowAuto: ['src/components/**', 'styles/**']
  })
};

// Rate limit bypass middleware for monitoring endpoints
const bypassRateLimit = (req, res, next) => {
  // Mark request as monitoring to bypass rate limits
  req.isMonitoringEndpoint = true;
  req.skipRateLimit = true; // Additional flag for rate limiter

  // Also check for monitoring header from frontend
  if (req.headers['x-monitoring-endpoint'] === 'true') {
    req.isMonitoringEndpoint = true;
    req.skipRateLimit = true;
  }

  next();
};

const hasSuperAdminAccess = (req) => {
  if (process.env.NODE_ENV === 'development') return true;
  return req.session?.user?.role === 'SUPER_ADMIN';
};

const buildPublicFallbackKpis = () => ({
  aiHealth: 'WARN',
  backendHealth: 'WARN',
  frontendHealth: 'OK',
  queueLength: Math.floor(Math.random() * 3),
  p95ResponseTime: 240 + Math.floor(Math.random() * 40),
  errorRate: Number((Math.random() * 2).toFixed(2)),
  lastRunAt: new Date(Date.now() - 45000).toISOString(),
  mode: 'manual'
});

const buildPublicFallbackHistory = (limit = 5) =>
  Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
    id: `public-run-${i}`,
    startedAt: new Date(Date.now() - i * 420000).toISOString(),
    sources: ['public-demo'],
    result: i % 3 === 0 ? 'failed' : 'success',
    cid: `public-cid-${i}`
  }));

// Middleware to protect AutoImprove internal endpoints
const protectAutoImprove = (req, res, next) => {
  if (req.internalAuth?.tokenSource) {
    console.log('✅ [AUTO-IMPROVE] Internal token accepted', {
      source: req.internalAuth.tokenSource,
      path: req.originalUrl || req.url,
    });
    return next();
  }

  const allowBypass = SERVICE_AUTH_CONFIG?.isFallback && process.env.NODE_ENV === 'development';

  if (allowBypass) {
    console.log('🔓 [AUTO-IMPROVE] Development mode with fallback secret - bypassing service authentication');
    return next();
  }

  const token = extractInboundServiceToken(req);

  if (!token) {
    console.warn('🚫 [AUTO-IMPROVE] Missing service token');
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Service authentication token required'
    });
  }

  try {
    const { decoded } = verifyServiceToken(token);
    const serviceName = decoded.service || decoded.svc || 'unknown';
    const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];
    const hasAutoImprovePermission = permissions.includes('auto_improve');

    if (serviceName === 'backend' || serviceName === 'backend-auto-improve' || hasAutoImprovePermission) {
      console.log('✅ [AUTO-IMPROVE] Service token verified', {
        service: serviceName,
        permissions
      });
      return next();
    }

    console.warn('🚫 [AUTO-IMPROVE] Service lacks auto_improve permission', {
      service: serviceName,
      permissions
    });
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Service not authorized for Auto-Improve operations'
    });
  } catch (error) {
    console.warn('🚫 [AUTO-IMPROVE] Service token verification failed', { message: error.message });
    return res.status(403).json({
      success: false,
      error: 'INVALID_SERVICE_TOKEN',
      message: 'Invalid or expired service token'
    });
  }
};

// Auto-Update Monitoring Endpoints

// KPIs endpoint - needed by frontend
router.get('/kpis', requireSuperAdmin, async (req, res) => {
  try {
    console.log('🔍 [AUTO-IMPROVE] KPIs endpoint requested');

    // Mock KPIs data for development
    const kpis = {
      aiHealth: Math.random() > 0.8 ? 'ERROR' : Math.random() > 0.9 ? 'WARN' : 'OK',
      backendHealth: Math.random() > 0.8 ? 'ERROR' : Math.random() > 0.9 ? 'WARN' : 'OK',
      frontendHealth: 'OK',
      queueLength: Math.floor(Math.random() * 10),
      p95ResponseTime: Math.floor(Math.random() * 500) + 100,
      errorRate: Math.random() * 5,
      lastRunAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      mode: ['auto', 'manual', 'paused'][Math.floor(Math.random() * 3)]
    };

    res.json({
      success: true,
      kpis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] KPIs error:', error);
    res.status(500).json({
      success: false,
      error: 'KPIs fetch failed',
      details: error.message
    });
  }
});

// History endpoint - needed by frontend  
router.get('/history', requireSuperAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    console.log(`🔍 [AUTO-IMPROVE] History requested (limit: ${limit})`);

    // Mock history data
    const history = Array.from({ length: limit }, (_, i) => {
      const allSources = ['backend', 'frontend', 'ai-service'];
      const numSources = Math.floor(Math.random() * 3) + 1;
      const sources = [];
      for (let j = 0; j < numSources; j++) {
        const source = allSources[Math.floor(Math.random() * allSources.length)];
        if (!sources.includes(source)) {
          sources.push(source);
        }
      }
      return {
        id: `run-${Date.now()}-${i}`,
        startedAt: new Date(Date.now() - i * 300000).toISOString(),
        sources: sources,
        result: ['success', 'failed', 'running'][Math.floor(Math.random() * 3)],
        cid: `cid_${Date.now()}_${i}`
      };
    });

    res.json({
      success: true,
      history,
      total: history.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] History error:', error);
    res.status(500).json({
      success: false,
      error: 'History fetch failed',
      details: error.message
    });
  }
});

const buildServiceHeaders = (extraHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'x-monitoring-endpoint': 'true',
    ...extraHeaders
  };

  const token = issueAutoImproveServiceToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const fetchFromAIService = async (endpoint, options = {}) => {
  if (!fetch) {
    throw new Error('node-fetch not available');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 8000);

  try {
    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: buildServiceHeaders(options.headers || {}),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI service responded with ${response.status}: ${text}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

const mapAiServiceKpis = (aiServiceResponse = {}) => {
  const aiKpis = aiServiceResponse.kpis || {};
  const aiHealth = aiKpis.aiHealth || (aiServiceResponse.success ? 'OK' : 'WARN');
  const queueLength = typeof aiKpis.queueLength === 'number' ? aiKpis.queueLength : 0;
  const responseTime = typeof aiKpis.responseTime === 'number' ? aiKpis.responseTime : 200;
  const processingRate = typeof aiKpis.processingRate === 'number' ? aiKpis.processingRate : 0;
  const lastModelUpdate = aiKpis.lastModelUpdate || aiServiceResponse.timestamp || new Date().toISOString();
  const modelStatus = aiKpis.modelStatus || 'ACTIVE';

  const backendHealth = queueLength > 15 ? 'WARN' : 'OK';
  const frontendHealth = 'OK';

  let mode = 'manual';
  if (modelStatus === 'ACTIVE') {
    mode = 'auto';
  } else if (modelStatus === 'PAUSED' || modelStatus === 'ERROR') {
    mode = 'paused';
  }

  return {
    aiHealth: aiHealth === 'ERROR' ? 'ERROR' : (aiHealth === 'WARN' ? 'WARN' : 'OK'),
    backendHealth,
    frontendHealth,
    queueLength,
    p95ResponseTime: responseTime,
    errorRate: typeof aiKpis.errorRate === 'number' ? aiKpis.errorRate : (aiHealth === 'OK' ? 0 : 2.5),
    lastRunAt: lastModelUpdate,
    mode,
    modelStatus,
    responseTime,
    processingRate,
    lastModelUpdate
  };
};

router.get('/monitor/status', bypassRateLimit, async (req, res) => {
  const isSuperAdmin = hasSuperAdminAccess(req);
  try {
    console.log('🔍 [AUTO-IMPROVE] Monitor status endpoint requested');

    if (!isSuperAdmin) {
      console.warn('⚠️ [AUTO-IMPROVE] Public access detected - returning fallback KPIs');
      return res.json({
        success: true,
        source: 'public-demo',
        kpis: buildPublicFallbackKpis(),
        access: 'restricted',
        timestamp: new Date().toISOString()
      });
    }

    const aiServiceData = await fetchFromAIService('/api/auto-improve/kpis');
    const kpis = mapAiServiceKpis(aiServiceData);

    res.json({
      success: true,
      source: 'ai-service',
      kpis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Monitor status error:', error.message);

    const fallbackKpis = buildPublicFallbackKpis();

    res.json({
      success: true,
      source: isSuperAdmin ? 'fallback' : 'public-demo',
      kpis: fallbackKpis,
      error: error.message,
      access: isSuperAdmin ? 'super-admin' : 'restricted',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/monitor/history', bypassRateLimit, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  console.log(`🔍 [AUTO-IMPROVE] Monitor history requested (limit: ${limit})`);
  const isSuperAdmin = hasSuperAdminAccess(req);

  if (!isSuperAdmin) {
    console.warn('⚠️ [AUTO-IMPROVE] Public access detected - returning fallback history');
    const fallbackHistory = buildPublicFallbackHistory(limit);
    return res.json({
      success: true,
      source: 'public-demo',
      history: fallbackHistory,
      total: fallbackHistory.length,
      access: 'restricted',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const aiHistoryResponse = await fetchFromAIService(`/api/auto-improve/history?limit=${limit}`);
    const history = Array.isArray(aiHistoryResponse.history)
      ? aiHistoryResponse.history.map((entry) => ({
          id: entry.id || entry.metadata?.requestId || `run-${entry.startedAt}`,
          startedAt: entry.startedAt || entry.timestamp || new Date().toISOString(),
          sources: entry.sources || ['ai-service'],
          result: entry.result || (entry.success ? 'success' : 'failed'),
          cid: entry.metadata?.requestId || entry.id || `cid_${Date.now()}`
        }))
      : [];

    res.json({
      success: true,
      source: 'ai-service',
      history,
      total: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Monitor history error:', error.message);

    const fallbackHistory = buildPublicFallbackHistory(limit);

    res.json({
      success: true,
      source: isSuperAdmin ? 'fallback' : 'public-demo',
      history: fallbackHistory,
      total: fallbackHistory.length,
      error: error.message,
      access: isSuperAdmin ? 'super-admin' : 'restricted',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/monitor/events', requireSuperAdmin, async (req, res) => {
  try {
    const lastEventId = typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null;
    const since = typeof req.query.since === 'string' ? req.query.since : null;
    const sinceTimestamp = typeof req.query.sinceTimestamp === 'string' ? req.query.sinceTimestamp : null;
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 250;

    const events = getPersistedEventsSince(lastEventId, sinceTimestamp || since).slice(-limit);

    res.json({
      success: true,
      transport: 'poll',
      events,
      lastEventId: events.length > 0 ? events[events.length - 1].id : lastEventId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Monitor events fallback error:', error.message);
    res.status(500).json({
      success: false,
      error: 'EVENT_STREAM_FALLBACK_FAILED',
      details: error.message
    });
  }
});

const describeActionInGeorgian = (action = 'run') => {
  const mapping = {
    writeFile: 'ფაილის განახლება',
    executeShellCommand: 'სკრიპტის გაშვება',
    installPackage: 'პაკეტის ინსტალაცია',
    dryRun: 'ტესტური გაშვება'
  };

  return mapping[action] || 'სისტემური ოპერაცია';
};

const mapHistoryEntryToLiveEvent = (entry) => {
  const action = entry.metadata?.action || entry.action || 'run';
  const success = entry.result === 'success' || entry.success === true;
  const duration = entry.duration || entry.durationMs;
  const params = entry.metadata?.params || entry.params || {};
  const requestId = entry.metadata?.requestId || entry.requestId || entry.id;
  const runId = entry.runId || entry.metadata?.runId || requestId;
  const diffUrl = entry.metadata?.diffUrl
    || (entry.diffUrl ? String(entry.diffUrl) : null)
    || (runId ? `/explorer/diff?runId=${encodeURIComponent(runId)}` : null);

  let type = 'CheckStarted';
  if (action === 'writeFile') {
    type = 'ProposalsPushed';
  } else if (action === 'executeShellCommand') {
    type = success ? 'TestsPassed' : 'TestsFailed';
  } else if (action === 'installPackage') {
    type = 'ArtifactsReady';
  } else if (!success) {
    type = 'CheckFailed';
  } else {
    type = 'CheckPassed';
  }

  const actionDescription = describeActionInGeorgian(action);
  const fileInfo = params.filePath ? ` (${params.filePath})` : '';
  const durationInfo = duration ? ` ${duration}ms` : '';

  const message = success
    ? `✅ ${actionDescription}${fileInfo} წარმატებით დასრულდა${durationInfo}`
    : `❌ ${actionDescription}${fileInfo} ვერ შესრულდა: ${entry.error || entry.result || 'უცნობი შეცდომა'}`;

  return {
    type,
    message,
    timestamp: entry.completedAt || entry.startedAt || new Date().toISOString(),
    cid: requestId || `cid_${Date.now()}`,
    risk: success ? 'LOW' : 'HIGH',
    runId,
    diffUrl,
    payload: redactAutoImprovePayload({
      action,
      params,
      success,
      duration,
      metadata: entry.metadata,
      outcome: entry.result || entry.error || null
    })
  };
};

router.get('/monitor/stream', bypassRateLimit, async (req, res) => {
  console.log('🔍 [AUTO-IMPROVE] SSE stream connection requested');

  const lastEventIdFromHeader = req.get('Last-Event-ID');
  const lastEventIdFromQuery = typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null;
  const sinceQuery = typeof req.query.since === 'string' ? req.query.since : null;
  const sinceTimestamp = typeof req.query.sinceTimestamp === 'string' ? req.query.sinceTimestamp : null;

  const getSince = () => sinceTimestamp || sinceQuery || null;

  const createHeartbeat = () =>
    setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);

  const deliverEvent = async (event, { persist = true, transport = 'sse' } = {}) => {
    if (res.writableEnded) {
      return null;
    }

    try {
      const enrichedEvent = {
        transport,
        eventName: event.eventName || event.type || 'message',
        ...event,
        correlationId: event.correlationId || req.correlationId,
        timestamp: event.timestamp || new Date().toISOString()
      };

      const storedEvent = persist
        ? await persistAutoImproveEvent(enrichedEvent)
        : { ...enrichedEvent };

      const outboundEvent = {
        ...storedEvent,
        transport
      };

      const eventName = outboundEvent.eventName || outboundEvent.type || 'message';

      if (outboundEvent.id) {
        res.write(`id: ${outboundEvent.id}\n`);
      }
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(outboundEvent)}\n\n`);
      return outboundEvent;
    } catch (error) {
      console.error('❌ [AUTO-IMPROVE] Failed to send SSE event:', error.message);
      return null;
    }
  };

  const startPublicDemoStream = () => {
    console.warn('⚠️ [AUTO-IMPROVE] Public SSE stream - using simulated events');

    const demoEvents = [
      {
        type: 'CheckStarted',
        message: 'გურულა ამოწმებს სისტემის ჯანმრთელობას და აანალიზებს კოდს',
        risk: 'LOW'
      },
      {
        type: 'ProposalsPushed',
        message: 'ნაპოვნია რამდენიმე წინადადება ინტერფეისის გასაუმჯობესებლად',
        risk: 'LOW'
      },
      {
        type: 'TestsRunning',
        message: 'ტესტები გაშვებულია რომ დავრწმუნდეთ უსაფრთხოებაში',
        risk: 'MEDIUM'
      },
      {
        type: 'CheckPassed',
        message: 'ყველაფერი წესრიგშია! ცვლილებები მზად არის განხილვისთვის',
        risk: 'LOW'
      }
    ];

    let index = 0;
    void deliverEvent({
      type: 'Connected',
      eventName: 'status',
      message: 'დემო რეჟიმი ჩართულია — გურულა აგრძელებს სიმულირებულ მუშაობას',
      risk: 'LOW'
    }, { persist: false });

    const demoInterval = setInterval(() => {
      const baseEvent = demoEvents[index % demoEvents.length];
      void deliverEvent({
        ...baseEvent,
        eventName: 'status'
      }, { persist: false });
      index += 1;
    }, 5000);

    const heartbeatInterval = createHeartbeat();

    const cleanup = () => {
      clearInterval(demoInterval);
      clearInterval(heartbeatInterval);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  };

  const isSuperAdmin = hasSuperAdminAccess(req);

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control, Accept, Content-Type, Authorization, Last-Event-ID',
      'X-Accel-Buffering': 'no'
    });

    if (!isSuperAdmin) {
      startPublicDemoStream();
      return;
    }

    const lastEventId = lastEventIdFromHeader || lastEventIdFromQuery || null;
    const backlogEvents = getPersistedEventsSince(lastEventId, getSince()) || [];
    if (Array.isArray(backlogEvents) && backlogEvents.length > 0) {
      console.log(`🔁 [AUTO-IMPROVE] Replaying ${backlogEvents.length} buffered events to reconnecting client`);
      for (const bufferedEvent of backlogEvents) {
        await deliverEvent(bufferedEvent, { persist: false });
      }
    }

    await deliverEvent({
      type: 'Connected',
      eventName: 'status',
      message: 'AI სერვისთან კავშირი დამყარებულია',
      risk: 'LOW'
    });

    const seenEvents = new Set(backlogEvents.map((event) => event.id));
    let consecutiveHistoryFailures = 0;

    const pollHistory = async () => {
      try {
        const aiHistoryResponse = await fetchFromAIService('/api/auto-improve/history?limit=10');
        const history = Array.isArray(aiHistoryResponse.history) ? aiHistoryResponse.history : [];

        let deliveredCount = 0;
        for (const entry of history.slice().reverse()) {
          const eventId = entry.id || entry.metadata?.requestId || entry.startedAt;
          if (!eventId || seenEvents.has(eventId)) {
            continue;
          }

          seenEvents.add(eventId);
          let eventPayload = mapHistoryEntryToLiveEvent(entry);

          if (entry.snapshot || entry.files) {
            try {
              const checkpoint = await persistCheckpoint(eventPayload.runId, entry.snapshot || { files: entry.files }, {
                actor: 'auto',
                reason: `history.${eventPayload.type?.toLowerCase?.() || 'update'}`,
                diffUrl: eventPayload.diffUrl
              });
              eventPayload = {
                ...eventPayload,
                checkpointId: checkpoint.checkpointId
              };
            } catch (checkpointError) {
              console.warn('⚠️ [AUTO-IMPROVE] Failed to persist checkpoint:', checkpointError.message);
            }
          }

          await deliverEvent(eventPayload);
          deliveredCount += 1;
        }

        if (history.length === 0 && seenEvents.size === 0) {
          await deliverEvent({
            type: 'CheckStarted',
            message: 'ცოცხალი აგენტი აქტიურია და ელოდება პირველ ოპერაციას',
            risk: 'LOW'
          });
        }

        consecutiveHistoryFailures = 0;

        if (deliveredCount > 0) {
          await deliverEvent({
            type: 'Metrics',
            eventName: 'metric',
            message: `ისტორიიდან ${deliveredCount} ჩანაწერი განახლდა`,
            payload: { deliveredCount },
            risk: 'LOW'
          }, { persist: false });
        }
      } catch (error) {
        consecutiveHistoryFailures += 1;
        console.error('❌ [AUTO-IMPROVE] Failed to fetch real history for SSE:', error.message);
        await deliverEvent({
          type: 'TransportDegraded',
          eventName: 'status',
          message: `AI სერვისიდან ისტორიის მიღება ვერ მოხერხდა: ${error.message}`,
          risk: consecutiveHistoryFailures >= 3 ? 'HIGH' : 'MEDIUM',
          payload: { consecutiveHistoryFailures }
        });
      }
    };

    await pollHistory();

    const pollInterval = setInterval(pollHistory, 5000);
    const heartbeatInterval = createHeartbeat();

    req.on('close', () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      console.log('🔍 [AUTO-IMPROVE] SSE stream disconnected');
    });

    req.on('error', (error) => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      console.error('🔍 [AUTO-IMPROVE] SSE request error:', error.message);
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] SSE error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

router.post('/monitor/control', requireSuperAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    console.log(`🔍 [AUTO-IMPROVE] Control action: ${action}`);

    if (!['pause', 'resume'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be pause or resume'
      });
    }

    const actor = req.session?.user
      ? { id: req.session.user.id, role: req.session.user.role }
      : null;

    await persistControlAction(action, {
      runId: req.body?.runId || null,
      actor,
      notes: req.body?.reason || null
    });

    // Mock control action
    res.json({
      success: true,
      action,
      message: `AutoUpdate ${action} successful`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Control action error:', error);
    res.status(500).json({
      success: false,
      error: 'Control action failed',
      details: error.message
    });
  }
});

router.post('/monitor/retry', requireSuperAdmin, async (req, res) => {
  try {
    const { runId } = req.body;
    console.log(`🔍 [AUTO-IMPROVE] Retry run: ${runId}`);

    const actor = req.session?.user
      ? { id: req.session.user.id, role: req.session.user.role }
      : null;

    await persistControlAction('retry', {
      runId,
      actor,
      notes: req.body?.reason || null
    });

    res.json({
      success: true,
      runId,
      message: 'Run retry initiated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Retry error:', error);
    res.status(500).json({
      success: false,
      error: 'Retry failed',
      details: error.message
    });
  }
});

router.post('/monitor/rollback', requireSuperAdmin, async (req, res) => {
  try {
    const { runId, checkpointId, snapshot, diffUrl } = req.body;
    console.log(`🔍 [AUTO-IMPROVE] Rollback run: ${runId}`);

    const actor = req.session?.user
      ? { id: req.session.user.id, role: req.session.user.role }
      : null;

    let resolvedCheckpointId = checkpointId || null;
    if (!resolvedCheckpointId && snapshot) {
      try {
        const checkpoint = await persistCheckpoint(runId, snapshot, {
          actor: actor?.id || null,
          reason: 'manual.rollback',
          diffUrl: diffUrl || null
        });
        resolvedCheckpointId = checkpoint.checkpointId;
      } catch (checkpointError) {
        console.warn('⚠️ [AUTO-IMPROVE] Failed to persist rollback checkpoint:', checkpointError.message);
      }
    }

    await persistControlAction('rollback', {
      runId,
      checkpointId: resolvedCheckpointId,
      actor,
      notes: req.body?.reason || null
    });

    res.json({
      success: true,
      runId,
      checkpointId: resolvedCheckpointId,
      message: 'Rollback initiated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Rollback error:', error);
    res.status(500).json({
      success: false,
      error: 'Rollback failed',
      details: error.message
    });
  }
});

router.get('/monitor/export', requireSuperAdmin, async (req, res) => {
  try {
    const { format = 'json', runId } = req.query;
    console.log(`🔍 [AUTO-IMPROVE] Export requested: format=${format}, runId=${runId || 'all'}`);

    const exportData = {
      timestamp: new Date().toISOString(),
      runId: runId || 'all',
      data: runId ? `Mock data for run ${runId}` : 'Mock export data for all runs'
    };

    if (format === 'csv') {
      const csv = `timestamp,runId,data\n${exportData.timestamp},${exportData.runId},"${exportData.data}"`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="autoupdate-export-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="autoupdate-export-${Date.now()}.json"`);
      res.json(exportData);
    }

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Export failed',
      details: error.message
    });
  }
});

// Mock proposals data - should be fetched from a database in a real app
const mockProposals = [
  {
    id: 'proposal-1',
    title: 'ოპტიმიზაცია: API Response ტაიმაუტების გაუმჯობესება',
    description: 'API endpoints-ების სიჩქარის გაუმჯობესება და timeout-ების კონფიგურაცია',
    summary: 'API რექვესტების სიჩქარე 300ms-დან 150ms-მდე გაიუმჯობესება timeout კონფიგურაციის ოპტიმიზაციით',
    status: 'pending',
    severity: 'P2',
    type: 'performance',
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
    source: 'ai-enhanced-monitor',
    correlationId: 'mock-proposal-1',
    kpiKey: 'autoimprove:latency',
    routeDecision: 'complex',
    modelUsed: 'llama3-70b-8192',
    evidence: [
      {
        file: 'backend/routes/auto_improve.js',
        line: 150,
        rule: 'response-time-optimization',
        note: 'API responses ზედმეტად ნელია, შეიძლება ოპტიმიზაცია'
      }
    ],
    files: [
      {
        path: 'backend/routes/auto_improve.js',
        lines: '45-67',
        rule: 'response-timeout',
        note: 'timeout კონფიგურაცია 30s-დან 15s-მდე'
      },
      {
        path: 'backend/middleware/admin_guards.js',
        lines: '12-18',
        rule: 'middleware-optimization',
        note: 'auth check-ის ოპტიმიზაცია'
      }
    ],
    impact: {
      perf: 'high',
      readability: 'medium',
      security: 'none',
      risk: 'low'
    },
    tests: {
      tsc: 'pass',
      eslint: 'pass',
      build: 'pass',
      unit: 'pending'
    },
    smoke: {
      health: 'pass',
      routes: [
        { path: '/api/health', status: 'pass' },
        { path: '/api/ai/autoimprove/proposals', status: 'pass' }
      ]
    },
    timeline: [
      {
        ts: Math.floor(Date.now() / 1000),
        type: 'created',
        message: 'წინადადება შეიქმნა AI სკანირების დროს'
      },
      {
        ts: Math.floor((Date.now() - 1800000) / 1000),
        type: 'analysis',
        message: 'კოდის ანალიზი დასრულდა'
      }
    ],
    scope: ['backend', 'performance'],
    autoApplied: false,
    guardReason: null,
    rollbackAvailable: false,
    statusHistory: [
      { status: 'pending', at: new Date(Date.now() - 3600000).toISOString() }
    ],
    feedbackHistory: []
  },
  {
    id: 'proposal-2',
    title: 'Security: Enhanced Auth Guards',
    description: 'Authentication middleware-ის გაძლიერება უსაფრთხოებისთვის',
    summary: 'Authentication guards-ში JWT validation-ის გაძლიერება და rate limiting-ის დამატება',
    status: 'approved',
    severity: 'P1',
    type: 'security',
    createdAt: { seconds: Math.floor((Date.now() - 86400000) / 1000) },
    source: 'ai-enhanced-monitor',
    correlationId: 'mock-proposal-2',
    kpiKey: 'autoimprove:security-incidents',
    routeDecision: 'complex',
    modelUsed: 'llama3-70b-8192',
    evidence: [
      {
        file: 'backend/middleware/admin_guards.js',
        line: 25,
        rule: 'auth-validation',
        note: 'Authentication guards დამატებითი ვალიდაციის გაძლიერება'
      }
    ],
    files: [
      {
        path: 'backend/middleware/admin_guards.js',
        lines: '20-45',
        rule: 'jwt-validation',
        note: 'JWT signature verification-ის გაძლიერება'
      }
    ],
    impact: {
      perf: 'low',
      readability: 'medium',
      security: 'high',
      risk: 'medium'
    },
    tests: {
      tsc: 'pass',
      eslint: 'pass',
      build: 'pass',
      unit: 'pass'
    },
    smoke: {
      health: 'pass',
      routes: [
        { path: '/api/admin/auth/me', status: 'pass' },
        { path: '/api/health', status: 'pass' }
      ]
    },
    timeline: [
      {
        ts: Math.floor((Date.now() - 86400000) / 1000),
        type: 'created',
        message: 'წინადადება შეიქმნა security scan-ის შედეგად'
      },
      {
        ts: Math.floor((Date.now() - 82800000) / 1000),
        type: 'dry-run',
        message: 'dry-run ტესტირება წარმატებით დასრულდა'
      },
      {
        ts: Math.floor((Date.now() - 7200000) / 1000),
        type: 'approved',
        message: 'წინადადება დამტკიცდა სუპერ ადმინის მიერ'
      }
    ],
    scope: ['backend', 'security', 'middleware'],
    autoApplied: false,
    guardReason: 'high-risk security change requires manual approval',
    rollbackAvailable: true,
    statusHistory: [
      { status: 'pending', at: new Date(Date.now() - 86400000).toISOString() },
      { status: 'approved', at: new Date(Date.now() - 7200000).toISOString() }
    ],
    feedbackHistory: []
  },
  {
    id: 'proposal-3',
    title: 'Bug Fix: CORS Configuration',
    description: 'CORS headers-ების კონფიგურაციის გასწორება cross-origin requests-ისთვის',
    summary: 'CORS Origin validation-ის გასწორება Replit domains-ისთვის და credentials support',
    status: 'pending',
    severity: 'P3',
    type: 'bugfix',
    createdAt: { seconds: Math.floor((Date.now() - 3600000) / 1000) },
    source: 'ai-enhanced-monitor',
    correlationId: 'mock-proposal-3',
    kpiKey: 'autoimprove:cors-errors',
    routeDecision: 'simple',
    modelUsed: 'llama3-8b-8192',
    evidence: [
      {
        file: 'backend/index.js',
        line: 85,
        rule: 'cors-config',
        note: 'CORS კონფიგურაცია შეიძლება გაუმჯობესდეს'
      }
    ],
    files: [
      {
        path: 'backend/index.js',
        lines: '80-110',
        rule: 'cors-headers',
        note: 'CORS allowedOrigins განახლება'
      }
    ],
    impact: {
      perf: 'none',
      readability: 'low',
      security: 'low',
      risk: 'low'
    },
    tests: {
      tsc: 'pass',
      eslint: 'warning',
      build: 'pass',
      unit: 'pass'
    },
    smoke: {
      health: 'pass',
      routes: [
        { path: '/api/health', status: 'pass' },
        { path: '/', status: 'pass' }
      ]
    },
    timeline: [
      {
        ts: Math.floor((Date.now() - 3600000) / 1000),
        type: 'created',
        message: 'CORS შეცდომების ანალიზის შედეგად შეიქმნა'
      },
      {
        ts: Math.floor((Date.now() - 1800000) / 1000),
        type: 'validation',
        message: 'კოდის ვალიდაცია დასრულდა'
      }
    ],
    scope: ['backend', 'configuration'],
    autoApplied: true,
    guardReason: null,
    rollbackAvailable: true,
    statusHistory: [
      { status: 'pending', at: new Date(Date.now() - 3600000).toISOString() }
    ],
    feedbackHistory: []
  }
];

const findProposalById = (proposalId) => {
  const stored = loadStoredProposals();
  const storedIndex = stored.findIndex((p) => p.id === proposalId);
  if (storedIndex !== -1) {
    return {
      proposal: stored[storedIndex],
      source: 'stored',
      index: storedIndex,
      stored
    };
  }

  const mockIndex = mockProposals.findIndex((p) => p.id === proposalId);
  if (mockIndex !== -1) {
    return {
      proposal: mockProposals[mockIndex],
      source: 'mock',
      index: mockIndex,
      stored
    };
  }

  return { proposal: null, source: null, index: -1, stored };
};

const persistProposalUpdate = (proposalId, updater) => {
  const { proposal, source, index, stored } = findProposalById(proposalId);
  if (!proposal) {
    return null;
  }

  const updated = updater({ ...proposal });

  if (source === 'stored') {
    stored[index] = updated;
    saveStoredProposals(stored);
  }

  if (source === 'mock') {
    mockProposals[index] = updated;
  }

  return updated;
};

// Debug endpoint
router.get('/_debug/ping', (req, res) => {
  console.log('🔍 [AUTO-IMPROVE] Debug ping endpoint hit');
  res.json({
    ok: true,
    status: 'AutoImprove routes working',
    timestamp: new Date().toISOString(),
    service: 'backend',
    port: process.env.PORT || 5002,
    path: req.path
  });
});

// Health endpoint
router.get('/health', (req, res) => {
  console.log('🔍 [AUTO-IMPROVE] Health check requested');
  res.json({
    ok: true,
    status: 'HEALTHY',
    service: 'AutoImprove Backend',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5002
  });
});

// Get single proposal status - SUPER_ADMIN only
router.get('/proposals/:proposalId/status', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    console.log(`🔍 [AUTO-IMPROVE] Status check for proposal: ${proposalId}`);

    const proposal = mockProposals.find(p => p.id === proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found',
        proposalId
      });
    }

    res.json({
      success: true,
      proposalId,
      status: proposal.status,
      appliedAt: proposal.appliedAt,
      timeline: proposal.timeline || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ [AUTO-IMPROVE] Status check failed for ${req.params.proposalId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      details: error.message
    });
  }
});

// List proposals endpoint - SUPER_ADMIN only with rate limit bypass
router.get('/proposals', bypassRateLimit, requireSuperAdmin, async (req, res) => {
  console.log('📋 [AUTO-IMPROVE] Fetching real proposals...');

  const storedProposals = loadStoredProposals();
  const combinedLocalProposals = (() => {
    if (storedProposals.length === 0) {
      return mockProposals;
    }
    const mockOnly = mockProposals.filter((proposal) => !storedProposals.some((p) => p.id === proposal.id));
    return [...storedProposals, ...mockOnly];
  })();

  const actorId = req.session?.user?.personalId || req.headers['x-user-id'] || req.session?.user?.id || 'unknown';
  const traceRun = startTraceRun({
    source: 'auto-improve.proposals',
    goal: 'Collect Auto-Improve proposals',
    metadata: {
      storedCount: storedProposals.length,
      mockFallback: storedProposals.length === 0,
      query: req.query || {}
    },
    actor: actorId
  });

  const traceRunId = traceRun.runId;

  let proposals = { success: true, data: [] };

  try {
    appendTraceEvent(traceRunId, {
      type: 'PLAN',
      message: 'Fetching proposals from AI service',
      metadata: {
        storedFallback: storedProposals.length,
        combinedFallback: combinedLocalProposals.length
      }
    });

    // First try to get existing proposals with proper service token
    const serviceToken = generateServiceToken();
    appendTraceEvent(traceRunId, {
      type: 'THOUGHT',
      message: 'Requesting latest proposals',
      metadata: { endpoint: '/api/ai/autoimprove/proposals' }
    });

    const aiRequestMeta = {
      method: 'GET',
      endpoint: `${AI_SERVICE_URL}/api/ai/autoimprove/proposals`
    };

    appendTraceEvent(traceRunId, {
      type: 'TOOL_CALL',
      tool: 'ai-service',
      message: 'Fetching proposals',
      metadata: aiRequestMeta
    });

    const aiResponseHeaders = {
      'Content-Type': 'application/json',
      'x-correlation-id': `backend_${Date.now()}`,
      'x-service-client': 'backend-auto-improve'
    };

    if (serviceToken) {
      aiResponseHeaders.Authorization = `Bearer ${serviceToken}`;
    }

    if (req.headers.authorization) {
      aiResponseHeaders['x-forwarded-authorization'] = req.headers.authorization;
    }

    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/autoimprove/proposals`, {
      method: 'GET',
      headers: aiResponseHeaders,
      timeout: 10000
    });

    appendTraceEvent(traceRunId, {
      type: 'OBSERVATION',
      level: aiResponse.ok ? 'info' : 'warn',
      message: `AI service responded with ${aiResponse.status}`,
      metadata: { status: aiResponse.status }
    });

    if (aiResponse.ok) {
      proposals = await aiResponse.json();
      console.log(`✅ [AUTO-IMPROVE] Fetched ${proposals.data?.length || 0} existing proposals from AI service`);
    } else if (aiResponse.status !== 429) { // Skip generation on rate limit
      console.log('⚠️ [AUTO-IMPROVE] No existing proposals from AI service, generating new ones...');
      appendTraceEvent(traceRunId, {
        type: 'THOUGHT',
        level: 'warn',
        message: 'Fallback to proposal generation',
        metadata: { reason: `status_${aiResponse.status}` }
      });

      // Generate new proposals if none exist and not rate limited
      appendTraceEvent(traceRunId, {
        type: 'TOOL_CALL',
        tool: 'ai-service',
        message: 'Triggering proposal generation',
        metadata: {
          method: 'POST',
          endpoint: `${AI_SERVICE_URL}/api/ai/autoimprove/generate-proposals`
        }
      });

      const generateResponse = await fetch(`${AI_SERVICE_URL}/api/ai/autoimprove/generate-proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
          'x-service-token': serviceToken,
          'x-correlation-id': `backend_gen_${Date.now()}`
        },
        timeout: 15000
      });

      appendTraceEvent(traceRunId, {
        type: 'OBSERVATION',
        level: generateResponse.ok ? 'info' : 'error',
        message: `Generation response ${generateResponse.status}`,
        metadata: { status: generateResponse.status }
      });

      if (generateResponse.ok) {
        const generatedData = await generateResponse.json();
        proposals = {
          success: true,
          data: generatedData.proposals || [],
          message: 'New proposals generated by AI service'
        };
        console.log(`🆕 [AUTO-IMPROVE] Generated ${proposals.data.length} new proposals`);
      } else {
        console.error(`❌ [AUTO-IMPROVE] Failed to generate proposals: ${generateResponse.status} ${generateResponse.statusText}`);
        proposals = {
          success: false,
          error: 'Failed to generate proposals',
          message: `AI service error: ${generateResponse.statusText}`
        };
      }
    }

  // Convert analysis results to proposals format
  const analysisProposals = proposals.data.map((result, index) => {
    const kpiKey = result.kpiKey || 'autoimprove:analysis';
    const memoryContext = featureFlags.memoryEnabled
      ? (Array.isArray(result.memoryContext) && result.memoryContext.length > 0
        ? result.memoryContext
        : getRecentSimilarHistory(kpiKey, 5))
      : [];

    return {
      id: result.id || `ai_prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: result.title || 'Untitled AI Proposal',
      description: result.description || 'No description provided.',
      summary: result.summary || 'No summary provided.',
      status: result.status || 'pending',
      severity: result.severity || 'P3',
      type: result.type || 'general',
      createdAt: result.createdAt || new Date().toISOString(),
      source: result.source || 'ai-service',
      aiGenerated: true,
      correlationId: result.correlationId || `analysis_${Date.now()}_${index}`,
      kpiKey,
      routeDecision: result.routeDecision || 'analysis',
      modelUsed: result.modelUsed || 'llama3-8b-8192',
      memoryContext,
      evidence: result.evidence || [],
      files: result.files || [],
      impact: result.impact || { perf: 'none', readability: 'none', security: 'none', risk: 'low' },
      tests: result.tests || { tsc: 'unknown', eslint: 'unknown', build: 'unknown', unit: 'unknown' },
      timeline: result.timeline || [],
      scope: result.scope || ['unknown'],
      autoApplied: result.autoApplied || false,
      guardReason: result.guardReason || null,
      rollbackAvailable: result.rollbackAvailable || false,
      statusHistory: result.statusHistory || [{ status: result.status || 'pending', at: new Date().toISOString() }]
    };
  });

  // Combine stored proposals with analysis proposals
  const allProposals = [...combinedLocalProposals, ...analysisProposals];

  console.log(`📊 [AUTO-IMPROVE] Returning ${allProposals.length} proposals (${combinedLocalProposals.length} stored+mock + ${analysisProposals.length} from AI service)`);

  // Apply risk classification to each proposal
  if (allProposals.length > 0) {
    const classifiedProposals = await Promise.all(allProposals.map(async (proposal) => {
      try {
        // Use the shared risk classifier instance for consistent behaviour
        const riskAnalysis = riskClassifier.classifyRisk(proposal);
        const autoApplyCheck = riskClassifier.checkAutoApplyEligibility(riskAnalysis);
        const badgeData = riskClassifier.getRiskBadgeData(riskAnalysis);

        return {
          ...proposal,
          risk: {
            level: riskAnalysis.level,
            score: riskAnalysis.score,
            reasons: riskAnalysis.reasons,
            factors: riskAnalysis.factors,
            badge: badgeData
          },
          autoApplyEligible: autoApplyCheck.eligible,
          guardReason: autoApplyCheck.eligible ? null : autoApplyCheck.reason // Ensure guardReason is set if not eligible
        };
      } catch (error) {
        console.error(`❌ [RISK] Failed to classify ${proposal.id}:`, error);
        // Return proposal with error details if classification fails
        return {
          ...proposal,
          risk: {
            level: 'unknown',
            score: -1,
            reasons: ['Classification failed'],
            factors: { error: error.message },
            badge: { color: 'gray', text: '?' }
          },
          autoApplyEligible: false,
          guardReason: 'risk-classification-failed'
        };
      }
    }));
    const summaryMetrics = {
      total: classifiedProposals.length,
      generated: analysisProposals.length,
      stored: combinedLocalProposals.length,
      fallbackUsed: proposals.success === false
    };

    appendTraceEvent(traceRunId, {
      type: 'FINAL',
      message: `Prepared ${summaryMetrics.total} proposals`,
      metadata: summaryMetrics
    });
    completeTraceRun(traceRunId, {
      status: 'completed',
      summary: `Delivered ${summaryMetrics.total} proposals`,
      metrics: summaryMetrics
    });

    return res.json({
      success: true,
      data: classifiedProposals,
      count: classifiedProposals.length,
      message: 'Proposals fetched successfully',
      timestamp: new Date().toISOString()
    });
  } else {
    const summaryMetrics = {
      total: 0,
      generated: analysisProposals.length,
      stored: combinedLocalProposals.length,
      fallbackUsed: proposals.success === false
    };

    appendTraceEvent(traceRunId, {
      type: 'FINAL',
      level: 'warn',
      message: 'No proposals available',
      metadata: summaryMetrics
    });
    completeTraceRun(traceRunId, {
      status: 'completed',
      summary: 'No proposals returned',
      metrics: summaryMetrics
    });

    return res.json({
      success: true,
      data: [],
      count: 0,
      message: 'No proposals found',
      timestamp: new Date().toISOString()
    });
  }
} catch (error) {
  console.error('❌ [AUTO-IMPROVE] List proposals error:', error);
  appendTraceEvent(traceRunId, {
    type: 'OBSERVATION',
    level: 'error',
    message: 'Proposals fetch failed',
    metadata: { message: error.message }
  });
  appendTraceEvent(traceRunId, {
    type: 'FINAL',
    level: 'error',
    message: 'Auto-Improve proposals request failed',
    metadata: { error: error.message }
  });
  completeTraceRun(traceRunId, {
    status: 'failed',
    summary: error.message,
    metrics: { stored: storedProposals.length }
  });

  res.status(500).json({
    success: false,
    error: 'Failed to fetch proposals',
    details: error.message
  });
}
});

// Create/Submit proposal endpoint - for AI service internal use
router.post('/proposals', requireInternalToken, protectAutoImprove, (req, res) => {
  try {
    console.log('📝 [AUTO-IMPROVE] Proposal submission from AI service');

    const proposal = req.body;

    const correlationId = proposal?.correlationId || req.headers['x-correlation-id'] || `cid_${Date.now()}`;
    const kpiKey = proposal?.kpiKey || req.body?.kpiKey || 'autoimprove:unknown';
    const routingMetadata = featureFlags.smartRouting
      ? determineSmartRouting(proposal)
      : {
          routeDecision: 'disabled',
          modelUsed: proposal?.modelUsed || 'llama3-8b-8192',
          complexityScore: 0,
          fileCount: Array.isArray(proposal?.files) ? proposal.files.length : 0,
          severity: proposal?.severity || 'unknown',
          riskLevel: proposal?.risk?.level || proposal?.risk || 'unknown'
        };

    const memoryContext = getRecentSimilarHistory(kpiKey, 5);

    const logger = req.logger || console;
    logger.info('🤖 [AUTO-IMPROVE][SmartRouting] decision captured', {
      correlationId,
      routeDecision: routingMetadata.routeDecision,
      modelUsed: routingMetadata.modelUsed,
      featureEnabled: featureFlags.smartRouting,
      complexityScore: routingMetadata.complexityScore,
      fileCount: routingMetadata.fileCount,
      severity: routingMetadata.severity,
      riskLevel: routingMetadata.riskLevel
    });

    // Add metadata
    const enhancedProposal = {
      ...proposal,
      id: `ai_prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      source: 'ai-enhanced-monitor',
      status: 'pending',
      aiGenerated: true,
      correlationId,
      kpiKey,
      routeDecision: routingMetadata.routeDecision,
      modelUsed: routingMetadata.modelUsed,
      memoryContext,
      statusHistory: [
        {
          status: 'pending',
          at: new Date().toISOString()
        }
      ],
      feedbackHistory: Array.isArray(proposal?.feedbackHistory) ? proposal.feedbackHistory : []
    };

    try {
      const storedProposals = loadStoredProposals();
      storedProposals.unshift(enhancedProposal);
      if (storedProposals.length > 50) {
        storedProposals.length = 50;
      }
      saveStoredProposals(storedProposals);
    } catch (error) {
      console.warn('⚠️ [AUTO-IMPROVE] Could not save proposal:', error.message);
    }

    console.log(`✅ [AUTO-IMPROVE] Proposal created and stored: ${enhancedProposal.id}`);

    res.json({
      success: true,
      data: enhancedProposal,
      message: 'Proposal created successfully'
    });

  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Proposal creation error:', error);
    res.status(500).json({
      success: false,
      error: 'PROPOSAL_CREATION_ERROR',
      message: error.message
    });
  }
});

// Apply proposal - SUPER_ADMIN only  
router.post('/proposals/:id/apply', requireSuperAdmin, async (req, res) => {
  try {
    const { id: proposalId } = req.params; // Use 'id' from params to match the route
    console.log(`🔧 [AUTO-IMPROVE] Applying proposal: ${proposalId}`);

    const { proposal } = findProposalById(proposalId);

    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    if (featureFlags.hitlApprovals && !['approved', 'edited'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        error: 'Proposal must be approved or edited before apply',
        proposalId
      });
    }

    // Log timeline event
    addTimelineEvent(proposalId, 'apply-started', 'განხორციელების პროცესი დაიწყო');

    // Development bypass
    const isDevelopment = process.env.NODE_ENV === 'development' ||
                         req.headers['x-dev-bypass'] === 'true';

    if (isDevelopment) {
      console.log('✅ [AUTO-IMPROVE] Development apply bypass activated');
      addTimelineEvent(proposalId, 'apply-bypass', 'Development bypass გააქტიურდა');
    }

    const applyTimestamp = new Date().toISOString();
    let feedbackRecord = null;

    const logger = req.logger || console;

    const updatedProposal = persistProposalUpdate(proposalId, (current) => {
      const next = { ...current };
      next.status = 'applied';
      next.appliedAt = applyTimestamp;
      next.statusHistory = Array.isArray(current.statusHistory)
        ? [...current.statusHistory, { status: 'applied', at: applyTimestamp }]
        : [{ status: 'applied', at: applyTimestamp }];

      if (featureFlags.feedbackLoop) {
        const baseline = Number(req.body?.kpiBaseline ?? current.kpiBaseline ?? 100);
        const observedFallback = baseline * (1 + (Math.random() - 0.5) / 4);
        const observed = Number(req.body?.kpiPostValue ?? current.kpiObserved ?? observedFallback);
        feedbackRecord = {
          ...evaluateKpiOutcome({ proposal: current, baseline, observed }),
          proposalId,
          recordedAt: applyTimestamp
        };
        next.feedbackHistory = Array.isArray(current.feedbackHistory)
          ? [feedbackRecord, ...current.feedbackHistory]
          : [feedbackRecord];
        next.lastKpiOutcome = feedbackRecord.outcome;
        next.kpiBaseline = feedbackRecord.baseline;
        next.kpiObserved = feedbackRecord.observed;
        if (feedbackRecord.rollbackRecommended) {
          next.rollbackAvailable = true;
          next.status = 'needs_rollback';
          next.statusHistory.push({ status: 'needs_rollback', at: applyTimestamp });
        }
      }

      return next;
    }) || proposal;

    if (feedbackRecord) {
      appendFeedbackHistory(feedbackRecord);
      addTimelineEvent(proposalId, 'feedback-recorded', `KPI outcome: ${feedbackRecord.outcome} (${feedbackRecord.delta}% delta)`);
      logger.info('📊 [AUTO-IMPROVE][FeedbackLoop] KPI outcome recorded', {
        correlationId: updatedProposal.correlationId,
        proposalId,
        outcome: feedbackRecord.outcome,
        delta: feedbackRecord.delta,
        rollbackRecommended: feedbackRecord.rollbackRecommended
      });

      if (feedbackRecord.rollbackRecommended) {
        addTimelineEvent(proposalId, 'rollback-recommended', 'Severe regression detected, rollback recommended');
        logger.warn('⚠️ [AUTO-IMPROVE][FeedbackLoop] Rollback recommended', {
          correlationId: updatedProposal.correlationId,
          proposalId,
          kpiKey: feedbackRecord.kpiKey,
          delta: feedbackRecord.delta
        });
      }
    }

    // Mock successful application
    addTimelineEvent(proposalId, 'apply-completed', 'წინადადება წარმატებით განხორციელდა');

    // Send notification for successful apply with proper error handling
    const notificationPromise = (async () => {
      try {
        if (updatedProposal) {
          await notificationHooks.notify('applied', {
            proposalId: updatedProposal.id,
            title: updatedProposal.title,
            summary: updatedProposal.summary,
            risk: updatedProposal.risk,
            files: updatedProposal.files,
            impact: updatedProposal.impact,
            correlationId: updatedProposal.correlationId || `cid_${Date.now()}_${updatedProposal.id}`
          });
          console.log(`✅ [NOTIFICATIONS] Applied notification sent for ${proposalId}`);
        }
      } catch (error) {
        console.error(`❌ [NOTIFICATIONS] Failed to send applied notification for ${proposalId}:`, error.message);
        // Don't let notification failures fail the entire apply operation
      }
    })();

    // Don't await notification - let it run in background
    notificationPromise.catch(err => {
      console.error(`⚠️ [NOTIFICATIONS] Background notification error for ${proposalId}:`, err.message);
    });

    // Mock implementation for development with proper status tracking
    const response = {
      success: true,
      proposalId,
      status: updatedProposal.status,
      message: 'Proposal applied successfully (mock)',
      timestamp: applyTimestamp,
      needsVerification: true,
      verificationUrl: `/api/ai/autoimprove/post-apply/verify`,
      changes: [
        {
          file: 'example.js',
          type: 'modified',
          lines: '+5/-2'
        }
      ],
      nextSteps: [
        'Post-apply verification will start automatically',
        'Check service health status',
        'Monitor logs for any issues'
      ],
      applyOutcome: feedbackRecord?.outcome || 'not-tracked'
    };

    logger.info('✅ [AUTO-IMPROVE] Apply completed', {
      correlationId: updatedProposal.correlationId,
      proposalId,
      applyOutcome: response.applyOutcome,
      status: response.status
    });

    console.log(`✅ [AUTO-IMPROVE] Apply completed for ${proposalId}, starting verification...`);

    // Trigger post-apply verification in background
    const verificationPromise = (async () => {
      try {
        // Wait a moment for apply to settle
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`🔍 [AUTO-IMPROVE] Starting post-apply verification for ${proposalId}`);
        addTimelineEvent(proposalId, 'verification-started', 'Post-apply verification დაიწყო');

        // Mock verification success after short delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        addTimelineEvent(proposalId, 'verification-completed', 'Post-apply verification წარმატებით დასრულდა');

        console.log(`✅ [AUTO-IMPROVE] Verification completed for ${proposalId}`);
      } catch (verificationError) {
        console.error(`❌ [AUTO-IMPROVE] Verification failed for ${proposalId}:`, verificationError.message);
        addTimelineEvent(proposalId, 'verification-failed', `Verification ვერ მოხერხდა: ${verificationError.message}`);
      }
    })();

    // Don't await verification - let it run in background
    verificationPromise.catch(err => {
      console.error(`⚠️ [AUTO-IMPROVE] Background verification error for ${proposalId}:`, err.message);
    });

    res.json(response);

  } catch (err) {
    console.error(`❌ [AUTO-IMPROVE] Apply failed for ${req.params.id}:`, err);
    addTimelineEvent(req.params.id, 'apply-failed', `განხორციელება ვერ მოხერხდა: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: String(err && err.message || err),
      proposalId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

// Rollback proposal endpoint - SUPER_ADMIN only
router.post('/:proposalId/rollback', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    console.log(`🔄 [AUTO-IMPROVE] Rolling back proposal: ${proposalId}`);

    // Development bypass
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         req.headers['x-dev-bypass'] === 'true';

    if (isDevelopment) {
      console.log('✅ [AUTO-IMPROVE] Development rollback bypass activated');
    }

    // Send notification for rollback completion
    try {
      const proposal = mockProposals.find(p => p.id === proposalId); // Assuming proposal data is available
      if (proposal) {
        await notificationHooks.notify('rollback_done', {
          proposalId: proposal.id,
          title: proposal.title,
          summary: proposal.summary,
          risk: proposal.risk,
          files: proposal.files,
          impact: proposal.impact,
          correlationId: `cid_${Date.now()}_${proposal.id}`
        });
      }
    } catch (error) {
      console.error(`❌ [NOTIFICATIONS] Failed to send rollback_done notification for ${proposalId}:`, error);
    }

    // Mock implementation for development
    res.json({
      success: true,
      proposalId,
      status: 'rolled_back',
      message: 'Proposal rolled back successfully (mock)',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
});

// Approve proposal endpoint - SUPER_ADMIN only
router.post('/proposals/:proposalId/approve', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { userId, dryRunPassed } = req.body;

    console.log(`✅ [AUTO-IMPROVE] Approving proposal: ${proposalId}`);
    addTimelineEvent(proposalId, 'approval-started', 'დამტკიცების პროცესი დაიწყო');

    // Get the proposal (in real system, fetch from database)
    const { proposal } = findProposalById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found',
        proposalId: proposalId
      });
    }

    // Check if proposal was already applied
    if (proposal.status === 'applied') {
      return res.status(400).json({
        success: false,
        error: 'Proposal already applied',
        proposalId: proposalId
      });
    }

    // SOL-242: AI Guard validation with enhanced blocking and UI alerts
    const fileOperations = (proposal.files || []).map(file => ({
      filePath: file.path,
      operation: 'modify'
    }));

    const guardValidation = await aiGuardInstance.validateBatch(fileOperations);

    if (guardValidation.hasViolations) {
      console.log('🚫 [AI GUARD] Blocking proposal due to guard violations');

      // Log audit entry for blocked action
      addTimelineEvent(proposalId, 'guard-blocked', 'AI Guard blocked proposal due to file protection rules');

      // Collect UI alerts for frontend display
      const uiAlerts = guardValidation.results
        .filter(r => !r.validation.allowed && r.validation.uiAlert)
        .map(r => r.validation.uiAlert);

      return res.status(403).json({
        success: false,
        error: 'Proposal blocked by AI Guard',
        guardViolations: guardValidation.results.filter(r => !r.validation.allowed),
        guardSummary: guardValidation.summary,
        auditType: 'guard-blocked',
        proposalId: proposalId,
        uiAlerts: uiAlerts,
        blockedFiles: guardValidation.results
          .filter(r => !r.validation.allowed)
          .map(r => ({
            filePath: r.filePath,
            level: r.validation.level,
            reason: r.validation.message
          }))
      });
    }

    // Risk analysis
    const riskAnalysis = riskClassifier.classifyRisk(proposal);
    const autoApplyCheck = riskClassifier.checkAutoApplyEligibility(riskAnalysis); // Corrected variable name

    // Guard against high-risk operations
    if (!autoApplyCheck.eligible) {
      return res.status(400).json({
        success: false,
        error: 'High-risk proposal cannot be auto-applied',
        reason: autoApplyCheck.guardReason,
        risk: riskAnalysis,
        proposalId: proposalId
      });
    }

    addTimelineEvent(proposalId, 'risk-validated', `რისკის დონე: ${riskAnalysis.level} (${riskAnalysis.score} ქულა)`);

    const approvedAt = new Date().toISOString();
    const updatedProposal = persistProposalUpdate(proposalId, (current) => {
      const next = { ...current };
      next.status = 'approved';
      next.approvedAt = approvedAt;
      next.statusHistory = Array.isArray(current.statusHistory)
        ? [...current.statusHistory, { status: 'approved', at: approvedAt }]
        : [{ status: 'approved', at: approvedAt }];
      return next;
    }) || proposal;

    addTimelineEvent(proposalId, 'approved', `წინადადება დამტკიცდა მომხმარებლის ${userId} მიერ`);

    const logger = req.logger || console;
    logger.info('✅ [AUTO-IMPROVE][HITL] Proposal approved', {
      proposalId,
      correlationId: updatedProposal?.correlationId,
      userId
    });

    res.json({
      success: true,
      proposalId,
      status: updatedProposal.status,
      message: 'Proposal approved successfully',
      timestamp: approvedAt,
      needsVerification: false
    });

  } catch (err) {
    console.error('❌ [AUTO-IMPROVE] Approval error:', err);
    addTimelineEvent(proposalId, 'approval-failed', `დამტკიცება ვერ მოხერხდა: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'დამტკიცების შეცდომა',
      details: err.message 
    });
  }
});

router.post('/proposals/:proposalId/reject', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { reason = 'Manual rejection' } = req.body || {};

    const { proposal } = findProposalById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    const rejectedAt = new Date().toISOString();
    const updatedProposal = persistProposalUpdate(proposalId, (current) => {
      const next = { ...current };
      next.status = 'declined';
      next.rejectedAt = rejectedAt;
      next.rejectionReason = reason;
      next.statusHistory = Array.isArray(current.statusHistory)
        ? [...current.statusHistory, { status: 'declined', at: rejectedAt, reason }]
        : [{ status: 'declined', at: rejectedAt, reason }];
      return next;
    }) || proposal;

    addTimelineEvent(proposalId, 'declined', `წინადადება უარყო ადმინმა: ${reason}`);

    const logger = req.logger || console;
    logger.warn('🚫 [AUTO-IMPROVE][HITL] Proposal declined', {
      proposalId,
      correlationId: updatedProposal?.correlationId,
      reason
    });

    res.json({
      success: true,
      proposalId,
      status: updatedProposal.status,
      message: 'Proposal declined',
      timestamp: rejectedAt,
      reason
    });
  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Reject error:', error);
    res.status(500).json({
      success: false,
      error: 'Proposal rejection failed',
      details: error.message
    });
  }
});

router.post('/proposals/:proposalId/request-edit', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { note = 'Edit requested by reviewer' } = req.body || {};

    const { proposal } = findProposalById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    const editedAt = new Date().toISOString();
    const updatedProposal = persistProposalUpdate(proposalId, (current) => {
      const next = { ...current };
      next.status = 'edited';
      next.editNote = note;
      next.editedAt = editedAt;
      next.statusHistory = Array.isArray(current.statusHistory)
        ? [...current.statusHistory, { status: 'edited', at: editedAt, note }]
        : [{ status: 'edited', at: editedAt, note }];
      return next;
    }) || proposal;

    addTimelineEvent(proposalId, 'edit-requested', `განახლება მოთხოვნილია: ${note}`);

    const logger = req.logger || console;
    logger.info('✏️ [AUTO-IMPROVE][HITL] Edit requested', {
      proposalId,
      correlationId: updatedProposal?.correlationId,
      note
    });

    res.json({
      success: true,
      proposalId,
      status: updatedProposal.status,
      message: 'Edit requested successfully',
      timestamp: editedAt,
      note
    });
  } catch (error) {
    console.error('❌ [AUTO-IMPROVE] Edit request error:', error);
    res.status(500).json({
      success: false,
      error: 'Proposal edit request failed',
      details: error.message
    });
  }
});

// Metrics endpoint for AutoImprove history
router.get('/metrics', async (req, res) => {
  try {
    const { timeRange = '30d', scope = 'all' } = req.query;
    console.log(`🔍 [AUTO-IMPROVE] მეტრიკების მოთხოვნა: timeRange=${timeRange}, scope=${scope}`);

    // Development bypass
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         req.headers['x-dev-bypass'] === 'true';

    if (isDevelopment) {
      console.log('✅ [AUTO-IMPROVE] Development metrics bypass activated');
    }

    // Calculate time range in milliseconds
    const timeRangeMs = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    };

    const rangeMs = timeRangeMs[timeRange] || timeRangeMs['30d'];
    const fromDate = new Date(Date.now() - rangeMs);
    const toDate = new Date();

    // Mock metrics calculation for development
    const mockMetrics = {
      approvalRate: 82.4 + Math.random() * 10,
      rollbackRate: 8.5 + Math.random() * 8,
      avgDryRunTime: 35 + Math.random() * 20,
      avgApplyTime: 105 + Math.random() * 50,
      last7Days: {
        successes: Math.floor(15 + Math.random() * 15),
        failures: Math.floor(2 + Math.random() * 8)
      },
      scopeBreakdown: {
        backend: scope === 'backend' ? Math.floor(25 + Math.random() * 30) : Math.floor(10 + Math.random() * 20),
        frontend: scope === 'frontend' ? Math.floor(25 + Math.random() * 30) : Math.floor(8 + Math.random() * 15),
        security: scope === 'security' ? Math.floor(25 + Math.random() * 30) : Math.floor(5 + Math.random() * 10),
        performance: scope === 'performance' ? Math.floor(25 + Math.random() * 30) : Math.floor(12 + Math.random() * 18)
      },
      timeRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      }
    };

    // SOL-242: AI Guard statistics
    mockMetrics.guard = aiGuardInstance.getStats();

    res.json({
      success: true,
      metrics: mockMetrics,
      message: 'AutoImprove metrics retrieved successfully',
      timestamp: new Date().toISOString(),
      service: 'backend'
    });

  } catch (err) {
    console.error('❌ [AUTO-IMPROVE] Metrics error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'მეტრიკების ჩატვირთვის შეცდომა',
      details: err.message 
    });
  }
});

router.get('/feature-flags', requireSuperAdmin, (req, res) => {
  const payload = {
    success: true,
    featureFlags: {
      AI_SMART_ROUTING: {
        enabled: featureFlags.smartRouting,
        howToEnable: 'Set AI_SMART_ROUTING=true (or false) and rebuild the admin UI'
      },
      AI_HITL_APPROVALS: {
        enabled: featureFlags.hitlApprovals,
        howToEnable: 'Set AI_HITL_APPROVALS=true to require approvals before apply'
      },
      AI_FEEDBACK_LOOP: {
        enabled: featureFlags.feedbackLoop,
        howToEnable: 'Set AI_FEEDBACK_LOOP=true to monitor KPIs after apply'
      },
      AI_MEMORY_ENABLED: {
        enabled: featureFlags.memoryEnabled,
        howToEnable: 'Set AI_MEMORY_ENABLED=true to preload proposal memory context'
      }
    },
    thresholds: {
      smartRoutingFileThreshold: SMART_ROUTING_FILE_THRESHOLD,
      smartRoutingRiskLevels: SMART_ROUTING_RISK_LEVELS,
      kpiImprovementThreshold: KPI_IMPROVEMENT_THRESHOLD,
      kpiRegressionThreshold: KPI_REGRESSION_THRESHOLD,
      kpiSevereRegressionThreshold: KPI_SEVERE_REGRESSION_THRESHOLD
    },
    rebuildNotice: 'Configuration changes require server restart and admin UI rebuild.'
  };

  const logger = req.logger || console;
  logger.info('🧩 [AUTO-IMPROVE] Feature flags snapshot requested', payload);

  res.json({
    ...payload,
    timestamp: new Date().toISOString()
  });
});

// SOL-242: AI Guard audit log
router.get('/guard/audit', requireSuperAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const auditLog = aiGuardInstance.getAuditLog(limit);

    res.json({
      success: true,
      auditLog: auditLog,
      total: auditLog.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AI GUARD] Audit log error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit log',
      message: error.message
    });
  }
});

// SOL-242: AI Guard configuration
router.get('/guard/config', requireSuperAdmin, async (req, res) => {
  try {
    const config = aiGuardInstance.getConfig();

    res.json({
      success: true,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AI GUARD] Config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

// SOL-242: Test file against guard rules
router.post('/guard/validate', requireSuperAdmin, async (req, res) => {
  try {
    const { filePath, operation = 'modify' } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }

    const validation = await aiGuardInstance.validateFileOperation(filePath, operation);

    res.json({
      success: true,
      validation: validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AI GUARD] Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate file',
      message: error.message
    });
  }
});

// Timeline logging helper function
// Service token generation function
function generateServiceToken() {
  try {
    return createServiceToken({
      svc: 'backend-auto-improve',
      service: 'backend-auto-improve',
      permissions: ['chat', 'models', 'proposals', 'auto_improve'],
      role: 'SYSTEM_BOT'
    });
  } catch (error) {
    console.warn('⚠️ [AUTO-IMPROVE] Service token generation failed', { message: error.message });
    return null;
  }
}

function addTimelineEvent(proposalId, type, message) {
  // In real implementation, this would update the proposal in database
  console.log(`📅 [TIMELINE] ${proposalId}: ${type} - ${message}`);
  return {
    ts: Math.floor(Date.now() / 1000),
    type,
    message
  };
}

module.exports = router;
module.exports.__testables = {
  determineSmartRouting,
  evaluateKpiOutcome,
  featureFlags,
  loadStoredProposals,
  saveStoredProposals,
  getRecentSimilarHistory,
  appendFeedbackHistory,
  findProposalById,
  persistProposalUpdate,
  protectAutoImprove
};

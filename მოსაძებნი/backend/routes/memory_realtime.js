
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const clients = new Set();
const MAX_RECENT_ERRORS = 100;
const recentErrors = [];

function send(event, data) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

function storeRecentError(error) {
  recentErrors.unshift(error);
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.length = MAX_RECENT_ERRORS;
  }
}

function broadcastError(error) {
  storeRecentError(error);
  send('memory-error', { error });
}

router.get('/realtime-errors', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders?.();

  // initial heartbeat
  res.write(`event: heartbeat\ndata: {"ok":true}\n\n`);
  clients.add(res);

  // keepalive heartbeat every 25s
  const iv = setInterval(() => {
    try { res.write(`event: heartbeat\ndata: {"ok":true}\n\n`); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(iv);
    clients.delete(res);
  });
});

// Debug endpoint - development only for security
if (process.env.NODE_ENV !== 'production') {
  router.post('/_debug/emit-error', (req, res) => {
  try {
    const { code = 'TEST_ERR', message = 'test error', level = 'error' } = req.body || {};
    const item = { 
      id: Date.now(), 
      ts: Date.now(), 
      code, 
      message, 
      level,
      timestamp: new Date().toISOString()
    };
    
    // Emit to SSE clients
    broadcastError(item);
    
    console.log('🐛 [DEBUG] Emitted test error:', item);
    
    res.json({ 
      success: true, 
      ok: true, 
      emitted: item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Debug emit error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to emit debug error',
      details: error.message 
    });
  }
  });
} else {
  // Production: Debug endpoint disabled, but secure production endpoint available
  router.post('/_debug/emit-error', (req, res) => {
    res.status(404).json({ 
      success: false, 
      error: 'Debug endpoints are disabled in production',
      timestamp: new Date().toISOString()
    });
  });
}

// Production-ready error ingestion endpoint with service authentication
router.post('/errors', (req, res) => {
  // Service-to-service authentication check (always enforced)
  const serviceToken = req.headers['x-service-token'] || req.headers['authorization'];
  const expectedToken = process.env.AI_SERVICE_TOKEN;
  
  // Mandatory service token in production - fail if missing
  if (process.env.NODE_ENV === 'production' && !expectedToken) {
    console.error('❌ CRITICAL: AI_SERVICE_TOKEN missing in production environment');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: Service token not configured',
      timestamp: new Date().toISOString()
    });
  }
  
  // Always require authentication for production ingestion endpoint
  const requireAuth = process.env.NODE_ENV === 'production';
  
  // Timing-safe token comparison for security
  let tokenMatches = false;
  if (expectedToken && serviceToken && expectedToken.length === serviceToken.length) {
    try {
      tokenMatches = crypto.timingSafeEqual(
        Buffer.from(serviceToken, 'utf8'),
        Buffer.from(expectedToken, 'utf8')
      );
    } catch (error) {
      tokenMatches = false; // Comparison failed
    }
  }
    
  if (requireAuth && !tokenMatches) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid service token required for error ingestion',
      timestamp: new Date().toISOString()
    });
  }
  try {
    const { 
      code = 'PROD_ERROR', 
      message = 'Production error', 
      level = 'error',
      georgian_message,
      english_message,
      suggestions,
      recovery,
      context,
      emoji
    } = req.body || {};
    
    // Create error item for SSE broadcast with full i18n support
    const item = { 
      id: Date.now(), 
      ts: Date.now(), 
      code, 
      message, 
      level,
      georgian_message,
      english_message,
      suggestions,
      recovery,
      context,
      emoji,
      timestamp: new Date().toISOString(),
      source: 'production'
    };
    
    // Emit to SSE clients
    broadcastError(item);
    
    console.log('🏭 [PRODUCTION] Georgian error emitted:', item);
    
    res.json({ 
      success: true, 
      ok: true, 
      emitted: item,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Production error emit failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to emit production error',
      details: error.message 
    });
  }
});

router.get('/errors', (req, res) => {
  try {
    res.json({
      success: true,
      data: recentErrors.map((error) => ({ ...error }))
    });
  } catch (error) {
    console.error('❌ Failed to return recent errors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent errors',
      details: error.message
    });
  }
});

module.exports = router;

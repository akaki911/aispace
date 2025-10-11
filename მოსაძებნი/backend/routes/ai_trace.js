const express = require('express');
const { requireSuperAdmin } = require('../middleware/admin_guards');
const {
  startTraceRun,
  appendTraceEvent,
  completeTraceRun,
  registerClient,
  getRecentRuns,
  getRun,
  sanitizePayload
} = require('../services/ai_trace_hub');

const router = express.Router();

router.post('/start', requireSuperAdmin, (req, res) => {
  try {
    const { goal, inputs, metadata, source, actor, runId } = req.body || {};
    const run = startTraceRun({
      goal: goal || null,
      inputs: sanitizePayload(inputs),
      metadata: sanitizePayload(metadata),
      source: source || 'manual',
      actor: actor || (req.session?.user?.personalId || req.session?.user?.id || 'unknown'),
      runId
    });

    res.json({ success: true, run });
  } catch (error) {
    console.error('❌ [AI Trace] Failed to start run:', error);
    res.status(500).json({ success: false, error: 'failed_to_start', message: error.message });
  }
});

router.post('/event', requireSuperAdmin, (req, res) => {
  try {
    const { runId, type, level, message, tool, status, metadata } = req.body || {};
    if (!runId) {
      return res.status(400).json({ success: false, error: 'missing_run_id' });
    }

    const event = appendTraceEvent(runId, {
      type,
      level,
      message,
      tool,
      status,
      metadata
    });

    res.json({ success: true, event });
  } catch (error) {
    console.error('❌ [AI Trace] Failed to append event:', error);
    res.status(500).json({ success: false, error: 'failed_to_append', message: error.message });
  }
});

router.post('/final', requireSuperAdmin, (req, res) => {
  try {
    const { runId, status, summary, metrics } = req.body || {};
    if (!runId) {
      return res.status(400).json({ success: false, error: 'missing_run_id' });
    }

    const run = completeTraceRun(runId, {
      status,
      summary,
      metrics
    });

    res.json({ success: true, run });
  } catch (error) {
    console.error('❌ [AI Trace] Failed to finalize run:', error);
    res.status(500).json({ success: false, error: 'failed_to_finalize', message: error.message });
  }
});

router.get('/runs', requireSuperAdmin, (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const runs = getRecentRuns(limit);
    res.json({ success: true, runs });
  } catch (error) {
    console.error('❌ [AI Trace] Failed to fetch runs:', error);
    res.status(500).json({ success: false, error: 'failed_to_fetch', message: error.message });
  }
});

router.get('/runs/:runId', requireSuperAdmin, (req, res) => {
  try {
    const run = getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    res.json({ success: true, run });
  } catch (error) {
    console.error('❌ [AI Trace] Failed to fetch run:', error);
    res.status(500).json({ success: false, error: 'failed_to_fetch', message: error.message });
  }
});

router.get('/stream', requireSuperAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const runId = typeof req.query.runId === 'string' && req.query.runId.trim() !== ''
    ? req.query.runId.trim()
    : null;

  registerClient(res, runId);
});

module.exports = router;

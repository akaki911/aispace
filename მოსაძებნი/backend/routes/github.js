const express = require('express');
const router = express.Router();

const githubIntegration = require('../services/githubIntegration');
const requireAdminSetupToken = require('../middleware/requireAdminSetupToken');

const buildErrorResponse = (error) => {
  const status = error.status || error.statusCode || error.response?.status || 500;
  const message = error.message || 'GitHub integration error';
  return { status, body: { connected: false, error: message } };
};

const resolveSessionKey = (req) => {
  if (req.user?.id) return req.user.id;
  if (req.user?.uid) return req.user.uid;
  if (req.session?.userId) return req.session.userId;
  if (req.sessionID) return req.sessionID;
  if (typeof req.headers['x-session-key'] === 'string') return req.headers['x-session-key'];
  return undefined;
};

router.get('/status', requireAdminSetupToken, async (req, res) => {
  try {
    if (!githubIntegration.isIntegrationEnabled()) {
      return res.json({ connected: false, integrationDisabled: true });
    }

    const sessionKey = resolveSessionKey(req);
    const status = await githubIntegration.getStatus(sessionKey);
    return res.json(status);
  } catch (error) {
    console.error('❌ GitHub status error:', error.message || error);
    const { status, body } = buildErrorResponse(error);
    return res.status(status).json(body);
  }
});

router.post('/connect', requireAdminSetupToken, async (req, res) => {
  try {
    if (!githubIntegration.isIntegrationEnabled()) {
      return res.json({ connected: false, integrationDisabled: true });
    }

    const repoUrl = req.body?.repoUrl;
    const token = req.body?.token;
    const sessionKey = resolveSessionKey(req);
    const result = await githubIntegration.connect({ repoUrl, token, sessionKey });
    return res.json(result);
  } catch (error) {
    console.error('❌ GitHub connect route error:', error.message || error);
    const { status, body } = buildErrorResponse(error);
    return res.status(status).json(body);
  }
});

router.post('/disconnect', requireAdminSetupToken, async (req, res) => {
  try {
    if (!githubIntegration.isIntegrationEnabled()) {
      return res.json({ connected: false, integrationDisabled: true });
    }

    const sessionKey = resolveSessionKey(req);
    const result = await githubIntegration.disconnect(sessionKey);
    return res.json(result);
  } catch (error) {
    console.error('❌ GitHub disconnect error:', error.message || error);
    const { status, body } = buildErrorResponse(error);
    return res.status(status).json(body);
  }
});

router.post('/test', requireAdminSetupToken, async (req, res) => {
  try {
    if (!githubIntegration.isIntegrationEnabled()) {
      return res.json({ connected: false, integrationDisabled: true });
    }

    const sessionKey = resolveSessionKey(req);
    const status = await githubIntegration.getStatus(sessionKey);
    return res.json(status);
  } catch (error) {
    console.error('❌ GitHub test error:', error.message || error);
    const { status, body } = buildErrorResponse(error);
    return res.status(status).json(body);
  }
});

module.exports = router;

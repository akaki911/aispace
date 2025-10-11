const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { requireSuperAdmin } = require('../middleware/admin_guards');
const auditService = require('../services/audit_service');
const { getRuntimeConfig, setBackupMode } = require('../../ai-service/config/runtimeConfig');
const logger = require('../utils/logger');

let logBuffer;
try {
  ({ logBuffer } = require('./dev_console'));
} catch (error) {
  console.warn('⚠️ [AI ADMIN] Unable to attach dev console log buffer:', error.message);
  logBuffer = { entries: [] };
}

const router = express.Router();
const PROMPTS_PATH = path.join(__dirname, '..', 'data', 'ai_prompts.json');

const readPrompts = async () => {
  try {
    const content = await fs.readFile(PROMPTS_PATH, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('❌ [AI ADMIN] Failed to read prompts file:', error.message);
    }
  }

  return [];
};

const writePrompts = async (prompts) => {
  await fs.mkdir(path.dirname(PROMPTS_PATH), { recursive: true });
  await fs.writeFile(PROMPTS_PATH, JSON.stringify(prompts, null, 2), 'utf8');
};

const getRequestUser = (req) => ({
  id: req.session?.user?.id || req.user?.id || 'unknown',
  role: req.session?.user?.role || req.user?.role || 'unknown',
});

const formatErrorLogs = (limit = 50) => {
  if (!logBuffer?.entries) {
    return [];
  }

  return logBuffer.entries
    .filter((entry) => entry.level === 'error')
    .slice(-limit)
    .reverse()
    .map((entry) => {
      const ts = entry.ts || entry.timestamp || Date.now();
      const time = new Date(ts).toISOString();
      const source = entry.source ? `[${entry.source}] ` : '';
      return `${time} · ${source}${entry.message}`;
    });
};

router.use(requireSuperAdmin);

router.get('/error-logs', (_req, res) => {
  res.json({
    success: true,
    logs: formatErrorLogs(),
    generatedAt: new Date().toISOString(),
  });
});

router.get('/fallback', (_req, res) => {
  const runtime = getRuntimeConfig();
  const forced = process.env.FORCE_OPENAI_BACKUP === 'true';
  const provider = process.env.OPENAI_API_KEY || process.env.OPENAI_FALLBACK_KEY ? 'openai' : 'offline';

  res.json({
    success: true,
    backupMode: Boolean(runtime.backupMode) || forced,
    forced,
    provider,
    updatedAt: new Date().toISOString(),
  });
});

router.get('/prompts', async (_req, res) => {
  const prompts = await readPrompts();
  res.json({ success: true, prompts });
});

router.post('/prompts', async (req, res) => {
  try {
    const promptPayload = req.body || {};
    if (!promptPayload.id || typeof promptPayload.value !== 'string') {
      return res.status(400).json({ success: false, error: 'INVALID_PROMPT_PAYLOAD' });
    }

    const prompts = await readPrompts();
    const user = getRequestUser(req);
    const now = new Date().toISOString();
    const existingIndex = prompts.findIndex((prompt) => prompt.id === promptPayload.id);

    const storedPrompt = {
      ...promptPayload,
      updatedAt: now,
      updatedBy: user.id,
    };

    if (existingIndex >= 0) {
      prompts[existingIndex] = storedPrompt;
    } else {
      prompts.push(storedPrompt);
    }

    await writePrompts(prompts);

    await auditService.logSecurityEvent({
      action: 'AI_PROMPT_UPDATED',
      userId: user.id,
      role: user.role,
      req,
      details: {
        promptId: promptPayload.id,
        label: promptPayload.label || null,
        preview: promptPayload.value.slice(0, 140),
      },
    });

    res.json({ success: true, prompt: storedPrompt });
  } catch (error) {
    console.error('❌ [AI ADMIN] Failed to save prompt:', error);
    res.status(500).json({ success: false, error: 'PROMPT_SAVE_FAILED' });
  }
});

router.post('/keys/rotate', async (req, res) => {
  const user = getRequestUser(req);
  const newKey = `BKH-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;

  await auditService.logSecurityEvent({
    action: 'AI_KEY_ROTATED',
    userId: user.id,
    role: user.role,
    req,
    details: {
      keyPreview: `${newKey.substring(0, 8)}***`,
    },
  });

  res.json({ success: true, key: newKey, rotatedAt: new Date().toISOString() });
});

router.post('/backup', async (req, res) => {
  const user = getRequestUser(req);
  await auditService.logSecurityEvent({
    action: 'AI_BACKUP_TRIGGERED',
    userId: user.id,
    role: user.role,
    req,
    details: {
      context: 'manual',
    },
  });

  res.json({ success: true, message: 'Backup initiated', timestamp: new Date().toISOString() });
});

router.post('/restore', async (req, res) => {
  const user = getRequestUser(req);
  await auditService.logSecurityEvent({
    action: 'AI_RESTORE_TRIGGERED',
    userId: user.id,
    role: user.role,
    req,
    details: {
      context: 'manual',
    },
  });

  res.json({ success: true, message: 'Restore initiated', timestamp: new Date().toISOString() });
});

router.post('/fallback', async (req, res) => {
  const forced = process.env.FORCE_OPENAI_BACKUP === 'true';
  if (forced) {
    return res.status(409).json({ success: false, error: 'FALLBACK_FORCED' });
  }

  const enabled = Boolean(req.body?.enabled);
  const user = getRequestUser(req);
  const backupMode = setBackupMode(enabled);
  const provider = process.env.OPENAI_API_KEY || process.env.OPENAI_FALLBACK_KEY ? 'openai' : 'offline';
  const updatedAt = new Date().toISOString();

  logger.info('ai_admin.fallback_mode_updated', {
    corrId: req.headers['x-correlation-id'] || `admin_${Date.now().toString(36)}`,
    enabled: backupMode,
    userId: user.id,
  });

  await auditService.logSecurityEvent({
    action: 'AI_FALLBACK_TOGGLED',
    userId: user.id,
    role: user.role,
    req,
    details: {
      enabled: backupMode,
      provider,
    },
  });

  res.json({
    success: true,
    backupMode,
    provider,
    updatedAt,
  });
});

router.post('/users/:userId/ban', async (req, res) => {
  const targetUserId = req.params.userId;
  const user = getRequestUser(req);

  await auditService.logSecurityEvent({
    action: 'AI_USER_BANNED',
    userId: user.id,
    role: user.role,
    req,
    details: {
      targetUserId,
    },
  });

  res.json({ success: true, userId: targetUserId, bannedAt: new Date().toISOString() });
});

module.exports = router;

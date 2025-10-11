const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const secretsVault = require('../services/secretsVault');
const secretsScanner = require('../services/secretsScanner');
const auditService = require('../services/audit_service');
const { syncEnvFiles, rollbackEnvFiles, getSecretsTelemetry } = require('../services/secretsSyncService');
const { getRequiredSecrets } = require('../services/secretsRequiredService');
const secretsSyncQueue = require('../services/secretsSyncQueue');
const { requireSuperAdmin } = require('../middleware/admin_guards');

const getActorId = (req) => {
  const headerActor = req?.get?.('x-audit-actor-id') || req?.get?.('x-actor-id');
  if (headerActor) {
    return headerActor;
  }

  return (
    req?.session?.user?.id || req?.session?.userId || req?.session?.user?.personalId || 'unknown'
  );
};

const withCredentials = (req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
};

const preventCaching = (req, res, next) => {
  res.header('Cache-Control', 'no-store, max-age=0');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
};

const normalisePath = (input) => {
  if (!input) {
    return '/';
  }
  const trimmed = String(input).replace(/\/+$/g, '');
  return trimmed.length ? trimmed : '/';
};

const enforceSecretsAccess = (req, res, next) => {
  const isRequiredCheck = req.method === 'POST' && normalisePath(req.path) === '/required';
  const bypassToken = process.env.CI_SECRETS_CHECK_TOKEN;
  const providedToken = req.get('x-ci-secrets-token') || req.get('x-ci-required-token');

  if (isRequiredCheck && bypassToken && providedToken) {
    try {
      const expectedBuffer = Buffer.from(String(bypassToken));
      const providedBuffer = Buffer.from(String(providedToken));

      if (
        expectedBuffer.length === providedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        const allowedPersonalId = process.env.ADMIN_ALLOWED_PERSONAL_ID || '01019062020';
        req.session = req.session || {};
        req.session.user = {
          ...(req.session.user || {}),
          role: 'SUPER_ADMIN',
          personalId: req.session?.user?.personalId || allowedPersonalId,
          id: req.session?.user?.id || allowedPersonalId,
        };

        if (!req.get('x-audit-actor-id')) {
          req.headers['x-audit-actor-id'] = 'ci-required-check';
        }
      }
    } catch (error) {
      console.warn('⚠️ [SecretsAPI] CI bypass token verification failed:', error.message);
    }
  }

  return requireSuperAdmin(req, res, next);
};

const compactObject = (input) => {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
  );
};

const summariseRecordForAudit = (record) => {
  if (!record) return null;
  const rawSummary = {
    visibility: record.visibility ?? null,
    source: record.source ?? null,
    required: record.required !== undefined ? Boolean(record.required) : undefined,
    hasValue:
      record.valueEncrypted !== undefined
        ? Boolean(record.valueEncrypted)
        : record.hasValue !== undefined
          ? Boolean(record.hasValue)
          : undefined,
  };

  const summary = compactObject(rawSummary);
  return Object.keys(summary).length > 0 ? summary : null;
};

const describeValueChange = (value, { beforeHasValue, afterHasValue } = {}) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return compactObject({ operation: 'cleared', from: beforeHasValue, to: false });
  }

  return compactObject({
    operation: 'set',
    length: String(value).length,
    from: beforeHasValue,
    to: afterHasValue,
  });
};

const summariseSyncServicesForAudit = (services) =>
  Object.fromEntries(
    Object.entries(services).map(([service, info]) => [
      service,
      {
        status: info.status,
        missingCount: info.missingKeys.length,
        updatedCount: info.updatedKeys.length,
        changed: Boolean(info.changed),
      },
    ]),
  );

const summariseRollbackServicesForAudit = (services) =>
  Object.fromEntries(
    Object.entries(services).map(([service, info]) => [
      service,
      {
        restored: Boolean(info.restored),
        status: info.restored ? 'restored' : info.reason || 'skipped',
      },
    ]),
  );

router.use(withCredentials);
router.use(preventCaching);
router.use(enforceSecretsAccess);

const handleError = (res, error) => {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    DUPLICATE: 409,
    NOT_FOUND: 404,
    AUTH_ERROR: 403,
    FORBIDDEN: 403,
  };

  const status = statusByCode[error.code] || (error.code === 'CONFIG_ERROR' ? 500 : 500);
  const payload = {
    success: false,
    error: status === 500 ? 'Internal server error' : error.message,
    code: error.code || 'UNEXPECTED',
  };

  if (status === 500) {
    payload.details = {
      reason: error.code === 'CONFIG_ERROR' ? error.message : 'Unexpected failure',
    };
  }

  const logPayload = {
    message: error?.message || 'Unexpected error',
    code: error?.code || 'UNEXPECTED',
    status,
  };

  if (error?.stack && process.env.NODE_ENV !== 'production') {
    logPayload.stack = error.stack
      .split('\n')
      .slice(0, 5)
      .join('\n');
  }

  console.error('❌ [SecretsAPI]', logPayload);
  return res.status(status).json(payload);
};

router.get('/list', (req, res) => {
  try {
    const { page, pageSize, search } = req.query;
    const data = secretsVault.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      search,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/create', async (req, res) => {
  try {
    const { key, value, visibility = 'hidden', source = 'app', required = false } = req.body || {};
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();

    const desiredVisibility = visibility === 'visible' ? 'visible' : 'hidden';
    const result = await secretsVault.create({
      key,
      value,
      visibility: desiredVisibility,
      source,
      createdBy: actorId,
      required,
    });

    await secretsSyncQueue.add(key);

    const afterSummary = summariseRecordForAudit(result);
    const diffMeta = {
      before: null,
      after: afterSummary,
      changes: compactObject({
        value: describeValueChange(value, {
          beforeHasValue: false,
          afterHasValue: Boolean(afterSummary?.hasValue),
        }),
        visibility: afterSummary?.visibility ? { to: afterSummary.visibility } : undefined,
        source: afterSummary?.source ? { to: afterSummary.source } : undefined,
        required:
          afterSummary?.required !== undefined
            ? { to: Boolean(afterSummary.required) }
            : undefined,
      }),
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'create',
      key,
      hasValue: Boolean(result?.hasValue),
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.status(201).json({ success: true, data: result, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/reveal/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();

    const result = secretsVault.reveal(key);

    const diffMeta = {
      before: null,
      after: compactObject({
        visibility: result?.visibility ?? null,
        hasValue: Boolean(result?.hasValue),
      }),
      changes: compactObject({
        reveal: {
          permitted: result?.visibility === 'visible',
          returned: Boolean(result?.value),
        },
      }),
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'reveal',
      key,
      hasValue: Boolean(result?.hasValue),
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({
      success: true,
      data: {
        key: result.key,
        value: result.value,
        visibility: result.visibility,
        hasValue: result.hasValue,
      },
      correlationId,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/update/:key', async (req, res) => {
  try {
    const targetKey = req.params.key;
    const { value, visibility, source, required } = req.body || {};
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();

    const beforeRecord = secretsVault.get(targetKey);
    const beforeSummary = summariseRecordForAudit(beforeRecord);

    const result = await secretsVault.update(targetKey, {
      value,
      visibility,
      source,
      updatedBy: actorId,
      required,
    });

    await secretsSyncQueue.add(targetKey);

    const afterSummary = summariseRecordForAudit(result);
    const diffMeta = {
      before: beforeSummary,
      after: afterSummary,
      changes: compactObject({
        value: describeValueChange(value, {
          beforeHasValue: Boolean(beforeSummary?.hasValue),
          afterHasValue: Boolean(afterSummary?.hasValue),
        }),
        visibility:
          visibility !== undefined
            ? {
                from: beforeSummary?.visibility ?? null,
                to: afterSummary?.visibility ?? null,
              }
            : undefined,
        source:
          source !== undefined
            ? {
                from: beforeSummary?.source ?? null,
                to: afterSummary?.source ?? null,
              }
            : undefined,
        required:
          required !== undefined
            ? {
                from: beforeSummary?.required ?? false,
                to: Boolean(afterSummary?.required),
              }
            : undefined,
      }),
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'update',
      key: targetKey,
      hasValue: value !== undefined ? Boolean(value) : Boolean(result?.hasValue),
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: result, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/delete/:key', async (req, res) => {
  try {
    const targetKey = req.params.key;
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();

    const result = await secretsVault.remove(targetKey);

    await secretsSyncQueue.remove([targetKey]);

    const removedSummary = summariseRecordForAudit(result);
    const diffMeta = {
      before: removedSummary,
      after: null,
      changes: compactObject({
        value: {
          operation: 'removed',
          from: Boolean(removedSummary?.hasValue),
        },
      }),
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'delete',
      key: targetKey,
      hasValue: Boolean(result?.hasValue),
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: { key: targetKey }, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/usages/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!secretsVault.isValidKey(key)) {
      return res.status(400).json({
        success: false,
        error: 'Key must match ^[A-Z0-9_.:-]{2,128}$',
        code: 'VALIDATION_ERROR',
      });
    }

    const occurrences = await secretsScanner.findKeyUsages(key);
    return res.json({
      success: true,
      data: {
        key,
        modules: occurrences,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/scan', async (req, res) => {
  try {
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();
    const knownKeys = secretsVault.getAllKeys();
    const scanResult = await secretsScanner.scanForMissing(knownKeys);

    const diffMeta = {
      before: null,
      after: null,
      changes: {
        missingCount: scanResult.missing.length,
      },
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'scan',
      key: null,
      hasValue: false,
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: scanResult, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/required', async (req, res) => {
  try {
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();
    const required = await getRequiredSecrets();

    const missingCount = required.items.filter((item) => item.status === 'missing').length;
    const diffMeta = {
      before: null,
      after: null,
      changes: {
        total: required.items.length,
        pendingSync: required.pendingSyncKeys.length,
        missing: missingCount,
      },
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'required.inspect',
      key: null,
      hasValue: false,
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: required, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/sync', async (req, res) => {
  try {
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();
    const result = await syncEnvFiles();

    const servicesSummary = summariseSyncServicesForAudit(result.services);
    const missingTotal = Object.values(servicesSummary).reduce(
      (count, entry) => count + (entry?.missingCount || 0),
      0,
    );
    const diffMeta = {
      before: null,
      after: {
        services: servicesSummary,
        pendingSyncCount: result.pendingSyncKeys.length,
        timestamp: result.timestamp,
      },
      changes: {
        missingTotal,
      },
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'sync',
      key: null,
      hasValue: false,
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: result, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/rollback', async (req, res) => {
  try {
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();
    const result = await rollbackEnvFiles();

    const servicesSummary = summariseRollbackServicesForAudit(result.services);
    const restoredCount = Object.values(result.services).filter((item) => item.restored).length;
    const diffMeta = {
      before: null,
      after: {
        services: servicesSummary,
        timestamp: result.timestamp,
      },
      changes: {
        restoredCount,
      },
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'rollback',
      key: null,
      hasValue: false,
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: result, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/telemetry', async (req, res) => {
  try {
    const actorId = getActorId(req);
    const correlationId = crypto.randomUUID();
    const telemetry = await getSecretsTelemetry();

    const diffMeta = {
      before: null,
      after: {
        totals: telemetry.totals,
        sync: telemetry.sync,
        services: telemetry.services,
      },
      changes: {
        lastStatus: telemetry.sync?.lastStatus ?? null,
        queueLength: telemetry.sync?.queueLength ?? 0,
      },
    };

    await auditService.logSecretsEvent({
      actorId,
      action: 'telemetry.inspect',
      key: null,
      hasValue: false,
      correlationId,
      metadata: {
        diffMeta,
      },
    });

    return res.json({ success: true, data: telemetry, correlationId });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;

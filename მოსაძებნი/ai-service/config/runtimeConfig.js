const fs = require('fs');
const path = require('path');

const { resolveGroqApiKey } = require('../../shared/secretResolver');
const { describeInternalToken } = require('../../shared/internalToken');
const { validateEnv } = require('../../shared/config/envValidator');

const envState = validateEnv({ serviceName: 'ai-service' });

const CONFIG_PATH = path.join(__dirname, 'runtime.config.json');

const DEFAULT_CONFIG = {
  backupMode: process.env.FORCE_OPENAI_BACKUP === 'true',
  modelStrategy: {
    smallModel: {
      model: process.env.GROQ_SMALL_MODEL || 'llama-3.1-8b-instant',
    },
    largeModel: {
      model: process.env.GROQ_LARGE_MODEL || 'llama-3.3-70b-versatile',
      thresholdChars: Number.parseInt(process.env.GROQ_LARGE_MODEL_THRESHOLD || '220', 10),
      keywords: [
        'სრული სისტემის ანალიზი',
        'სრული პროექტის ანალიზი',
        'კოდი',
        'არქიტექტურა',
      ],
    },
  },
};

const normaliseNodeEnv = (value) => {
  if (!value) return 'development';
  const lowered = String(value).trim().toLowerCase();
  return lowered === 'production' ? 'production' : 'development';
};

const formatIssue = (key, reason, severity = 'error') => ({ key, reason, severity });

const mergeWithDefaults = (overrides = {}) => {
  const merged = {
    ...DEFAULT_CONFIG,
    ...overrides,
    modelStrategy: {
      ...DEFAULT_CONFIG.modelStrategy,
      ...(overrides.modelStrategy || {}),
      smallModel: {
        ...DEFAULT_CONFIG.modelStrategy.smallModel,
        ...(overrides.modelStrategy?.smallModel || {}),
      },
      largeModel: {
        ...DEFAULT_CONFIG.modelStrategy.largeModel,
        ...(overrides.modelStrategy?.largeModel || {}),
      },
    },
  };

  if (process.env.FORCE_OPENAI_BACKUP === 'true') {
    merged.backupMode = true;
  }

  return merged;
};

const readConfigFromDisk = () => {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('❌ [AI RuntimeConfig] Failed to read runtime config:', error.message);
    }
  }
  return null;
};

const writeConfigToDisk = (config) => {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ [AI RuntimeConfig] Failed to persist runtime config:', error.message);
  }
};

let runtimeConfigCache;

const getRuntimeConfig = () => {
  if (!runtimeConfigCache) {
    const stored = readConfigFromDisk();
    runtimeConfigCache = mergeWithDefaults(stored || {});
  }

  return runtimeConfigCache;
};

const updateRuntimeConfig = (patch = {}) => {
  const next = mergeWithDefaults({
    ...getRuntimeConfig(),
    ...patch,
    modelStrategy: {
      ...getRuntimeConfig().modelStrategy,
      ...(patch.modelStrategy || {}),
    },
  });

  runtimeConfigCache = next;
  writeConfigToDisk(runtimeConfigCache);
  return runtimeConfigCache;
};

const isBackupModeEnabled = () => process.env.FORCE_OPENAI_BACKUP === 'true' || Boolean(getRuntimeConfig().backupMode);

const setBackupMode = (enabled) => {
  if (process.env.FORCE_OPENAI_BACKUP === 'true') {
    console.warn('⚠️ [AI RuntimeConfig] Backup mode forced via FORCE_OPENAI_BACKUP; ignoring manual override.');
    return getRuntimeConfig();
  }

  return updateRuntimeConfig({ backupMode: Boolean(enabled) });
};

const getModelStrategy = () => getRuntimeConfig().modelStrategy;

const buildRuntimeConfig = () => {
  const issues = [];
  const warnings = [];

  process.env.NODE_ENV = normaliseNodeEnv(process.env.NODE_ENV);
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';

  const groqKey = resolveGroqApiKey();
  if (groqKey.key) {
    if (process.env.GROQ_API_KEY !== groqKey.key) {
      process.env.GROQ_API_KEY = groqKey.key;
    }
  } else {
    issues.push(formatIssue('GROQ_API_KEY', 'missing', isProduction ? 'fatal' : 'warn'));
  }

  const internalTokenDescriptor = describeInternalToken();
  if (!internalTokenDescriptor.present) {
    issues.push(formatIssue('AI_INTERNAL_TOKEN', 'missing', isProduction ? 'fatal' : 'warn'));
  } else if (internalTokenDescriptor.isFallback) {
    issues.push(formatIssue('AI_INTERNAL_TOKEN', 'fallback-token', isProduction ? 'fatal' : 'warn'));
  }

  if (!['production', 'development'].includes(nodeEnv)) {
    issues.push(formatIssue('NODE_ENV', 'invalid', isProduction ? 'fatal' : 'warn'));
  }

  const fatalIssues = issues.filter((issue) => issue.severity === 'fatal');
  if (fatalIssues.length && isProduction) {
    fatalIssues.forEach((issue) => {
      console.error(`❌ [AI RuntimeConfig] Missing critical env: ${issue.key} (${issue.reason})`);
    });
    process.exit(1);
  }

  const degraded = !isProduction && issues.some((issue) => issue.severity !== 'fatal');

  if (degraded) {
    console.warn('⚠️ [AI RuntimeConfig] Running in degraded mode due to incomplete environment configuration.');
    issues
      .filter((issue) => issue.severity !== 'fatal')
      .forEach((issue) => {
        console.warn(`   ↳ ${issue.key}: ${issue.reason}`);
      });
  }

  if (groqKey.key) {
    console.log(`🔑 [AI RuntimeConfig] GROQ key ready (${groqKey.source || 'env:GROQ_API_KEY'})`);
  }

  if (internalTokenDescriptor.present) {
    console.log(
      `🔐 [AI RuntimeConfig] Internal token sourced from ${internalTokenDescriptor.source} (${internalTokenDescriptor.masked})`,
    );
    if (internalTokenDescriptor.isFallback) {
      console.warn('⚠️ [AI RuntimeConfig] Internal token uses insecure fallback.');
    }
  } else {
    console.warn('⚠️ [AI RuntimeConfig] Internal token not configured; proposal submission disabled.');
  }

  warnings.forEach((warning) => {
    console.warn(`⚠️ [AI RuntimeConfig] ${warning.key}: ${warning.reason}`);
  });

  const runtime = getRuntimeConfig();

  return Object.freeze({
    env: {
      nodeEnv,
      isProduction,
    },
    degraded,
    issues,
    warnings,
    config: runtime,
    integrations: {
      groq: {
        keyPresent: Boolean(groqKey.key),
        source: groqKey.source || null,
      },
    },
    security: {
      internalToken: internalTokenDescriptor,
    },
  });
};

const runtimeSummary = buildRuntimeConfig();

module.exports = {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  buildRuntimeConfig,
  getRuntimeConfig,
  updateRuntimeConfig,
  isBackupModeEnabled,
  setBackupMode,
  getModelStrategy,
  envState,
  runtimeSummary,
};

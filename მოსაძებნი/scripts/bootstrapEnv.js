const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const CRITICAL_KEYS = ['RP_ID', 'ORIGIN', 'SESSION_SECRET'];

let bootstrapped = false;
let lastSummary = null;

const loadEnvFile = (filePath, options = {}) => {
  if (!fs.existsSync(filePath)) {
    return { loaded: false, error: null };
  }

  const result = dotenv.config({ path: filePath, override: Boolean(options.override) });
  if (result.error) {
    return { loaded: false, error: result.error };
  }

  return { loaded: true, error: null };
};

const applyExampleDefaults = (filePath, injectedKeys, options = {}) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  try {
    const contents = fs.readFileSync(filePath);
    const parsed = dotenv.parse(contents);

    for (const [key, value] of Object.entries(parsed)) {
      if (!key) {
        continue;
      }

      const existing = process.env[key];
      if (existing !== undefined && String(existing).trim() !== '') {
        continue;
      }

      if (value !== undefined) {
        process.env[key] = value;
        injectedKeys.push(key);
      }
    }
  } catch (error) {
    if (!options.silent) {
      console.warn(`⚠️  Failed to parse ${filePath}:`, error.message);
    }
  }
};

function bootstrapEnv(options = {}) {
  if (bootstrapped && !options.force) {
    return lastSummary ?? { injected: 0, loadedFiles: [], defaultsFrom: [], missingCritical: [] };
  }

  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const envFiles = options.envFiles ?? ['.env.local', '.env'];
  const exampleFiles = options.exampleFiles ?? ['.env.defaults', '.env.example'];
  const loadedFiles = [];
  const defaultsFrom = [];
  const injectedKeys = [];

  for (const relative of envFiles) {
    const resolved = path.resolve(cwd, relative);
    const { loaded, error } = loadEnvFile(resolved, options);
    if (loaded) {
      loadedFiles.push(resolved);
    } else if (error && !options.silent) {
      console.warn(`⚠️  Failed to load ${resolved}:`, error.message);
    }
  }

  for (const relative of exampleFiles) {
    const resolved = path.resolve(cwd, relative);
    const beforeCount = injectedKeys.length;
    applyExampleDefaults(resolved, injectedKeys, options);
    if (injectedKeys.length > beforeCount) {
      defaultsFrom.push(resolved);
    }
  }

  const missingCritical = CRITICAL_KEYS.filter(key => {
    const value = process.env[key];
    return value === undefined || String(value).trim() === '';
  });

  if (!options.silent) {
    const injectedCount = injectedKeys.length;
    const loadedLabel = loadedFiles.length ? loadedFiles.map(file => path.relative(cwd, file)).join(', ') : 'none';
    const defaultsLabel = defaultsFrom.length ? defaultsFrom.map(file => path.relative(cwd, file)).join(', ') : 'none';
    console.log(`🌱 [env] Loaded files: ${loadedLabel}`);
    console.log(`🌱 [env] Injecting defaults (${injectedCount}) from: ${defaultsLabel}`);
    if (missingCritical.length) {
      console.warn(`⚠️  [env] Missing critical variables: ${missingCritical.join(', ')}`);
    }
  }

  const summary = {
    injected: injectedKeys.length,
    injectedKeys,
    loadedFiles,
    defaultsFrom,
    missingCritical,
  };

  bootstrapped = true;
  lastSummary = summary;
  return summary;
}

module.exports = { bootstrapEnv };

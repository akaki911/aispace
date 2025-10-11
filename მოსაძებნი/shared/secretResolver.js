const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function hasValue(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function looksLikeFilePath(value) {
  if (!hasValue(value)) {
    return false;
  }

  return value.includes('/') || value.includes('\\') || value.endsWith('.json') || value.endsWith('.txt');
}

const ENV_VAR_PATTERN = /\$(?:\{([^}]+)\}|([A-Za-z_][A-Za-z0-9_]*))/g;

function expandEnvVariables(rawPath) {
  if (!hasValue(rawPath)) {
    return rawPath;
  }

  return rawPath.replace(ENV_VAR_PATTERN, (match, group1, group2) => {
    const key = group1 || group2;
    if (!key) {
      return match;
    }
    const value = process.env[key];
    return hasValue(value) ? value : match;
  });
}

function expandHomeDirectory(rawPath) {
  if (!hasValue(rawPath)) {
    return rawPath;
  }

  if (rawPath.startsWith('~')) {
    return path.join(os.homedir(), rawPath.slice(1));
  }

  return rawPath;
}

function buildCandidatePaths(rawPath) {
  if (!hasValue(rawPath)) {
    return [];
  }

  const expandedEnv = expandEnvVariables(rawPath.trim());
  const withHome = expandHomeDirectory(expandedEnv);
  const candidates = new Set();
  const repoRoot = path.resolve(__dirname, '..');
  const projectRoot = hasValue(process.env.PROJECT_ROOT)
    ? path.resolve(process.env.PROJECT_ROOT)
    : null;

  const addCandidate = (candidate) => {
    if (!candidate) {
      return;
    }
    const normalised = path.normalize(candidate);
    candidates.add(normalised);
  };

  if (path.isAbsolute(withHome)) {
    addCandidate(withHome);
  } else {
    addCandidate(withHome);
    addCandidate(path.resolve(process.cwd(), withHome));
    addCandidate(path.resolve(repoRoot, withHome));
    if (projectRoot) {
      addCandidate(path.resolve(projectRoot, withHome));
    }
  }

  return Array.from(candidates);
}

const missingPathWarnings = new Set();

function readFileIfExists(filePath) {
  if (!hasValue(filePath)) {
    return null;
  }

  const candidates = buildCandidatePaths(filePath);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8');
      }
    } catch (error) {
      console.warn(`[secretResolver] Unable to read file at ${candidate}: ${error.message}`);
    }
  }

  const warningKey = candidates.join('|') || filePath;
  if (!missingPathWarnings.has(warningKey)) {
    missingPathWarnings.add(warningKey);
    const message = candidates.length
      ? `[secretResolver] File not found. Tried: ${candidates.join(', ')}`
      : `[secretResolver] File not found at ${filePath}`;
    console.warn(message);
  }

  return null;
}

function decodeBase64(value) {
  if (!hasValue(value)) {
    return null;
  }

  const sanitized = value.trim().replace(/\s+/g, '');

  if (!BASE64_PATTERN.test(sanitized)) {
    return null;
  }

  try {
    const buffer = Buffer.from(sanitized, 'base64');
    if (!buffer.length) {
      return null;
    }
    return buffer.toString('utf8');
  } catch (error) {
    console.warn('[secretResolver] Base64 decode failed:', error.message);
    return null;
  }
}

function maskSecret(secret, { prefix = 6, suffix = 4 } = {}) {
  if (!hasValue(secret)) {
    return '(empty)';
  }

  if (secret.length <= prefix + suffix) {
    return `${secret[0] || ''}***${secret[secret.length - 1] || ''}`;
  }

  const start = secret.slice(0, prefix);
  const end = secret.slice(-suffix);
  return `${start}…${end}`;
}

function getFirstAvailableEnv(keys) {
  for (const key of keys) {
    if (hasValue(process.env[key])) {
      return { key, value: process.env[key].trim() };
    }
  }
  return null;
}

function resolveGroqApiKey() {
  const directCandidate = getFirstAvailableEnv(['GROQ_API_KEY', 'GROQ_API_TOKEN']);
  let rawValue = directCandidate ? directCandidate.value : null;
  let source = directCandidate ? `env:${directCandidate.key}` : null;

  if (rawValue && looksLikeFilePath(rawValue)) {
    const filePath = rawValue;
    const fromFile = readFileIfExists(filePath);
    if (hasValue(fromFile)) {
      rawValue = fromFile.trim();
      source = `file:${filePath}`;
    }
  }

  if (!hasValue(rawValue)) {
    const fileCandidate = getFirstAvailableEnv([
      'GROQ_API_KEY_FILE',
      'GROQ_API_KEY_PATH',
      'GROQ_API_TOKEN_FILE',
      'GROQ_API_TOKEN_PATH'
    ]);

    if (fileCandidate) {
      const fileContents = readFileIfExists(fileCandidate.value);
      if (hasValue(fileContents)) {
        rawValue = fileContents.trim();
        source = `file:${fileCandidate.value}`;
      }
    }
  }

  if (!hasValue(rawValue)) {
    const base64Candidate = getFirstAvailableEnv([
      'GROQ_API_KEY_BASE64',
      'GROQ_API_KEY_B64',
      'GROQ_API_TOKEN_BASE64',
      'GROQ_API_TOKEN_B64'
    ]);

    if (base64Candidate) {
      const decoded = decodeBase64(base64Candidate.value);
      if (hasValue(decoded)) {
        rawValue = decoded.trim();
        source = `base64:${base64Candidate.key}`;
      }
    }
  }

  if (!hasValue(rawValue) && directCandidate) {
    const decoded = decodeBase64(directCandidate.value);
    if (hasValue(decoded)) {
      rawValue = decoded.trim();
      source = `${source || 'env'} (base64 decoded)`;
    }
  }

  if (hasValue(rawValue)) {
    return { key: rawValue, source };
  }

  return { key: null, source: null };
}

function resolveFirebaseServiceAccount() {
  const directCandidate = getFirstAvailableEnv([
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'FIREBASE_ADMIN_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON'
  ]);

  let rawValue = directCandidate ? directCandidate.value : null;
  let source = directCandidate ? `env:${directCandidate.key}` : null;

  if (rawValue && looksLikeFilePath(rawValue)) {
    const filePath = rawValue;
    const fileContents = readFileIfExists(filePath);
    if (hasValue(fileContents)) {
      rawValue = fileContents;
      source = `file:${filePath}`;
    }
  }

  if (!hasValue(rawValue)) {
    const fileCandidate = getFirstAvailableEnv([
      'FIREBASE_SERVICE_ACCOUNT_KEY_FILE',
      'FIREBASE_SERVICE_ACCOUNT_KEY_PATH',
      'FIREBASE_ADMIN_KEY_FILE',
      'FIREBASE_ADMIN_KEY_PATH',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ]);

    if (fileCandidate) {
      const fileContents = readFileIfExists(fileCandidate.value);
      if (hasValue(fileContents)) {
        rawValue = fileContents;
        source = `file:${fileCandidate.value}`;
      }
    }
  }

  if (!hasValue(rawValue)) {
    const base64Candidate = getFirstAvailableEnv([
      'FIREBASE_SERVICE_ACCOUNT_KEY_BASE64',
      'FIREBASE_SERVICE_ACCOUNT_KEY_B64',
      'FIREBASE_ADMIN_KEY_BASE64',
      'FIREBASE_ADMIN_KEY_B64'
    ]);

    if (base64Candidate) {
      const decoded = decodeBase64(base64Candidate.value);
      if (hasValue(decoded)) {
        rawValue = decoded;
        source = `base64:${base64Candidate.key}`;
      }
    }
  }

  if (!hasValue(rawValue) && directCandidate) {
    const decoded = decodeBase64(directCandidate.value);
    if (hasValue(decoded)) {
      rawValue = decoded;
      source = `${source || 'env'} (base64 decoded)`;
    }
  }

  if (!hasValue(rawValue)) {
    return { credential: null, stringValue: null, source: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    const decoded = decodeBase64(rawValue);
    if (hasValue(decoded)) {
      try {
        parsed = JSON.parse(decoded);
        rawValue = decoded;
        source = `${source || 'env'} (base64 decoded)`;
      } catch (secondaryError) {
        console.warn('[secretResolver] Failed to parse Firebase service account JSON after base64 decode:', secondaryError.message);
        return { credential: null, stringValue: null, source: null, error: secondaryError };
      }
    } else {
      console.warn('[secretResolver] Firebase service account JSON parse failed:', error.message);
      return { credential: null, stringValue: null, source: null, error };
    }
  }

  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  const stringValue = JSON.stringify(parsed);

  return { credential: parsed, stringValue, source };
}

module.exports = {
  resolveGroqApiKey,
  resolveFirebaseServiceAccount,
  maskSecret
};

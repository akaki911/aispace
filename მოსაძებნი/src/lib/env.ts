
// src/lib/env.ts

const DEV_AI_DEFAULT = 'http://127.0.0.1:5001';
const DEV_BACKEND_DEFAULT = 'http://127.0.0.1:5002';

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

/**
 * Resolve the primary backend URL for browser requests.
 *
 * Priority: `VITE_BACKEND_URL` → dev default (http://127.0.0.1:5002) → relative origin.
 */
export function getBackendBaseURL(): string {
  const env = import.meta.env;
  const configured = env?.VITE_BACKEND_URL?.trim();

  if (configured) {
    return stripTrailingSlashes(configured);
  }

  if (env?.DEV) {
    return DEV_BACKEND_DEFAULT;
  }

  return '';
}

/**
 * Resolve the AI service base URL for direct-to-microservice fallbacks.
 *
 * Priority: `VITE_AI_SERVICE_URL` → `VITE_API_URL` (legacy) → dev default → relative.
 */
export function getAiServiceBaseURL(): string {
  const env = import.meta.env;
  const configuredAi = env?.VITE_AI_SERVICE_URL?.trim();
  const legacyApi = env?.VITE_API_URL?.trim();

  if (configuredAi) {
    return stripTrailingSlashes(configuredAi);
  }

  if (legacyApi) {
    return stripTrailingSlashes(legacyApi);
  }

  if (env?.DEV) {
    return DEV_AI_DEFAULT;
  }

  return '';
}

// Backwards compatibility for older imports.
export function getApiBaseURL(): string {
  return getAiServiceBaseURL();
}

// UPDATE 2024-10-01: Helper utilities now expose Authorization-bearing headers for
// AI service calls while keeping storage fallbacks intact.
const STORAGE_KEYS = ['ADMIN_SETUP_TOKEN', 'adminSetupToken', 'x-admin-setup-token'];

const readTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const key of STORAGE_KEYS) {
    try {
      const fromLocal = window.localStorage?.getItem(key);
      if (fromLocal) {
        return fromLocal;
      }
      const fromSession = window.sessionStorage?.getItem(key);
      if (fromSession) {
        return fromSession;
      }
    } catch (error) {
      console.warn('⚠️ Unable to read admin token from storage:', error);
    }
  }

  return null;
};

let cachedToken: string | null = null;

export const getAdminSetupToken = (): string => {
  if (cachedToken) {
    return cachedToken;
  }

  const storageToken = readTokenFromStorage();
  if (storageToken) {
    cachedToken = storageToken;
    return storageToken;
  }

  const envToken = typeof import.meta !== 'undefined' ? import.meta.env.VITE_ADMIN_SETUP_TOKEN : undefined;
  if (envToken && typeof envToken === 'string' && envToken.length > 0) {
    cachedToken = envToken;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(STORAGE_KEYS[0], envToken);
      } catch (error) {
        console.warn('⚠️ Unable to persist admin token to storage:', error);
      }
    }
    return envToken;
  }

  const fallback = 'DEV_ADMIN_SETUP_TOKEN';
  cachedToken = fallback;
  return fallback;
};

const normalizeHeaders = (headers: HeadersInit = {}): Record<string, string> => {
  const normalized: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      normalized[key] = value;
    });
  } else {
    Object.assign(normalized, headers);
  }

  const token = getAdminSetupToken();
  if (token) {
    normalized['x-admin-setup-token'] = normalized['x-admin-setup-token'] || token;
    normalized['Authorization'] = normalized['Authorization'] || `Bearer ${token}`;
  }

  return normalized;
};

export const buildAdminHeaders = (headers: HeadersInit = {}): HeadersInit => {
  return normalizeHeaders(headers);
};

export const getAdminAuthHeaders = (): Record<string, string> => {
  return normalizeHeaders({});
};

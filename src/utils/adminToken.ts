export interface AdminHeadersOptions {
  token?: string | null;
  includeJson?: boolean;
}

const ADMIN_HEADER_KEY = 'X-Gurulo-Admin-Token';

const resolveToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ADMIN_HEADER_KEY);
};

export const getAdminAuthHeaders = (options: AdminHeadersOptions = {}) => {
  const token = options.token ?? resolveToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers[ADMIN_HEADER_KEY] = token;
  }

  if (options.includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
};

export const buildAdminHeaders = (options: AdminHeadersOptions = {}) => ({
  Accept: 'application/json',
  ...getAdminAuthHeaders(options),
});

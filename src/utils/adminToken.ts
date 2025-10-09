export const getAdminAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('aispace.adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const buildAdminHeaders = (additional?: Record<string, string>): Record<string, string> => ({
  ...(additional ?? {}),
  ...getAdminAuthHeaders(),
});

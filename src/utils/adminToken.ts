export const getAdminAuthHeaders = (): Record<string, string> => ({
  'X-Admin-Auth': 'disabled',
});

export const buildAdminHeaders = (): Record<string, string> => ({
  'X-Admin-Auth': 'disabled',
});

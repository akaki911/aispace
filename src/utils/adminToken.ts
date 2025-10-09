export const getAdminAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('aispace.adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export interface BrowserTestingRoutes {
  dashboard: string;
  recentRuns: string;
}

export const useBrowserTestingRoutes = () => {
  const navigate = useNavigate();

  const routes = useMemo<BrowserTestingRoutes>(() => ({
    dashboard: '/admin/browser-testing',
    recentRuns: '/admin/browser-testing/runs',
  }), []);

  return {
    routes,
    openDashboard: () => navigate(routes.dashboard),
    openRecentRuns: () => navigate(routes.recentRuns),
  };
};

export default useBrowserTestingRoutes;

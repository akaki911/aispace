import { Navigate } from 'react-router-dom';
import AIDeveloperPanel from '@aispace/components/AIDeveloperPanel';
import { useAuth } from '@/contexts/useAuth';
import { usePermissions } from '@/contexts/usePermissions';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContextObject';

const loadingFallback = (
  <div className="p-6 text-sm text-slate-500">AI სივრცე იტვირთება...</div>
);

const AIDeveloperRoute = () => {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { isLoading: flagsLoading } = useFeatureFlagsContext();
  const isAiEnabled = useFeatureFlag('AI');

  if (authLoading || permissionsLoading || flagsLoading) {
    return loadingFallback;
  }

  const hasDeveloperAccess =
    isAuthenticated &&
    isAiEnabled &&
    (hasRole('SUPER_ADMIN') || hasRole('DEVELOPER') || hasPermission('ai_developer_access'));

  if (!hasDeveloperAccess) {
    return <Navigate to="/admin" replace />;
  }

  return <AIDeveloperPanel />;
};

export default AIDeveloperRoute;


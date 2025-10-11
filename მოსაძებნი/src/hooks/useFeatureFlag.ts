import { useContext, useMemo } from 'react';
import { FeatureFlagsContext } from '@/contexts/FeatureFlagsProvider';
import { FeatureFlagName, getFeatureFlag } from '@/lib/featureFlags';

export const useFeatureFlag = (flag: FeatureFlagName): boolean => {
  const context = useContext(FeatureFlagsContext);

  return useMemo(() => {
    if (context && Object.prototype.hasOwnProperty.call(context.flags, flag)) {
      return Boolean(context.flags[flag]);
    }

    return getFeatureFlag(flag);
  }, [context, flag]);
};

export default useFeatureFlag;

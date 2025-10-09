import { useMemo } from 'react';

import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContextObject';

export const useFeatureFlag = (flag: string): boolean => {
  const { flags } = useFeatureFlagsContext();
  return useMemo(() => Boolean(flags?.[flag]), [flag, flags]);
};

export default useFeatureFlag;

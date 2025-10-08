import { useMemo } from 'react';

export const useFeatureFlag = (flag: string, defaultValue = false) => {
  return useMemo<boolean>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    const stored = window.localStorage.getItem(`feature:${flag}`);
    if (stored === null) {
      return defaultValue;
    }
    return stored === 'true' || stored === '1';
  }, [flag, defaultValue]);
};

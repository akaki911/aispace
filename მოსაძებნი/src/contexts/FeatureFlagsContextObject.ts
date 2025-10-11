import { createContext, useContext } from 'react';
import type { FeatureFlagsContextValue } from './FeatureFlagsContext.types';

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export const useFeatureFlagsContext = (): FeatureFlagsContextValue => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlagsContext must be used within a FeatureFlagsProvider');
  }
  return context;
};

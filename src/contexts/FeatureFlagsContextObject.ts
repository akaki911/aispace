import { createContext, useContext } from 'react';

export type FeatureFlagName = string;

export interface FeatureFlagsContextValue {
  flags: Record<FeatureFlagName, boolean>;
  isLoading: boolean;
  refresh: () => Promise<void> | void;
  setFlag: (flag: FeatureFlagName, value: boolean) => void;
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  isLoading: false,
  refresh: () => undefined,
  setFlag: () => undefined,
});

export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);

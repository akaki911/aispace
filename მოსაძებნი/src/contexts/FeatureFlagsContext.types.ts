import type { FeatureFlagName } from '@/lib/featureFlags';

export interface FeatureFlagsContextValue {
  flags: Record<FeatureFlagName, boolean>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getFlag: (flag: FeatureFlagName) => boolean;
}

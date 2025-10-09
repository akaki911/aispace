const STORAGE_KEY = 'aispace.featureFlags';

type FeatureFlagOverrides = Record<string, boolean>;

const safeParse = (raw: string | null): FeatureFlagOverrides => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return Object.entries(parsed).reduce<FeatureFlagOverrides>((acc, [key, value]) => {
      acc[key] = Boolean(value);
      return acc;
    }, {});
  } catch (error) {
    console.warn('Failed to parse feature flag overrides', error);
    return {};
  }
};

export const getFeatureFlagOverrides = (): FeatureFlagOverrides => {
  if (typeof window === 'undefined') {
    return {};
  }
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

export const setFeatureFlagOverride = (flag: string, value: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }
  const next = { ...getFeatureFlagOverrides(), [flag]: value };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const envFeatureFlag = (flag: string, defaultValue = false): boolean => {
  const envValue = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[`VITE_FEATURE_${flag}`];
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }
  return getFeatureFlagOverrides()[flag] ?? defaultValue;
};

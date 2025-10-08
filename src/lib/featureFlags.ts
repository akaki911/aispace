const overrides = new Map<string, boolean>();

export const setFeatureFlagOverride = (flag: string, value: boolean) => {
  overrides.set(flag, value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`feature:${flag}`, String(value));
  }
};

export const getFeatureFlagOverride = (flag: string) => overrides.get(flag);

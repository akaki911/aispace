export const resolveFeatureFlag = (rawValue: unknown, defaultValue = false): boolean => {
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();

    if (['1', 'true', 'on', 'yes', 'enabled'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'off', 'no', 'disabled'].includes(normalized)) {
      return false;
    }

    if (normalized.length === 0) {
      return defaultValue;
    }
  }

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number') {
    return rawValue !== 0;
  }

  return defaultValue;
};

export const envFeatureFlag = (flagName: string, defaultValue = false): boolean => {
  try {
    const envSource = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const rawValue = envSource?.[flagName];
    return resolveFeatureFlag(rawValue, defaultValue);
  } catch (error) {
    if (typeof process !== 'undefined' && process.env) {
      return resolveFeatureFlag(process.env[flagName], defaultValue);
    }

    return defaultValue;
  }
};

const INITIAL_FEATURE_FLAGS = {
  GITHUB: envFeatureFlag('VITE_GITHUB_ENABLED'),
  AI: envFeatureFlag('VITE_FEATURE_AI', true),
  LEGACY_AI_DEVELOPER: envFeatureFlag('VITE_FEATURE_LEGACY_AI_DEVELOPER'),
} as const;

export type FeatureFlagName = keyof typeof INITIAL_FEATURE_FLAGS;

let baseFlags: Record<FeatureFlagName, boolean> = { ...INITIAL_FEATURE_FLAGS };

export const FEATURE_FLAGS: Readonly<Record<FeatureFlagName, boolean>> = INITIAL_FEATURE_FLAGS;

type FeatureFlagOverrides = Partial<Record<FeatureFlagName, boolean>>;

type FeatureFlagMap = Partial<Record<FeatureFlagName, boolean>>;

const featureFlagStorageKey = (flag: FeatureFlagName): string => `feature-flag:${flag.toLowerCase()}`;

const loadInitialOverrides = (): FeatureFlagOverrides => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  try {
    return (Object.keys(FEATURE_FLAGS) as FeatureFlagName[]).reduce<FeatureFlagOverrides>((acc, flag) => {
      const storedValue = window.localStorage.getItem(featureFlagStorageKey(flag));
      if (storedValue === null) {
        return acc;
      }

      return {
        ...acc,
        [flag]: resolveFeatureFlag(storedValue, FEATURE_FLAGS[flag]),
      };
    }, {});
  } catch (error) {
    console.warn('⚠️ Failed to load feature flag overrides from storage:', error);
    return {};
  }
};

let overrides: FeatureFlagOverrides = loadInitialOverrides();
let remoteFlags: FeatureFlagMap = {};

const listeners = new Map<FeatureFlagName, Set<() => void>>();

const notifyListeners = (flag: FeatureFlagName) => {
  const subscribers = listeners.get(flag);
  if (!subscribers) {
    return;
  }

  subscribers.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('❌ Feature flag listener error:', error);
    }
  });
};

const updateOverrideInMemory = (flag: FeatureFlagName, value: boolean | null) => {
  if (value === null) {
    if (Object.prototype.hasOwnProperty.call(overrides, flag)) {
      const updated = { ...overrides };
      delete updated[flag];
      overrides = updated;
    }
    return;
  }

  overrides = {
    ...overrides,
    [flag]: value,
  };
};

const getBaseFlagValue = (flag: FeatureFlagName): boolean => {
  if (Object.prototype.hasOwnProperty.call(remoteFlags, flag)) {
    const remoteValue = remoteFlags[flag];
    if (typeof remoteValue === 'boolean') {
      return remoteValue;
    }
  }

  return FEATURE_FLAGS[flag] ?? false;
};

export const getFeatureFlag = (flag: FeatureFlagName): boolean => {
  if (Object.prototype.hasOwnProperty.call(overrides, flag)) {
    const overrideValue = overrides[flag];
    if (typeof overrideValue === 'boolean') {
      return overrideValue;
    }
  }

  return baseFlags[flag] ?? false;
};

export const isFeatureEnabled = (flag: FeatureFlagName): boolean => getFeatureFlag(flag);

const persistOverride = (flag: FeatureFlagName, value: boolean | null) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(featureFlagStorageKey(flag));
    } else {
      window.localStorage.setItem(featureFlagStorageKey(flag), value ? 'true' : 'false');
    }
  } catch (error) {
    console.warn('⚠️ Failed to persist feature flag override:', error);
  }
};

export const setFeatureFlagOverride = (flag: FeatureFlagName, value: boolean): void => {
  updateOverrideInMemory(flag, value);
  persistOverride(flag, value);
  notifyListeners(flag);
};

export const clearFeatureFlagOverride = (flag: FeatureFlagName): void => {
  updateOverrideInMemory(flag, null);
  persistOverride(flag, null);
  notifyListeners(flag);
};

export const setRemoteFeatureFlags = (flags: FeatureFlagMap): void => {
  let changed = false;

  for (const [flagKey, value] of Object.entries(flags) as [FeatureFlagName, boolean | undefined][]) {
    if (!(flagKey in FEATURE_FLAGS)) {
      continue;
    }

    const normalizedValue = typeof value === 'boolean' ? value : undefined;
    if (normalizedValue === undefined) {
      continue;
    }

    if (remoteFlags[flagKey] !== normalizedValue) {
      remoteFlags = { ...remoteFlags, [flagKey]: normalizedValue };
      changed = true;
      notifyListeners(flagKey);
    }
  }

  if (!changed && Object.keys(flags).length === 0) {
    return;
  }
};

export const clearRemoteFeatureFlags = (): void => {
  const previous = remoteFlags;
  remoteFlags = {};
  (Object.keys(previous) as FeatureFlagName[]).forEach((flag) => notifyListeners(flag));
};

export const subscribeToFeatureFlag = (flag: FeatureFlagName, listener: () => void): (() => void) => {
  const subscribers = listeners.get(flag) ?? new Set<() => void>();
  subscribers.add(listener);
  listeners.set(flag, subscribers);

  return () => {
    const current = listeners.get(flag);
    if (!current) {
      return;
    }

    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(flag);
    }
  };
};

export const getFeatureFlagStorageKey = (flag: FeatureFlagName): string => featureFlagStorageKey(flag);

export const getResolvedFeatureFlags = (): Record<FeatureFlagName, boolean> => {
  return (Object.keys(baseFlags) as FeatureFlagName[]).reduce<Record<FeatureFlagName, boolean>>((acc, flag) => {
    acc[flag] = getFeatureFlag(flag);
    return acc;
  }, {} as Record<FeatureFlagName, boolean>);
};

export const updateBaseFeatureFlags = (
  updates: Partial<Record<FeatureFlagName, boolean>>,
): void => {
  const next = { ...baseFlags };
  let hasChanges = false;

  (Object.keys(updates) as FeatureFlagName[]).forEach((flag) => {
    const value = updates[flag];
    if (typeof value === 'boolean' && next[flag] !== value) {
      next[flag] = value;
      hasChanges = true;
    }
  });

  if (!hasChanges) {
    return;
  }

  baseFlags = next;
  (Object.keys(updates) as FeatureFlagName[]).forEach((flag) => {
    if (typeof updates[flag] === 'boolean') {
      notifyListeners(flag);
    }
  });
};

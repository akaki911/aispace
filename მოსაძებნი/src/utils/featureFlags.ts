
// Feature flags utility
export const FEATURE_FLAGS = {
  ROLE_AWARE_ENTRY: true, // SOL-431: Auto-routing entry
} as const;

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag] === true;
}

export function getFeatureFlag(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}

export const headerTokens = {
  height: 60,
  mobileHeight: 52,
  colors: {
    headerBackground: '#FFFFFF',
    surface: '#FFFFFF',
    accent: '#22C55E',
    accentHover: '#16A34A',
    accentActive: '#15803D',
    textPrimary: '#0F172A',
    textSecondary: '#475467',
    textMuted: '#64748B',
    border: '#E2E8F0',
    rolePillStart: '#34D399',
    rolePillEnd: '#10B981',
    badgeInfoBg: 'rgba(59, 130, 246, 0.12)',
    badgeInfoText: '#1D4ED8',
    badgeSuccessBg: 'rgba(34, 197, 94, 0.12)',
    badgeSuccessText: '#047857',
    badgeWarningBg: 'rgba(251, 191, 36, 0.18)',
    badgeWarningText: '#B45309'
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16
  },
  safePadding: {
    desktop: 28,
    mobile: 18
  },
  radii: {
    sm: 10,
    md: 16,
    pill: 999
  },
  typography: {
    title: {
      size: '20px',
      weight: 600
    },
    tab: {
      size: '15px',
      weight: 500
    },
    badge: {
      size: '12px',
      weight: 600
    }
  }
} as const;

export type HeaderTokens = typeof headerTokens;

export const autoImproveTheme = {
  colors: {
    background: 'bg-gray-950',
    surface: 'bg-gray-900',
    card: 'bg-gray-800',
    accent: 'text-emerald-400',
    accentSoft: 'bg-emerald-500/10',
    border: 'border-gray-800',
    muted: 'text-gray-400',
    heading: 'text-gray-100',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
    offline: 'text-slate-300',
  },
  spacing: {
    layout: 'p-4 md:p-6',
    gutter: 'gap-4',
    cardPadding: 'p-4',
  },
  shadow: {
    card: 'shadow-md hover:shadow-lg transition-all duration-300',
  },
  status: {
    ok: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30',
    degraded: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/30',
    offline: 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-400/30',
    error: 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30',
    paused: 'bg-slate-500/10 text-slate-200 ring-1 ring-slate-400/30',
  },
} as const;

export type AutoImproveTheme = typeof autoImproveTheme;

export const gaugeStyles = 'w-20 h-20 stroke-purple-500';

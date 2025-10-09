import type { AnimationToggleState, ChatLogRecord, PromptConfig, TrendData } from './types';

export const defaultPrompt = `// სისტემური პრომპტი გურული AI-სთვის
You are Bakhamo.ai, a futuristic Georgian guide.
- Respond in the language requested by the user (Georgian by default)
- Keep answers concise but warm.
- Offer actionable insights about Bakhmaro and services.`;

export const initialLogs: ChatLogRecord[] = [
  {
    id: 'session-1021',
    userId: 'GUEST-9842',
    startedAt: '2025-02-12T09:15:00Z',
    lastMessageAt: '2025-02-12T09:25:00Z',
    messages: 12,
    keywords: ['ბახმაროს ამინდი', 'გზის მდგომარეობა'],
    status: 'active',
  },
  {
    id: 'session-1020',
    userId: 'SUPER-ADMIN',
    startedAt: '2025-02-11T18:45:00Z',
    lastMessageAt: '2025-02-11T19:05:00Z',
    messages: 24,
    keywords: ['AI prompt tuning', 'cloud animations'],
    status: 'archived',
  },
  {
    id: 'session-1015',
    userId: 'GUEST-7777',
    startedAt: '2025-02-09T13:30:00Z',
    lastMessageAt: '2025-02-09T13:42:00Z',
    messages: 6,
    keywords: ['ცხენით გასეირნება'],
    status: 'flagged',
  },
];

export const animationOptions = [
  { key: 'cloudDrift', label: 'ღრუბლის დინამიკა' },
  { key: 'eyeBlink', label: 'თვალის ციმციმი' },
  { key: 'particleField', label: 'ნათელი ნაწილაკები' },
  { key: 'voiceAura', label: 'ხმოვანი აურა' },
];

export const themePresets = [
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'ცივი ლურჯი-იისფერი გადმოსვლები და მინიმალური მინარევი',
  },
  {
    id: 'emerald',
    name: 'Emerald Pulse',
    description: 'მწვანე და ცისფერი გრადიენტები, რომელიც პულსირებს',
  },
  {
    id: 'noir',
    name: 'Noir Glass',
    description: 'შავი შუშის ეფექტი ოქროს აქცენტით',
  },
];

export const initialPrompts: PromptConfig[] = [
  {
    id: 'system-core',
    label: 'ბირთვული ქცევის პრომპტი',
    placeholder: defaultPrompt,
    value: defaultPrompt,
  },
  {
    id: 'tone-guide',
    label: 'ტონის გიდი',
    placeholder: 'Use a conversational tone with gentle humor when appropriate.',
    value: 'Warm, respectful, and visionary with hints of mountainous poetry.',
  },
];

export const responseLimitPresets: Record<string, string> = {
  ka: 'ფრთხილი და მოკრძალებული პასუხები, მაქს. 512 ტოკენი',
  en: 'Precise and respectful responses, max 512 tokens',
};

export const defaultAnimationState: AnimationToggleState = {
  cloudDrift: true,
  eyeBlink: true,
  particleField: true,
  voiceAura: false,
};

export const defaultDailyUsage: TrendData['values'] = [45, 52, 58, 63, 59, 71, 78];
export const defaultSessionLength: TrendData['values'] = [4.5, 5.2, 6.1, 6.7, 6.5, 7.2, 7.9];

export const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const SECTION_ID_MAP = {
  overview: 'gurulo-section-overview',
  chatConfig: 'gurulo-section-chatConfig',
  userManagement: 'gurulo-section-userManagement',
  uiCustomization: 'gurulo-section-uiCustomization',
  analytics: 'gurulo-section-analytics',
  integrations: 'gurulo-section-integrations',
} as const;

export const HIGHLIGHT_CLASSES = ['ring-2', 'ring-sky-400/60', 'ring-offset-2', 'ring-offset-slate-900'];

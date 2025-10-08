export type GuruloSectionKey =
  | 'overview'
  | 'chatConfig'
  | 'userManagement'
  | 'uiCustomization'
  | 'analytics'
  | 'integrations';

export interface ChatLogRecord {
  id: string;
  userId: string;
  startedAt: string;
  lastMessageAt: string;
  messages: number;
  keywords: string[];
  status: 'active' | 'archived' | 'flagged';
}

export interface PromptConfig {
  id: string;
  label: string;
  placeholder: string;
  value: string;
}

export interface TrendData {
  labels: string[];
  values: number[];
}

export interface AdminUserInfo {
  role?: string | null;
  displayName?: string | null;
  email?: string | null;
}

export type AnimationToggleState = Record<string, boolean>;

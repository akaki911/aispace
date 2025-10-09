export interface MemoryFeatureToggle {
  id: string;
  label: string;
  enabled: boolean;
  description?: string;
}

export interface MemoryControls {
  toggles: MemoryFeatureToggle[];
  referenceSavedMemories?: boolean;
  referenceChatHistory?: boolean;
  lastUpdated?: string | null;
}

export interface SavedMemoryEntry {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt?: string | null;
  lastAccessedAt?: string | null;
  importance: 'low' | 'medium' | 'high';
  key?: string;
  value?: unknown;
  tags?: string[];
  ownerName?: string | null;
  source?: string | null;
  userConfirmed?: boolean;
  confidenceScore?: number | null;
  usageCount?: number;
  conversationCount?: number;
  logCount?: number;
  errorCount?: number;
  warningCount?: number;
  syncStatus?: 'synced' | 'syncing' | 'pending' | 'error';
  syncProgress?: number | null;
}

export interface MemoryDashboardMetrics {
  totalMemories: number;
  activeFeatures: number;
  archivedMemories: number;
  averageEmbeddingScore: number;
  healthScore?: number;
  lastActivity?: string | null;
  logCount?: number;
  errorCount?: number;
  warningCount?: number;
  averageConfidence?: number;
  total?: number;
  confirmed?: number;
  pending?: number;
  log?: number;
  error?: number;
  warning?: number;
  synced?: number;
  syncing?: number;
  failing?: number;
}

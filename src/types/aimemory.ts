export interface MemoryControls {
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  lastUpdated?: string | null;
}

export interface SavedMemoryEntry {
  id: string;
  key: string;
  value: string | Record<string, unknown> | null;
  userConfirmed: boolean;
  summary?: string | null;
  tags?: string[];
  source?: string | null;
  ownerName?: string | null;
  confidenceScore?: number | null;
  syncStatus?: 'synced' | 'syncing' | 'pending' | 'error';
  syncProgress?: number | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  lastAccessedAt?: string | null;
  usageCount?: number | null;
  conversationCount?: number | null;
  logCount?: number | null;
  errorCount?: number | null;
  warningCount?: number | null;
}

export interface MemoryDashboardMetrics {
  total?: number;
  confirmed?: number;
  pending?: number;
  logCount?: number;
  errorCount?: number;
  warningCount?: number;
  synced?: number;
  syncing?: number;
  failing?: number;
  healthScore?: number;
  averageConfidence?: number;
  lastActivity?: string | null;
}

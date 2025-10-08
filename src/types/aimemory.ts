export interface MemoryControls {
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  lastUpdated?: string | null;
}

export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low' | null;

export interface SavedMemoryEntry {
  id: string;
  key: string;
  value?: unknown;
  title?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  ownerName?: string | null;
  userConfirmed?: boolean;
  confidenceScore?: number | null;
  logCount?: number | null;
  errorCount?: number | null;
  warningCount?: number | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  lastAccessedAt?: string | null;
  source?: string | null;
  category?: string | null;
  type?: string | null;
  importance?: MemoryImportance;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed' | 'error' | null;
  syncProgress?: number | null;
  usageCount?: number | null;
  conversationCount?: number | null;
  ownerId?: string | null;
  lastEditor?: string | null;
}

export interface MemoryDashboardMetrics {
  total: number;
  confirmed: number;
  pending: number;
  logCount: number;
  errorCount: number;
  warningCount: number;
  averageConfidence: number;
  synced: number;
  syncing: number;
  failing: number;
  healthScore: number;
  lastActivity: string | null;
}

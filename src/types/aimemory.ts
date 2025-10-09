export interface MemoryFeatureToggle {
  id: string;
  label: string;
  enabled: boolean;
  description?: string;
}

export interface MemoryControls {
  toggles: MemoryFeatureToggle[];
}

export interface SavedMemoryEntry {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  importance: 'low' | 'medium' | 'high';
}

export interface MemoryDashboardMetrics {
  totalMemories: number;
  activeFeatures: number;
  archivedMemories: number;
  averageEmbeddingScore: number;
}

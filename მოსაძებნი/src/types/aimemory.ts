export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ActionCategory = 'file' | 'rule' | 'error' | 'chat' | 'system';

export interface ErrorLog {
  id: string;
  file?: string;
  line?: number;
  column?: number;
  error: string;
  severity: ErrorSeverity;
  ts: number;
  meta?: Record<string, unknown>;
}

export interface GuruloInteraction {
  id: string;
  query: string;
  response: string;
  context: string;
  timestamp: number;
  satisfaction?: 'good' | 'neutral' | 'bad';
}

export interface GuruloContext {
  id: string;
  projectName: string;
  currentTask: string;
  workingFiles: string[];
  lastActivity: string;
  timestamp: number;
}

export interface GuruloPreferences {
  responseStyle: 'detailed' | 'concise' | 'technical';
  language: 'ka' | 'en' | 'mixed';
  codeCommentStyle: 'georgian' | 'english' | 'mixed';
  explanationLevel: 'beginner' | 'intermediate' | 'expert';
}

export interface GuruloFact {
  id: string;
  category: 'personal' | 'project' | 'technical' | 'preference';
  fact: string;
  confidence: number;
  timestamp: number;
  source: 'user_stated' | 'gurulo_inferred' | 'code_analysis';
}

export interface CodePreference {
  id: string;
  name: string;
  type: "preferred" | "avoid";
  description: string;
  example?: string;
  category: "general" | "react" | "typescript" | "styling" | "performance";
  isActive: boolean;
}

export interface AIMemoryData {
  personalInfo: { language: string; role: string; codeStyle: string; };
  savedRules: Array<{ id:string; name:string; body:string; updatedAt:number }>;
  errorLogs: ErrorLog[];
  contextActions: Array<{ id:string; category:ActionCategory; payload:any; ts:number }>;
  codePreferences: CodePreference[];
  stats: { accuracy:number; items:number; memoryMB:number; lastSync:number; };
  // გურულოს სპეციფიკური მეხსიერება
  guruloInteractions: GuruloInteraction[];
  guruloContext: GuruloContext[];
  guruloPreferences: GuruloPreferences;
  guruloFacts: GuruloFact[];
  savedMemories?: SavedMemoryEntry[];
  memoryControls?: MemoryControls;
}

export interface SavedMemoryEntry {
  id: string;
  key: string;
  value: string | Record<string, unknown>;
  userConfirmed: boolean;
  createdAt?: string;
  updatedAt?: string | null;
  lastAccessedAt?: string | null;
  source?: string;
  ownerId?: string;
  ownerName?: string;
  ownerAvatarUrl?: string;
  tags?: string[];
  summary?: string;
  logCount?: number;
  warningCount?: number;
  errorCount?: number;
  conversationCount?: number;
  usageCount?: number;
  confidenceScore?: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error';
  syncProgress?: number;
}

export interface MemoryDashboardMetrics {
  total: number;
  confirmed: number;
  pending: number;
  logCount: number;
  errorCount: number;
  warningCount: number;
  averageConfidence: number;
  syncing: number;
  synced: number;
  failing: number;
  healthScore: number;
  lastActivity?: string | null;
}

export interface MemoryControls {
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  lastUpdated?: string | null;
}

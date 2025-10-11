// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Pencil,
  Trash2,
  Plus,
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  MessageSquareText,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ka } from 'date-fns/locale';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import GeorgianLanguageEnhancer, {
  GeorgianTextAnalysis,
  TransliterationResult,
} from '../utils/georgianLanguageEnhancer';
import { useAssistantMode } from '../contexts/useAssistantMode';

interface MemoryEntry {
  id: string;
  type: 'fact' | 'grammar';
  content: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastUsedAt?: string | null;
  usageCount?: number;
  usedInConversation?: boolean;
  metadata?: {
    tags?: string[];
    original?: string;
    analysis?: GeorgianTextAnalysis | null;
    corrections?: TransliterationResult | null;
    confidence?: number;
    source?: string;
    [key: string]: any;
  };
}

interface MemoryState {
  mainMemory: string;
  mainMemoryAnalysis?: GeorgianTextAnalysis | null;
  facts: MemoryEntry[];
  grammar: MemoryEntry[];
  stats: {
    totalFacts: number;
    totalGrammar: number;
    lastSync?: string;
  };
  lastUpdated?: string;
}

const createInitialState = (): MemoryState => ({
  mainMemory: '',
  mainMemoryAnalysis: null,
  facts: [],
  grammar: [],
  stats: {
    totalFacts: 0,
    totalGrammar: 0,
    lastSync: undefined,
  },
  lastUpdated: undefined,
});

const sanitizeMarkdown = (content: string) => {
  const parsed = marked.parse(content, { gfm: true, breaks: true });
  return { __html: DOMPurify.sanitize(parsed) };
};

const MemoryPage: React.FC = () => {
  const { user } = useAuth();
  const { isReadOnly } = useAssistantMode();
  const [targetUserId, setTargetUserId] = useState(() => user?.personalId || user?.id || '');
  const [memoryState, setMemoryState] = useState<MemoryState>(createInitialState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newEntryType, setNewEntryType] = useState<'fact' | 'grammar'>('fact');
  const [newEntryContent, setNewEntryContent] = useState('');
  const [newEntryTags, setNewEntryTags] = useState('');
  const [activeTab, setActiveTab] = useState<'facts' | 'grammar' | 'all'>('facts');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [processingEntryId, setProcessingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const enhancerRef = useRef<GeorgianLanguageEnhancer | null>(null);
  const serverSnapshotRef = useRef<any>({});

  useEffect(() => {
    if (user?.personalId && !targetUserId) {
      setTargetUserId(user.personalId);
    }
  }, [user, targetUserId]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const showReadOnlyWarning = useCallback(
    (action: string) => {
      if (!isReadOnly) return false;
      const message = `Plan Mode-ში ${action} დროებით მიუწვდომელია. Build Mode ჩართეთ რომ გააგრძელოთ.`;
      toast.error(message);
      setValidationMessage(message);
      return true;
    },
    [isReadOnly],
  );

  const normalizeEntries = useCallback((entries: any[], type: 'fact' | 'grammar'): MemoryEntry[] => {
    if (!Array.isArray(entries)) return [];
    return entries.map((raw, index) => {
      const rawContent = raw?.content ?? raw?.corrected ?? raw?.data ?? raw?.text ?? raw ?? '';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);
      const baseId = raw?.id || raw?.memoryId || raw?.itemId || `${type}-${index}-${Date.now()}`;
      const tags = Array.isArray(raw?.tags)
        ? raw.tags
        : typeof raw?.tags === 'string'
          ? raw.tags
              .split(',')
              .map((tag: string) => tag.trim())
              .filter(Boolean)
          : [];
      return {
        id: String(baseId),
        type,
        content,
        createdAt: raw?.createdAt || raw?.timestamp || raw?.ts || raw?.updatedAt,
        updatedAt: raw?.updatedAt || raw?.timestamp,
        createdBy: raw?.createdBy || raw?.author || raw?.userId,
        lastUsedAt: raw?.lastUsedAt || raw?.lastUsed || null,
        usageCount: raw?.usageCount ?? raw?.uses ?? 0,
        usedInConversation: Boolean(raw?.usedInConversation || raw?.lastUsedAt || raw?.usageCount),
        metadata: {
          tags,
          original: raw?.original,
          analysis: raw?.analysis || raw?.grammarAnalysis,
          corrections: raw?.corrections || raw?.transliteration || null,
          confidence: raw?.confidence,
          source: raw?.source,
        },
      } as MemoryEntry;
    });
  }, []);

  const normalizeMemory = useCallback((viewData: any, fallbackData: any): MemoryState => {
    const viewContent = viewData?.data ? viewData.data : viewData || {};
    const fallbackContent = fallbackData?.data ? fallbackData.data : fallbackData || {};

    const mainMemory =
      (typeof viewContent?.mainMemory === 'string' ? viewContent.mainMemory : null) ||
      (typeof fallbackContent?.mainMemory === 'string' ? fallbackContent.mainMemory : null) ||
      (typeof fallbackContent?.data === 'string' ? fallbackContent.data : null) ||
      '';
    const facts = normalizeEntries(
      viewContent?.facts || fallbackContent?.facts || fallbackContent?.entries || [],
      'fact',
    );
    const grammar = normalizeEntries(
      viewContent?.grammarFixes || fallbackContent?.grammarFixes || [],
      'grammar',
    );

    const stats = {
      totalFacts: facts.length,
      totalGrammar: grammar.length,
      lastSync: viewData?.timestamp || viewContent?.timestamp || fallbackContent?.lastUpdated || fallbackData?.lastSyncedAt,
    };

    serverSnapshotRef.current = {
      ...(fallbackContent || {}),
      ...(viewContent || {}),
      mainMemory,
      mainMemoryAnalysis: viewContent?.mainMemoryAnalysis || fallbackContent?.mainMemoryAnalysis || null,
      facts: facts.map(entry => ({
        id: entry.id,
        type: 'fact',
        content: entry.content,
        createdAt: entry.createdAt || new Date().toISOString(),
        createdBy: entry.createdBy,
        lastUsedAt: entry.lastUsedAt,
        usageCount: entry.usageCount,
        usedInConversation: entry.usedInConversation,
        tags: entry.metadata?.tags,
        analysis: entry.metadata?.analysis,
        corrections: entry.metadata?.corrections,
      })),
      grammarFixes: grammar.map(entry => ({
        id: entry.id,
        type: 'grammar_correction',
        corrected: entry.content,
        createdAt: entry.createdAt || new Date().toISOString(),
        createdBy: entry.createdBy,
        lastUsedAt: entry.lastUsedAt,
        usageCount: entry.usageCount,
        usedInConversation: entry.usedInConversation,
        tags: entry.metadata?.tags,
        analysis: entry.metadata?.analysis,
        original: entry.metadata?.original,
        corrections: entry.metadata?.corrections,
      })),
    };

    return {
      mainMemory,
      mainMemoryAnalysis: viewContent?.mainMemoryAnalysis || fallbackContent?.mainMemoryAnalysis || null,
      facts,
      grammar,
      stats,
      lastUpdated: viewData?.timestamp || viewContent?.timestamp || fallbackContent?.lastUpdated,
    };
  }, [normalizeEntries]);

  const buildPayload = useCallback((state: MemoryState) => {
    const baseRaw = serverSnapshotRef.current || {};
    const { success, meta, data: nestedData, ...rest } = baseRaw;
    const base = typeof nestedData === 'object' && nestedData !== null ? { ...nestedData, ...rest } : baseRaw;
    const timestamp = new Date().toISOString();
    const nextStats = {
      ...(base.stats || {}),
      totalFacts: state.facts.length,
      totalGrammar: state.grammar.length,
      lastSync: timestamp,
      lastUpdate: timestamp,
      itemsCount: {
        facts: state.facts.length,
        grammarFixes: state.grammar.length,
      },
    };

    return {
      ...base,
      mainMemory: state.mainMemory,
      mainMemoryAnalysis: state.mainMemoryAnalysis || null,
      facts: state.facts.map(entry => ({
        id: entry.id,
        type: 'fact',
        content: entry.content,
        createdAt: entry.createdAt || timestamp,
        updatedAt: entry.updatedAt || timestamp,
        createdBy: entry.createdBy || targetUserId,
        lastUsedAt: entry.lastUsedAt || null,
        usageCount: entry.usageCount ?? 0,
        usedInConversation: entry.usedInConversation ?? false,
        tags: entry.metadata?.tags || [],
        analysis: entry.metadata?.analysis,
        confidence: entry.metadata?.confidence,
        source: entry.metadata?.source,
        corrections: entry.metadata?.corrections,
        original: entry.metadata?.original,
      })),
      grammarFixes: state.grammar.map(entry => ({
        id: entry.id,
        type: 'grammar_correction',
        corrected: entry.content,
        createdAt: entry.createdAt || timestamp,
        updatedAt: entry.updatedAt || timestamp,
        createdBy: entry.createdBy || targetUserId,
        lastUsedAt: entry.lastUsedAt || null,
        usageCount: entry.usageCount ?? 0,
        usedInConversation: entry.usedInConversation ?? false,
        tags: entry.metadata?.tags || [],
        analysis: entry.metadata?.analysis,
        confidence: entry.metadata?.confidence,
        original: entry.metadata?.original,
        corrections: entry.metadata?.corrections,
      })),
      stats: nextStats,
      lastUpdated: timestamp,
      lastSyncedAt: timestamp,
    };
  }, [targetUserId]);

  const applyGrammarEnhancement = useCallback((content: string) => {
    try {
      if (!enhancerRef.current) {
        enhancerRef.current = new GeorgianLanguageEnhancer({
          enableAutoCorrection: true,
          preserveEnglishTerms: true,
          regionalDialect: 'gurian',
          enableMixedLanguageFormatting: true,
          enableTransliteration: true,
          enableCodeCommentHighlighting: true,
        });
      }
      const enhancer = enhancerRef.current;
      const result = enhancer.enhanceContent(content.trim());
      return {
        content: result.enhanced.trim(),
        analysis: result.analysis,
        corrections: result.corrections,
      };
    } catch (err) {
      console.error('❌ Georgian grammar enhancement failed:', err);
      return {
        content: content.trim(),
        analysis: null,
        corrections: null,
      };
    }
  }, []);

  const fetchMemory = useCallback(async () => {
    if (!targetUserId) {
      setError('მომხმარებლის იდენტიფიკატორი არ არის მითითებული');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      const body = JSON.stringify({ personalId: targetUserId });

      let viewResponse: any = null;
      try {
        const res = await fetch('/api/memory/view', {
          method: 'POST',
          headers,
          body,
        });
        if (res.ok) {
          viewResponse = await res.json();
        }
      } catch (viewError) {
        console.warn('Memory view endpoint failed, falling back:', viewError);
      }

      let baseResponse: any = null;
      try {
        const res = await fetch(`/api/memory/${encodeURIComponent(targetUserId)}`);
        if (res.ok) {
          baseResponse = await res.json();
        }
      } catch (fallbackError) {
        console.warn('Memory base endpoint failed:', fallbackError);
      }

      if (!viewResponse && !baseResponse) {
        throw new Error('მეხსიერების მონაცემები ვერ ჩაიტვირთა');
      }

      const normalized = normalizeMemory(viewResponse, baseResponse);
      setMemoryState(normalized);
      setOperationMessage('მეხსიერების მონაცემები განახლდა');
    } catch (err: any) {
      console.error('❌ Memory load failed:', err);
      setError(err?.message || 'ვერ მოხერხდა მეხსიერების ჩატვირთვა');
      toast.error(err?.message || 'ვერ მოხერხდა მეხსიერების ჩატვირთვა');
    } finally {
      setLoading(false);
    }
  }, [normalizeMemory, targetUserId]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  const persistMemory = useCallback(
    async (nextState: MemoryState, optimisticBackup?: MemoryState) => {
      setSaving(true);
      try {
        const payload = buildPayload(nextState);
        const res = await fetch(`/api/memory/${encodeURIComponent(targetUserId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`ვერ მოხერხდა მეხსიერების შენახვა (${res.status})`);
        }

        const data = await res.json();
        serverSnapshotRef.current = {
          ...payload,
          ...(data?.data || data || {}),
        };

        setMemoryState(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            totalFacts: nextState.facts.length,
            totalGrammar: nextState.grammar.length,
            lastSync: data?.lastUpdated || payload.lastUpdated,
          },
          mainMemoryAnalysis: nextState.mainMemoryAnalysis ?? prev.mainMemoryAnalysis,
          lastUpdated: data?.lastUpdated || payload.lastUpdated,
        }));

        toast.success('მეხსიერება წარმატებით შეინახა');
      } catch (err: any) {
        if (optimisticBackup) {
          setMemoryState(optimisticBackup);
        }
        console.error('❌ Memory save failed:', err);
        toast.error(err?.message || 'შენახვა ვერ მოხერხდა');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, targetUserId],
  );

  const canEditEntry = useCallback(
    (entry: MemoryEntry) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      const userId = user.personalId || user.id;
      return !entry.createdBy || entry.createdBy === userId;
    },
    [isSuperAdmin, user],
  );

  const handleEditEntry = (entry: MemoryEntry) => {
    if (!canEditEntry(entry)) {
      toast.error('შეცვლის უფლება არ გაქვთ');
      return;
    }
    if (showReadOnlyWarning('ჩანაწერის რედაქტირება')) {
      return;
    }
    setEditingEntryId(entry.id);
    setEditingContent(entry.content);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingContent('');
  };

  const handleSaveEntry = async (entryId: string) => {
    const entryRef =
      memoryState.facts.find(entry => entry.id === entryId) ||
      memoryState.grammar.find(entry => entry.id === entryId);
    if (entryRef && !canEditEntry(entryRef)) {
      toast.error('შეცვლის უფლება არ გაქვთ');
      return;
    }
    if (showReadOnlyWarning('ჩანაწერის შენახვა')) {
      return;
    }
    const trimmed = editingContent.trim();
    if (!trimmed) {
      setValidationMessage('გთხოვთ შეიყვანოთ ტექსტი');
      return;
    }

    setValidationMessage(null);
    const prevState = memoryState;
    const entryType = memoryState.facts.find(entry => entry.id === entryId) ? 'facts' : 'grammar';
    const isGrammar = entryType === 'grammar';

    const { content, analysis, corrections } = applyGrammarEnhancement(trimmed);

    const updatedEntries = memoryState[isGrammar ? 'grammar' : 'facts'].map(entry =>
      entry.id === entryId
        ? {
            ...entry,
            content,
            updatedAt: new Date().toISOString(),
            metadata: {
              ...entry.metadata,
              analysis,
              corrections,
              original: trimmed,
            },
          }
        : entry,
    );

    const optimistic: MemoryState = {
      ...memoryState,
      [isGrammar ? 'grammar' : 'facts']: updatedEntries,
    };

    setMemoryState(optimistic);
    setEditingEntryId(null);
    setEditingContent('');
    setProcessingEntryId(entryId);

    try {
      await persistMemory(optimistic, prevState);
    } catch (err) {
      // handled in persist
    } finally {
      setProcessingEntryId(null);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const entryRef =
      memoryState.facts.find(entry => entry.id === entryId) ||
      memoryState.grammar.find(entry => entry.id === entryId);
    if (entryRef && !canEditEntry(entryRef)) {
      toast.error('ჩანაწერის წაშლა არ შეგიძლიათ');
      return;
    }
    if (showReadOnlyWarning('ჩანაწერის წაშლა')) {
      return;
    }
    const prevState = memoryState;
    const updatedFacts = memoryState.facts.filter(entry => entry.id !== entryId);
    const updatedGrammar = memoryState.grammar.filter(entry => entry.id !== entryId);

    const optimistic: MemoryState = {
      ...memoryState,
      facts: updatedFacts,
      grammar: updatedGrammar,
    };

    setDeletingEntryId(entryId);
    setMemoryState(optimistic);

    try {
      await persistMemory(optimistic, prevState);
      toast.success('მეხსიერების ჩანაწერი წაიშალა');
    } catch (err) {
      // handled in persist
    } finally {
      setDeletingEntryId(null);
    }
  };

  const handleCreateEntry = async () => {
    if (showReadOnlyWarning('ახალი ჩანაწერის შექმნა')) {
      return;
    }
    const trimmed = newEntryContent.trim();
    if (!trimmed) {
      setValidationMessage('გთხოვთ შეიყვანოთ ტექსტი');
      return;
    }

    setValidationMessage(null);
    const { content, analysis, corrections } = applyGrammarEnhancement(trimmed);

    const timestamp = new Date().toISOString();
    const createdBy = user?.personalId || user?.id || 'unknown';
    const entry: MemoryEntry = {
      id: `temp-${Date.now()}`,
      type: newEntryType,
      content,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy,
      lastUsedAt: null,
      usageCount: 0,
      usedInConversation: false,
      metadata: {
        analysis,
        corrections,
        original: trimmed,
        tags: newEntryTags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
        source: 'manual',
      },
    };

    const prevState = memoryState;
    const optimistic: MemoryState = {
      ...memoryState,
      facts: newEntryType === 'fact' ? [entry, ...memoryState.facts] : memoryState.facts,
      grammar: newEntryType === 'grammar' ? [entry, ...memoryState.grammar] : memoryState.grammar,
    };

    setCreateLoading(true);
    setMemoryState(optimistic);
    setDrawerOpen(false);
    setNewEntryContent('');
    setNewEntryTags('');

    try {
      await persistMemory(optimistic, prevState);
    } catch (err) {
      // handled in persist
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveMainMemory = async () => {
    if (showReadOnlyWarning('მთავარი მეხსიერების განახლება')) {
      return;
    }
    const trimmed = memoryState.mainMemory.trim();
    if (!trimmed) {
      setValidationMessage('მთავარი მეხსიერება ცარიელია');
      return;
    }

    setValidationMessage(null);
    const { content, analysis } = applyGrammarEnhancement(trimmed);
    const prevState = memoryState;
    const optimistic: MemoryState = {
      ...memoryState,
      mainMemory: content,
      mainMemoryAnalysis: analysis,
      stats: {
        ...memoryState.stats,
        lastSync: new Date().toISOString(),
      },
    };

    setMemoryState(optimistic);

    try {
      await persistMemory({ ...optimistic, mainMemory: content }, prevState);
      toast.success('მთავარი მეხსიერება განახლდა');
      setOperationMessage('გრამატიკული გაუმჯობესება წარმატებით შესრულდა');
    } catch (err) {
      // handled in persist
    }
  };

  const filteredEntries = useMemo(() => {
    const entries =
      activeTab === 'facts'
        ? memoryState.facts
        : activeTab === 'grammar'
          ? memoryState.grammar
          : [...memoryState.facts, ...memoryState.grammar];

    const sorted = [...entries].sort((a, b) => {
      const getTime = (entry: MemoryEntry) => {
        const candidate = entry.lastUsedAt || entry.updatedAt || entry.createdAt;
        if (!candidate) return 0;
        try {
          return new Date(candidate).getTime();
        } catch {
          return 0;
        }
      };
      return getTime(b) - getTime(a);
    });

    if (!searchQuery.trim()) {
      return sorted;
    }

    const query = searchQuery.trim().toLowerCase();
    return sorted.filter(entry =>
      [
        entry.content,
        entry.metadata?.original,
        ...(entry.metadata?.tags || []),
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query)),
    );
  }, [activeTab, memoryState.facts, memoryState.grammar, searchQuery]);

  const renderUsageBadge = (entry: MemoryEntry) => {
    const recentlyUsed = entry.lastUsedAt
      ? (() => {
          try {
            const lastUsed = typeof entry.lastUsedAt === 'string' ? parseISO(entry.lastUsedAt) : new Date(entry.lastUsedAt);
            const diff = Date.now() - lastUsed.getTime();
            return diff < 48 * 60 * 60 * 1000;
          } catch {
            return false;
          }
        })()
      : false;

    if (entry.usedInConversation) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
          <MessageSquareText className="h-3 w-3" /> დიალოგში გამოყენებული
          {entry.usageCount && entry.usageCount > 0 ? ` ×${entry.usageCount}` : ''}
        </span>
      );
    }

    if (entry.usageCount && entry.usageCount > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="h-3 w-3" /> {entry.usageCount} გამოყენება
        </span>
      );
    }

    if (recentlyUsed) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
          <Clock className="h-3 w-3" /> ახლახანს გამოყენებული
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-300">
        <Sparkles className="h-3 w-3" /> მზად არის გამოყენებისთვის
      </span>
    );
  };

  const renderAnalysisSummary = (entry: MemoryEntry) => {
    const analysis = entry.metadata?.analysis as GeorgianTextAnalysis | undefined;
    if (!analysis || typeof analysis !== 'object') {
      return null;
    }

    const suggestedCorrections = Array.isArray(analysis.suggestedCorrections)
      ? analysis.suggestedCorrections.slice(0, 3)
      : [];
    const corrections = entry.metadata?.corrections as TransliterationResult | null;

    return (
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">ქართული შიგთავსი</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              {typeof analysis.georgianPercentage === 'number'
                ? `${Math.round(analysis.georgianPercentage)}%`
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">ინგლისური ტექსტი</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{analysis.hasEnglishText ? 'კი' : 'არა'}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">კოდის ბლოკები</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{analysis.hasCodeBlocks ? 'კი' : 'არა'}</p>
          </div>
        </div>

        {suggestedCorrections.length > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
            <p className="text-[11px] uppercase tracking-wide text-blue-200">შემოთავაზებული გასწორებები</p>
            <ul className="mt-2 space-y-1">
              {suggestedCorrections.map((item, index) => (
                <li key={`${item.original}-${index}`} className="flex items-center gap-2">
                  <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-100">
                    {Math.round((item.confidence ?? 0) * 100)}%
                  </span>
                  <span className="text-blue-100/80">
                    {item.original} → <span className="font-medium text-blue-50">{item.corrected}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {corrections && corrections.transliteratedText && corrections.transliteratedText !== corrections.originalText && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-100">
            <p className="text-[11px] uppercase tracking-wide text-purple-200">ტრანსლიტერაცია შესრულდა</p>
            <p className="mt-1 text-purple-100/80">
              {corrections.transliteratedText}
            </p>
          </div>
        )}
      </div>
    );
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return '—';
    try {
      const date = parseISO(value);
      return formatDistanceToNow(date, { addSuffix: true, locale: ka });
    } catch {
      return value;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <BrainIcon />
              </div>
              <div>
                <h1 className="text-3xl font-semibold">გურულოს მეხსიერება</h1>
                <p className="text-sm text-slate-400">
                  გააუმჯობესეთ გურულოს კონტექსტი ზუსტად და გრამატიკულად სწორად
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">მომხმარებლის ID</label>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                {isSuperAdmin ? (
                  <input
                    className="bg-transparent outline-none text-sm"
                    value={targetUserId}
                    onChange={event => setTargetUserId(event.target.value)}
                    placeholder="0101…"
                  />
                ) : (
                  <span className="text-sm text-slate-300">{targetUserId || '—'}</span>
                )}
                {!isSuperAdmin && <Lock className="h-4 w-4 text-slate-500" />}
              </div>
            </div>
            <button
              onClick={() => fetchMemory()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm font-medium transition"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              განახლება
            </button>
          </div>
        </header>

        {isReadOnly && (
          <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 text-amber-100 shadow-inner">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide">Plan Mode აქტიურია</p>
                <p className="text-sm text-amber-100/90">
                  მეხსიერების ჩანაწერები დაცულია ცვლილებებისგან. გადადით პარამეტრებში რათა ჩართოთ Build Mode.
                </p>
              </div>
            </div>
            <div>
              <Link
                to="/admin/ai-developer?tab=settings"
                className="inline-flex items-center justify-center rounded-lg border border-amber-400/60 bg-amber-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 hover:bg-amber-400/30"
              >
                გახსენით პარამეტრები
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">შეცდომა</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {operationMessage && (
          <div className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">გაფრთხილება</p>
              <p>{operationMessage}</p>
            </div>
            <button onClick={() => setOperationMessage(null)} className="ml-auto text-emerald-200 hover:text-emerald-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3 mb-10">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">ფაქტები</p>
            <p className="text-3xl font-semibold text-white">{memoryState.stats.totalFacts}</p>
            <p className="text-xs text-slate-500 mt-1">გურულოს ხანგრძლივი კონტექსტი</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">გრამატიკა</p>
            <p className="text-3xl font-semibold text-white">{memoryState.stats.totalGrammar}</p>
            <p className="text-xs text-slate-500 mt-1">ავტომატური გაუმჯობესებები</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">ბოლო სინქი</p>
            <p className="text-lg font-medium text-white">
              {memoryState.stats.lastSync ? formatTimestamp(memoryState.stats.lastSync) : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">შენახვა {saving ? 'მიმდინარეობს…' : 'აქტუალურია'}</p>
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">მთავარი მეხსიერება</h2>
            <button
              onClick={handleSaveMainMemory}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium transition"
              disabled={saving || isReadOnly}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isReadOnly ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'შენახვა…' : isReadOnly ? 'დაბლოკილია' : 'შენახვა'}
            </button>
          </div>
          <textarea
            value={memoryState.mainMemory}
            onChange={event => setMemoryState(prev => ({ ...prev, mainMemory: event.target.value }))}
            className="w-full min-h-[160px] rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="გურულოს ძირითადი კონტექსტი…"
            disabled={isReadOnly}
          />
          <p className="mt-2 text-xs text-slate-500">
            ცვლილებებისას შინაარსი ავტომატურად გაივლის ქართულ გრამატიკულ გაუმჯობესებას.
          </p>
          {memoryState.mainMemoryAnalysis && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">ქართული შიგთავსი</p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {typeof memoryState.mainMemoryAnalysis.georgianPercentage === 'number'
                    ? `${Math.round(memoryState.mainMemoryAnalysis.georgianPercentage)}%`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">ინგლისური ტექსტი</p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {memoryState.mainMemoryAnalysis.hasEnglishText ? 'კი' : 'არა'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">კოდის ბლოკები</p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {memoryState.mainMemoryAnalysis.hasCodeBlocks ? 'არსებობს' : 'არა'}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg p-1">
              <TabButton label="ფაქტები" active={activeTab === 'facts'} onClick={() => setActiveTab('facts')} />
              <TabButton label="გრამატიკა" active={activeTab === 'grammar'} onClick={() => setActiveTab('grammar')} />
              <TabButton label="ყველა" active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <input
                  className="bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  placeholder="ძიება მეხსიერებაში…"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  if (showReadOnlyWarning('ახალი ჩანაწერის დამატება')) {
                    return;
                  }
                  setDrawerOpen(true);
                  setNewEntryType('fact');
                  setNewEntryContent('');
                  setNewEntryTags('');
                  setValidationMessage(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                disabled={isReadOnly || createLoading}
              >
                <Plus className="h-4 w-4" /> ახალი ჩანაწერი
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredEntries.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                ჩანაწერები ვერ მოიძებნა
              </div>
            )}

            {filteredEntries.map(entry => (
              <article
                key={entry.id}
                className={`rounded-xl border ${
                  selectedEntryId === entry.id ? 'border-blue-600 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]' : 'border-slate-800'
                } bg-slate-950/60 p-5 transition hover:border-blue-600/60`}
                onMouseEnter={() => setSelectedEntryId(entry.id)}
                onMouseLeave={() => setSelectedEntryId(null)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                        entry.type === 'fact'
                          ? 'bg-purple-500/10 text-purple-200 border border-purple-500/30'
                          : 'bg-orange-500/10 text-orange-200 border border-orange-500/30'
                      }`}
                    >
                      {entry.type === 'fact' ? 'ფაქტი' : 'გრამატიკა'}
                    </span>
                    {renderUsageBadge(entry)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {entry.createdBy ? `შექმნა ${entry.createdBy}` : 'ავტორი უცნობია'}
                    <Clock className="h-3.5 w-3.5 ml-2" /> {formatTimestamp(entry.createdAt)}
                  </div>
                </div>

                {editingEntryId === entry.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editingContent}
                      onChange={event => setEditingContent(event.target.value)}
                      className="w-full min-h-[120px] rounded-lg border border-blue-500/50 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEntry(entry.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-medium"
                        disabled={processingEntryId === entry.id || saving}
                      >
                        {processingEntryId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        შენახვა
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium"
                        disabled={processingEntryId === entry.id}
                      >
                        გაუქმება
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={sanitizeMarkdown(entry.content)} />

                    {entry.metadata?.original && entry.metadata?.original.trim() && entry.metadata?.original.trim() !== entry.content.trim() && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">შემოტანილი ტექსტი</p>
                        <div
                          className="prose prose-invert max-w-none text-xs leading-relaxed"
                          dangerouslySetInnerHTML={sanitizeMarkdown(entry.metadata.original)}
                        />
                      </div>
                    )}

                    {entry.metadata?.tags && entry.metadata.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                        {entry.metadata.tags.map(tag => (
                          <span key={tag} className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {renderAnalysisSummary(entry)}
                  </div>
                )}

                <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>ბოლო გამოყენება: {formatTimestamp(entry.lastUsedAt)}</span>
                    <span>რაოდენობა: {entry.usageCount ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs hover:border-blue-500 hover:text-blue-300 disabled:opacity-40"
                      disabled={!canEditEntry(entry) || isReadOnly || saving || deletingEntryId === entry.id}
                    >
                      <Pencil className="h-3.5 w-3.5" /> რედაქტირება
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-600/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                      disabled={deletingEntryId === entry.id || isReadOnly || !canEditEntry(entry)}
                    >
                      {deletingEntryId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} წაშლა
                    </button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-slate-950/70 backdrop-blur" onClick={() => setDrawerOpen(false)} />
            <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-semibold">ახალი მეხსიერების ჩანაწერი</h3>
                  <p className="text-xs text-slate-400 mt-1">შენახვის წინ ტექსტი ავტომატურად კორექტირდება</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-5">
                {isReadOnly && (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Plan Mode აქტიურია – ახალი ჩანაწერის შენახვა დროებით შეზღუდულია.
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-500">ჩანაწერის ტიპი</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNewEntryType('fact')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        newEntryType === 'fact'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-100'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      ფაქტი
                    </button>
                    <button
                      onClick={() => setNewEntryType('grammar')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        newEntryType === 'grammar'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-100'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      გრამატიკა
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-500">შემოსატანი ტექსტი</label>
                  <textarea
                    value={newEntryContent}
                    onChange={event => setNewEntryContent(event.target.value)}
                    className="w-full min-h-[140px] rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="გურულოსთვის ახალი ინფორმაცია…"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-500">თეგები</label>
                  <input
                    value={newEntryTags}
                    onChange={event => setNewEntryTags(event.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="მაგ: კლიენტი, პროექტი, გურია"
                  />
                </div>

                {validationMessage && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {validationMessage}
                  </div>
                )}

                <button
                  onClick={handleCreateEntry}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                  disabled={createLoading || isReadOnly}
                >
                  {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {createLoading ? 'შენახვა მიმდინარეობს…' : 'შენახვა გურულოს მეხსიერებაში'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    {label}
  </button>
);

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-400">
    <path
      fill="currentColor"
      d="M9 2a3 3 0 0 0-3 3v.278A4.5 4.5 0 0 0 2 9.5v1A4.5 4.5 0 0 0 5.5 15H6v2a3 3 0 0 0 3 3h1v-5H8a1 1 0 0 1 0-2h2V8H9a1 1 0 1 1 0-2h2V3H9Zm6 0h-2v3h2a1 1 0 1 1 0 2h-2v4h2a1 1 0 1 1 0 2h-2v5h1a3 3 0 0 0 3-3v-2h.5a4.5 4.5 0 0 0 4.5-4.5v-1A4.5 4.5 0 0 0 19 5.278V5a3 3 0 0 0-3-3Z"
    />
  </svg>
);

export default MemoryPage;

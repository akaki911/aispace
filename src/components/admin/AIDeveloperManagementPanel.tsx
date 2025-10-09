import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { UICustomizationSection } from './ai-panel/UICustomizationSection';
import { PromptsPanel } from './ai-panel/PromptsPanel';
import { UsersPanel } from './ai-panel/UsersPanel';
import { AnalyticsPanel } from './ai-panel/AnalyticsPanel';
import {
  HIGHLIGHT_CLASSES,
  SECTION_ID_MAP,
  defaultAnimationState,
  defaultDailyUsage,
  defaultSessionLength,
  initialLogs,
  initialPrompts,
  themePresets,
} from './ai-panel/constants';
import type {
  AnimationToggleState,
  ChatLogRecord,
  GuruloSectionKey,
  PromptConfig,
  TrendData,
} from './ai-panel/types';
export type { GuruloSectionKey } from './ai-panel/types';
import {
  banUser as banUserRequest,
  fetchErrorLogs,
  fetchFallbackStatus,
  rotateKey as rotateKeyRequest,
  savePrompt,
  triggerBackup,
  triggerRestore,
  updateFallbackStatus,
} from '@aispace/services/adminAiApi';

interface AIDeveloperManagementPanelProps {
  focusSection?: GuruloSectionKey | null;
  onSectionFocusHandled?: () => void;
}

type StatusFilter = 'all' | ChatLogRecord['status'];

const FALLBACK_ERROR_LOGS = [
  '2025-02-08 12:41:09 · Rate limit applied for user GUEST-7777',
  '2025-02-06 09:11:44 · Missing fallback translation for en-US',
];

const WEEKDAY_LABELS = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ'];

export default function AIDeveloperManagementPanel({
  focusSection,
  onSectionFocusHandled,
}: AIDeveloperManagementPanelProps) {
  const { user } = useAuth();
  const [promptConfigs, setPromptConfigs] = useState<PromptConfig[]>(initialPrompts);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(initialPrompts[0]?.id ?? 'system-core');
  const [responseLimit, setResponseLimit] = useState(512);
  const [rateLimit, setRateLimit] = useState(30);
  const [filterStrength, setFilterStrength] = useState(65);
  const [chatLogs, setChatLogs] = useState<ChatLogRecord[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [animationToggles, setAnimationToggles] = useState<AnimationToggleState>(defaultAnimationState);
  const [activeTheme, setActiveTheme] = useState(themePresets[0]?.id ?? 'aurora');
  const [primaryColor, setPrimaryColor] = useState('#60a5fa');
  const [secondaryColor, setSecondaryColor] = useState('#22d3ee');
  const [fontFamily, setFontFamily] = useState('"Noto Sans Georgian", "Inter", "Manrope", sans-serif');
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('********-****-****-BKHMR-API');
  const [isRotatingKey, setIsRotatingKey] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<number[]>(defaultDailyUsage);
  const [sessionLength, setSessionLength] = useState<number[]>(defaultSessionLength);
  const [fallbackStatus, setFallbackStatus] = useState<
    | {
        backupMode: boolean;
        forced: boolean;
        provider: string;
        updatedAt: string;
      }
    | null
  >(null);
  const [isUpdatingFallback, setIsUpdatingFallback] = useState(false);

  const activeSessionCount = useMemo(
    () => chatLogs.filter((log) => log.status === 'active').length,
    [chatLogs],
  );
  const flaggedSessionCount = useMemo(
    () => chatLogs.filter((log) => log.status === 'flagged').length,
    [chatLogs],
  );
  const latestUsage = useMemo(() => dailyUsage[dailyUsage.length - 1] ?? 0, [dailyUsage]);
  const previousUsage = useMemo(
    () => (dailyUsage.length > 1 ? dailyUsage[dailyUsage.length - 2] : latestUsage),
    [dailyUsage, latestUsage],
  );
  const usageDelta = useMemo(() => latestUsage - previousUsage, [latestUsage, previousUsage]);
  const averageSessionLength = useMemo(
    () => sessionLength[sessionLength.length - 1] ?? 0,
    [sessionLength],
  );

  const activePrompt = useMemo(
    () => promptConfigs.find((prompt) => prompt.id === selectedPromptId) ?? promptConfigs[0],
    [promptConfigs, selectedPromptId],
  );

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;

    let isMounted = true;

    fetchErrorLogs().then((logs) => {
      if (isMounted) {
        setErrorLogs(logs.length > 0 ? logs : FALLBACK_ERROR_LOGS);
      }
    }).catch((error) => {
      console.warn('Failed to load error logs', error);
      if (isMounted) {
        setErrorLogs(FALLBACK_ERROR_LOGS);
      }
    });

    fetchFallbackStatus()
      .then((status) => {
        if (isMounted) {
          setFallbackStatus(status);
        }
      })
      .catch((error) => {
        console.warn('Failed to load fallback status', error);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  const filteredLogs = useMemo(() => {
    return chatLogs.filter((log) => {
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.keywords.some((keyword) => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [chatLogs, searchTerm, statusFilter]);

  const usageTrend: TrendData = useMemo(
    () => ({
      labels: WEEKDAY_LABELS,
      values: dailyUsage,
    }),
    [dailyUsage],
  );

  const sessionTrend: TrendData = useMemo(
    () => ({
      labels: WEEKDAY_LABELS,
      values: sessionLength,
    }),
    [sessionLength],
  );

  const themePreviewStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      fontFamily,
    }),
    [primaryColor, secondaryColor, fontFamily],
  );

  const toast = useCallback((message: string, isError = false) => {
    const toastEl = document.createElement('div');
    toastEl.textContent = message;
    toastEl.className = `fixed bottom-6 right-6 z-[120] rounded-2xl px-4 py-3 text-sm shadow-lg backdrop-blur ${
      isError ? 'bg-red-500/90 text-white' : 'bg-emerald-500/90 text-white'
    }`;
    document.body.appendChild(toastEl);
    setTimeout(() => {
      document.body.removeChild(toastEl);
    }, 3200);
  }, []);

  const handlePromptChange = useCallback(
    (content: string) => {
      setPromptConfigs((prev) => prev.map((prompt) => (prompt.id === selectedPromptId ? { ...prompt, value: content } : prompt)));
    },
    [selectedPromptId],
  );

  const handleSavePrompt = useCallback(async () => {
    try {
      const payload = promptConfigs.find((prompt) => prompt.id === selectedPromptId);
      if (!payload) return;
      await savePrompt(payload);
      toast('პრომპტი განახლდა წარმატებით');
    } catch (error) {
      console.error('Prompt save failed', error);
      toast('პრომპტი ვერ შენახა', true);
    }
  }, [promptConfigs, selectedPromptId, toast]);

  const handleExportLogs = useCallback(() => {
    const header = 'ID,User,Started,Last Message,Messages,Status\n';
    const rows = filteredLogs
      .map((log) => `${log.id},${log.userId},${log.startedAt},${log.lastMessageAt},${log.messages},${log.status}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ai-chat-logs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const handleBanUser = useCallback(
    async (userId: string) => {
      if (!window.confirm(`დარწმუნებული ხართ, რომ გსურთ მომხმარებლის (${userId}) დაბლოკვა?`)) return;
      try {
        await banUserRequest(userId);
        toast(`მომხმარებელი ${userId} დაიბლოკა`);
      } catch (error) {
        console.error('User ban failed', error);
        toast('მომხმარებლის დაბლოკვა ვერ მოხერხდა', true);
      }
    },
    [toast],
  );

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  }, []);

  const handleToggleAnimation = useCallback((key: string, value: boolean) => {
    setAnimationToggles((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetLimits = useCallback(() => {
    setResponseLimit(512);
    setRateLimit(30);
    setFilterStrength(65);
    toast('პარამეტრები დაბრუნდა საწყის მნიშვნელობებზე');
  }, [toast]);

  const handleRotateKey = useCallback(async () => {
    try {
      setIsRotatingKey(true);
      const newKey = await rotateKeyRequest();
      if (newKey) {
        setApiKey(newKey);
      }
      toast('API გასაღები განახლდა');
    } catch (error) {
      console.error(error);
      toast('API გასაღების განახლება ვერ მოხერხდა', true);
    } finally {
      setIsRotatingKey(false);
    }
  }, [toast]);

  const handleBackup = useCallback(async () => {
    try {
      setIsBackingUp(true);
      await triggerBackup();
      toast('ბექაპი ინიცირებულია');
    } catch (error) {
      console.error('Backup error', error);
      toast('ბექაპი ვერ შესრულდა', true);
    } finally {
      setIsBackingUp(false);
    }
  }, [toast]);

  const handleRestore = useCallback(async () => {
    try {
      setIsRestoring(true);
      await triggerRestore();
      toast('აღდგენა დაწყებულია');
    } catch (error) {
      console.error('Restore error', error);
      toast('აღდგენა ვერ შესრულდა', true);
    } finally {
      setIsRestoring(false);
    }
  }, [toast]);

  const handleArchiveCleanup = useCallback(() => {
    if (selectedRows.length === 0) return;
    setChatLogs((prev) => prev.filter((log) => !selectedRows.includes(log.id)));
    setSelectedRows([]);
    toast('არჩეული სესიები გაიწმინდა');
  }, [selectedRows, toast]);

  const handleMuteUser = useCallback(
    (userId: string) => {
      toast(`მომხმარებელი ${userId} გაიჩუმა 30 წუთით`);
    },
    [toast],
  );

  const handleSimulateUsage = useCallback(() => {
    setDailyUsage((prev) => [...prev.slice(1), Math.max(20, Math.round(Math.random() * 90))]);
  }, []);

  const handleSimulateSessionLength = useCallback(() => {
    setSessionLength((prev) => [...prev.slice(1), Math.max(3, Number((Math.random() * 8).toFixed(1)))]);
  }, []);

  const handleFallbackToggle = useCallback(
    async (enabled: boolean) => {
      if (fallbackStatus?.forced) {
        toast('რეჟიმი იძულებით ჩართულია გარემოს პარამეტრით', true);
        return;
      }

      try {
        setIsUpdatingFallback(true);
        const status = await updateFallbackStatus(enabled);
        setFallbackStatus(status);
        toast(status.backupMode ? 'Backup რეჟიმი ჩაირთო' : 'Backup რეჟიმი გამოირთო');
      } catch (error) {
        console.error('Fallback toggle failed', error);
        toast('Backup რეჟიმის შეცვლა ვერ მოხერხდა', true);
      } finally {
        setIsUpdatingFallback(false);
      }
    },
    [fallbackStatus?.forced, toast],
  );

  useEffect(() => {
    if (!focusSection) return;

    const sectionId = SECTION_ID_MAP[focusSection];
    const element = document.getElementById(sectionId);

    if (!element) {
      onSectionFocusHandled?.();
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.classList.add(...HIGHLIGHT_CLASSES);

    const highlightTimeout = window.setTimeout(() => {
      element.classList.remove(...HIGHLIGHT_CLASSES);
    }, 2400);

    const clearFocusTimeout = window.setTimeout(() => {
      onSectionFocusHandled?.();
    }, 400);

    return () => {
      window.clearTimeout(highlightTimeout);
      window.clearTimeout(clearFocusTimeout);
      element.classList.remove(...HIGHLIGHT_CLASSES);
    };
  }, [focusSection, onSectionFocusHandled]);

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-rose-500/40 bg-[#181C2A]/80 p-10 text-center text-[#FFC1D8] shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,75,142,0.28),transparent_65%)]" />
        <ShieldAlert className="relative mx-auto mb-3 h-9 w-9 text-[#E14B8E]" />
        <p className="relative text-lg font-semibold tracking-tight text-[#FFC1D8]">
          ამ განყოფილებაში მხოლოდ სუპერ ადმინისტრატორს აქვს წვდომა.
        </p>
        <p className="relative mt-2 text-sm text-[#F7C6D7]/80">
          გადადით სხვა ადმინისტრაციულ მოდულზე ან მიმართეთ სისტემის ადმინისტრატორს უფლების გასაქტიურებლად.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto rounded-[32px] bg-gradient-to-b from-[#0E1116] via-[#1A1233] to-[#351D6A] px-6 py-10 text-[#E6E8EC]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(124, 108, 255, 0.45), transparent 55%), radial-gradient(circle at 80% 0%, rgba(37, 217, 142, 0.28), transparent 45%), radial-gradient(circle at 50% 90%, rgba(225, 75, 142, 0.32), transparent 55%)',
        }}
      />
      <div className="relative mx-auto w-full max-w-[1280px] space-y-12 pb-16">
        <AnalyticsPanel
          overviewProps={{
            user,
            onSavePrompt: handleSavePrompt,
            onBackup: handleBackup,
            onRestore: handleRestore,
            isBackingUp,
            isRestoring,
            activeSessionCount,
            flaggedSessionCount,
            errorCount: errorLogs.length,
            latestUsage,
            usageDelta,
            averageSessionLength,
          }}
          analyticsProps={{ usageTrend, sessionTrend, errorLogs }}
          integrationsProps={{
            apiKey,
            onApiKeyChange: setApiKey,
            isRotatingKey,
            onRotateKey: handleRotateKey,
            onQuickAction: toast,
          }}
          fallbackProps={{
            enabled: fallbackStatus?.backupMode ?? false,
            forced: fallbackStatus?.forced ?? false,
            provider: fallbackStatus?.provider ?? 'offline',
            isUpdating: isUpdatingFallback,
            onToggle: handleFallbackToggle,
          }}
        />

        <PromptsPanel
          promptConfigs={promptConfigs}
          selectedPromptId={selectedPromptId}
          onSelectPrompt={setSelectedPromptId}
          activePromptValue={activePrompt?.value ?? ''}
          onPromptChange={handlePromptChange}
          responseLimit={responseLimit}
          onResponseLimitChange={setResponseLimit}
          rateLimit={rateLimit}
          onRateLimitChange={setRateLimit}
          filterStrength={filterStrength}
          onFilterStrengthChange={setFilterStrength}
          onResetLimits={handleResetLimits}
        />

        <UsersPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          filteredLogs={filteredLogs}
          selectedRows={selectedRows}
          onToggleRow={toggleRowSelection}
          onExportLogs={handleExportLogs}
          onBanUser={handleBanUser}
          onMuteUser={handleMuteUser}
          onArchiveCleanup={handleArchiveCleanup}
          onSimulateUsage={handleSimulateUsage}
          onSimulateSessionLength={handleSimulateSessionLength}
        />

        <UICustomizationSection
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          onPrimaryColorChange={setPrimaryColor}
          onSecondaryColorChange={setSecondaryColor}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          activeTheme={activeTheme}
          onThemeChange={setActiveTheme}
          themePreviewStyle={themePreviewStyle}
          animationToggles={animationToggles}
          onToggleAnimation={handleToggleAnimation}
        />

      </div>
    </div>
  );
}

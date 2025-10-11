import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Loader2,
  Mic,
  MicOff,
  Minimize2,
  Moon,
  Send,
  Settings,
  Sparkle,
  Sun,
  Volume2,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Switch from '../Switch';
import { headerTokens } from '../layout/headerTokens';

type StatusCounters = {
  blocked: number;
  fallback: number;
};

type StatusTone = 'success' | 'warning' | 'alert' | 'info';

export interface ChatSection {
  title: string;
  bullets: string[];
  cta: string;
}

export interface ChatStructuredContent {
  language: 'ka' | 'en';
  sections: ChatSection[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: ChatStructuredContent[];
  timestamp: number;
  status?: 'error' | 'success';
  contentType?: 'text' | 'markdown';
}

type ChatAudience = 'public_front' | 'admin_dev';

type StatusBadgeTone = 'live' | 'fallback' | 'blocked' | 'offline';

interface StatusBadge {
  id: string;
  label: string;
  tone: StatusBadgeTone;
}

export interface FuturisticChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onSend: (message: string) => void;
  isLoading: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  suggestions: string[];
  onSuggestionSelect: (value: string) => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  language: 'ka' | 'en';
  onLanguageChange: (language: 'ka' | 'en') => void;
  predictiveHint?: string | null;
  predictiveEnabled: boolean;
  onTogglePredictive: (value: boolean) => void;
  isListening: boolean;
  onToggleListening: () => void;
  error?: string | null;
  errorTone?: 'error' | 'info';
  onRetry?: () => void;
  onClearHistory: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
  messagesRef: React.RefObject<HTMLDivElement>;
  statusBadges?: StatusBadge[];
  retryLabel?: string;
  audience?: ChatAudience;
}

const containerVariants = {
  hidden: { opacity: 0, scale: 0.92, translateY: 30 },
  visible: { opacity: 1, scale: 1, translateY: 0 },
  exit: { opacity: 0, scale: 0.9, translateY: 30 },
};

const headerGradients = {
  dark: 'bg-[radial-gradient(circle_at_top,_rgba(134,239,172,0.65),_rgba(21,128,61,0.85)_58%,_rgba(15,118,110,0.55)_85%,_rgba(6,78,59,0.9)_100%)]',
  light:
    'bg-[radial-gradient(circle_at_top,_rgba(224,252,237,0.95),_rgba(167,243,208,0.7)_55%,_rgba(110,231,183,0.6)_85%,_rgba(20,184,166,0.45)_100%)]',
};

function getRoleLabel(role: ChatMessage['role'], language: 'ka' | 'en') {
  switch (role) {
    case 'assistant':
      return language === 'ka' ? 'გურულო' : 'Gurulo';
    case 'system':
      return language === 'ka' ? 'სისტემა' : 'System';
    default:
      return language === 'ka' ? 'თქვენ' : 'You';
  }
}

export function FuturisticChatPanel({
  isOpen,
  messages,
  onClose,
  onSend,
  isLoading,
  inputValue,
  onInputChange,
  suggestions,
  onSuggestionSelect,
  theme,
  onThemeToggle,
  language,
  onLanguageChange,
  predictiveHint,
  predictiveEnabled,
  onTogglePredictive,
  isListening,
  onToggleListening,
  error,
  errorTone = 'error',
  onRetry,
  onClearHistory,
  panelRef,
  messagesRef,
  statusBadges,
  retryLabel,
  audience = 'public_front',
}: FuturisticChatPanelProps) {
  const isDarkMode = theme === 'dark';
  const isPublicAudience = audience !== 'admin_dev';
  const [isHintDismissed, setIsHintDismissed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsContainerRef = useRef<HTMLDivElement | null>(null);
  const layoutVariables = useMemo(
    () =>
      ({
        '--ai-chat-header-height': '3.6rem',
        '--ai-chat-footer-height': '11.5rem',
      }) as CSSProperties,
    [],
  );

  useEffect(() => {
    if (!predictiveHint) {
      setIsHintDismissed(true);
      return;
    }

    if (messages.length === 0) {
      setIsHintDismissed(false);
    } else {
      setIsHintDismissed(true);
    }
  }, [messages.length, predictiveHint]);

  useEffect(() => {
    if (!isOpen) {
      setIsSettingsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        settingsContainerRef.current &&
        event.target instanceof Node &&
        !settingsContainerRef.current.contains(event.target)
      ) {
        setIsSettingsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  const filteredSuggestions = useMemo(
    () =>
      suggestions.filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
          suggestion.toLowerCase() !== inputValue.toLowerCase(),
      ),
    [suggestions, inputValue],
  );


  const messageMetaColor = isDarkMode ? 'text-white/70' : 'text-gray-600';
  const badgeBaseClass =
    'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]';

  const badgeToneClasses = useMemo(
    (): Record<StatusBadgeTone, string> => ({
      live: isDarkMode
        ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
        : 'border-emerald-300/70 bg-emerald-100 text-emerald-700',
      fallback: isDarkMode
        ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
        : 'border-sky-300/60 bg-sky-100 text-sky-700',
      blocked: isDarkMode
        ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
        : 'border-rose-300/70 bg-rose-100 text-rose-700',
      offline: isDarkMode
        ? 'border-red-500/60 bg-red-500/15 text-red-100'
        : 'border-red-400/80 bg-red-100 text-red-700',
    }),
    [isDarkMode],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="futuristic-chat-panel"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          ref={panelRef}
          style={layoutVariables}
          className={`fixed bottom-6 right-6 z-[70] flex h-[min(80vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-[32px] border backdrop-blur-2xl ${
            isDarkMode
              ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/92 via-emerald-900/90 to-slate-950/92 text-emerald-50 shadow-[0_35px_90px_rgba(6,95,70,0.55)]'
              : 'border-emerald-200/60 bg-white/95 text-gray-900 shadow-[0_32px_80px_rgba(52,211,153,0.25)]'
          }`}
        >
          <div
            className={`relative border-b px-5 pb-3 pt-4 ${
              isDarkMode ? 'border-white/10' : 'border-emerald-200/60'
            } ${headerGradients[isDarkMode ? 'dark' : 'light']}`}
            style={{ minHeight: 'var(--ai-chat-header-height)' }}
          >
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 24 }).map((_, index) => (
                <span
                  key={index}
                  className="pointer-events-none absolute h-1 w-1 animate-particle rounded-full bg-sky-300/60"
                  style={{
                    left: `${(index * 37) % 100}%`,
                    top: `${(index * 53) % 100}%`,
                    animationDelay: `${index * 0.32}s`,
                  }}
                />
              ))}
            </div>
            <div aria-hidden className="pointer-events-none absolute -right-4 bottom-0 h-36 w-32">
              <div className="absolute inset-x-6 bottom-2 h-6 rounded-full bg-emerald-900/40 blur-md" />
              <div
                className="absolute left-1/2 bottom-5 h-20 w-16 -translate-x-1/2 bg-gradient-to-b from-emerald-200 via-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/40"
                style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
              />
              <div
                className="absolute left-1/2 bottom-10 h-16 w-14 -translate-x-1/2 bg-gradient-to-b from-teal-200 via-emerald-400 to-emerald-600 opacity-90 shadow-lg shadow-emerald-950/40"
                style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
              />
              <div
                className="absolute left-1/2 bottom-14 h-12 w-12 -translate-x-1/2 bg-gradient-to-b from-sky-100 via-emerald-300 to-emerald-500 opacity-90 shadow-lg shadow-teal-900/30"
                style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
              />
              <div className="absolute left-1/2 bottom-2 h-8 w-2 -translate-x-1/2 rounded-full bg-emerald-900/80" />
              <span className="absolute left-[18%] bottom-16 h-2 w-2 rounded-full bg-emerald-200/80" />
              <span className="absolute right-6 bottom-20 h-3 w-3 rounded-full bg-emerald-100/70" />
            </div>
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p
                  className={`flex items-center text-xs font-medium uppercase tracking-[0.3em] ${
                    isDarkMode ? 'text-emerald-100/80' : 'text-emerald-700/80'
                  }`}
                >
                  <Sparkle className="mr-2 h-3 w-3" />
                  {language === 'ka' ? 'გურულოს მეგზური' : 'Gurulo Companion'}
                </p>
                <h2
                  className={`mt-2 text-2xl font-semibold drop-shadow-[0_10px_28px_rgba(134,239,172,0.45)] ${
                    isDarkMode ? 'text-emerald-50' : 'text-emerald-900'
                  }`}
                >
                  {language === 'ka' ? 'გურულო' : 'Gurulo'}
                </h2>
                <p
                  className={`mt-1 text-[11px] ${
                    isDarkMode ? 'text-emerald-50/80' : 'text-gray-600'
                  }`}
                >
                  {language === 'ka'
                    ? 'მიიღეთ რჩევები, ამინდის ხედვები და მოგზაურობის იდეები გურულოსგან.'
                    : 'Collect tips, weather insights, and travel ideas directly from Gurulo.'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 sm:gap-2.5">
                {statusBadges?.length ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {statusBadges.map((badge) => (
                      <span key={badge.id} className={`${badgeBaseClass} ${badgeToneClasses[badge.tone]}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onClose}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl transition focus:outline-none focus-visible:ring-2 ${
                    isDarkMode
                      ? 'bg-white/10 text-white hover:bg-white/20 focus-visible:ring-sky-300'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-300/60'
                  }`}
                  aria-label="პანელის მინიმიზება"
                >
                  <Minimize2 className="h-5 w-5" />
                </motion.button>
              </div>
            </div>
            {!isPublicAudience && (
              <div className="relative mt-5 flex justify-end" ref={settingsContainerRef}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setIsSettingsOpen((previous) => !previous)}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition focus:outline-none focus-visible:ring-2 ${
                    isDarkMode
                      ? 'bg-emerald-500/20 text-emerald-50 focus-visible:ring-emerald-200/70'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-300/60'
                  }`}
                  aria-haspopup="true"
                  aria-expanded={isSettingsOpen}
                  aria-label={language === 'ka' ? 'პარამეტრები' : 'Settings'}
                >
                  <Settings className="h-5 w-5" />
                </motion.button>
                <AnimatePresence>
                  {isSettingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -6 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                      className={`absolute right-0 top-14 z-20 w-48 rounded-3xl border px-4 py-4 text-sm shadow-2xl backdrop-blur ${
                        isDarkMode
                          ? 'border-emerald-400/40 bg-emerald-900/90 text-emerald-50'
                          : 'border-emerald-200/70 bg-white text-gray-900'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onThemeToggle();
                          setIsSettingsOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 transition hover:bg-emerald-500/10"
                      >
                        <span className="text-xs uppercase tracking-[0.3em]">
                          {language === 'ka' ? 'თემა' : 'Theme'}
                        </span>
                        <span className="flex items-center text-xs font-semibold">
                          {isDarkMode ? (
                            <>
                              <Moon className="mr-2 h-4 w-4" />
                              {language === 'ka' ? 'ღამე' : 'Night'}
                            </>
                          ) : (
                            <>
                              <Sun className="mr-2 h-4 w-4" />
                              {language === 'ka' ? 'დღე' : 'Day'}
                            </>
                          )}
                        </span>
                      </button>
                      <div
                        className={`mt-3 rounded-2xl px-3 py-2 ${
                          isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50/80'
                        }`}
                      >
                        <span className="block text-[11px] uppercase tracking-[0.3em] opacity-70">
                          {language === 'ka' ? 'ენა' : 'Language'}
                        </span>
                        <select
                          value={language}
                          onChange={(event) => {
                            onLanguageChange(event.target.value as 'ka' | 'en');
                            setIsSettingsOpen(false);
                          }}
                          className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-medium focus:outline-none ${
                            isDarkMode
                              ? 'border-emerald-400/40 bg-emerald-950/70 text-emerald-50'
                              : 'border-emerald-200 bg-white text-gray-900'
                          }`}
                          aria-label={language === 'ka' ? 'ენის არჩევა' : 'Select language'}
                        >
                          <option value="ka">{language === 'ka' ? 'ქართული' : 'Georgian'}</option>
                          <option value="en">English</option>
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          onToggleListening();
                          setIsSettingsOpen(false);
                        }}
                        className={`mt-3 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs uppercase tracking-[0.3em] transition ${
                          isListening
                            ? isDarkMode
                              ? 'bg-emerald-400/20 text-emerald-50'
                              : 'bg-emerald-100/70 text-emerald-800'
                            : isDarkMode
                              ? 'bg-transparent text-current hover:bg-emerald-500/10'
                              : 'bg-transparent text-gray-700 hover:bg-emerald-50'
                        }`}
                        aria-pressed={isListening}
                        aria-label={language === 'ka' ? 'ხმის ასისტენტის ჩართვა' : 'Toggle voice assistant'}
                      >
                        <span>{language === 'ka' ? 'ხმის რეჟიმი' : 'Voice Mode'}</span>
                        {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className={`absolute inset-0 ${
                isDarkMode
                  ? "bg-[radial-gradient(circle_at_20%_20%,rgba(22,163,74,0.28),transparent_50%),radial-gradient(circle_at_80%_0%,rgba(74,222,128,0.25),transparent_60%),linear-gradient(140deg,rgba(6,44,34,0.92),rgba(15,23,42,0.85))]"
                  : "bg-[radial-gradient(circle_at_20%_20%,rgba(74,222,128,0.55),transparent_52%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.35),transparent_65%),linear-gradient(140deg,rgba(240,253,244,0.95),rgba(209,250,229,0.9))]"
              }`}
            />
            <div
              className={`absolute inset-0 pointer-events-none opacity-50 ${
                isDarkMode
                  ? "bg-[url('data:image/svg+xml,%3Csvg width=\\'160\\' height=\\'160\\' viewBox=\\'0 0 160 160\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cdefs%3E%3ClinearGradient id=\\'g\\' x1=\\'0\\' y1=\\'0\\' x2=\\'1\\' y2=\\'1\\'%3E%3Cstop stop-color=\\'%230f5132\\' stop-opacity=\\'0.25\\'/%3E%3Cstop offset=\\'1\\' stop-color=\\'%230b3a27\\' stop-opacity=\\'0.05\\'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d=\\'M80 0 L160 80 L80 160 L0 80 Z\\' fill=\\'url(%23g)\\'/%3E%3C/svg%3E')]"
                  : "bg-[url('data:image/svg+xml,%3Csvg width=\\'160\\' height=\\'160\\' viewBox=\\'0 0 160 160\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cdefs%3E%3ClinearGradient id=\\'g\\' x1=\\'0\\' y1=\\'0\\' x2=\\'1\\' y2=\\'1\\'%3E%3Cstop stop-color=\\'%2322c55e\\' stop-opacity=\\'0.25\\'/%3E%3Cstop offset=\\'1\\' stop-color=\\'%230a3a2a\\' stop-opacity=\\'0.08\\'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d=\\'M80 0 L160 80 L80 160 L0 80 Z\\' fill=\\'url(%23g)\\'/%3E%3C/svg%3E')]"
              }`}
            />

            <div
              ref={messagesRef}
              className="relative z-10 flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-600/40"
              style={{
                maxHeight:
                  'calc(100vh - var(--ai-chat-header-height) - var(--ai-chat-footer-height) - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
                paddingBottom: 'calc(var(--ai-chat-footer-height) - 1.5rem)',
              }}
            >
              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, translateY: 12 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      exit={{ opacity: 0, translateY: -8 }}
                      className={`group relative max-w-[92%] rounded-[26px] border-2 px-5 py-4 shadow-xl backdrop-blur-xl transition-all duration-300 ${
                        message.role === 'assistant'
                          ? isDarkMode
                            ? 'ml-auto border-emerald-300/70 bg-emerald-900/70 text-emerald-50 shadow-[0_18px_40px_rgba(6,95,70,0.45)]'
                            : 'ml-auto border-emerald-300/60 bg-emerald-50/90 text-emerald-900 shadow-[0_18px_40px_rgba(52,211,153,0.25)]'
                          : message.role === 'system'
                            ? isDarkMode
                              ? 'mx-auto border-amber-300/60 bg-amber-500/15 text-amber-100 shadow-[0_14px_32px_rgba(250,204,21,0.25)]'
                              : 'mx-auto border-amber-300/50 bg-amber-100/70 text-amber-900 shadow-[0_14px_32px_rgba(253,230,138,0.4)]'
                            : isDarkMode
                              ? 'mr-auto border-white/30 bg-white/15 text-white shadow-[0_16px_32px_rgba(255,255,255,0.18)]'
                              : 'mr-auto border-emerald-200/60 bg-white text-gray-900 shadow-[0_16px_32px_rgba(209,250,229,0.45)]'
                      }`}
                    >
                      <div
                        className={`flex items-center space-x-2 text-[11px] uppercase tracking-[0.25em] ${messageMetaColor}`}
                      >
                        {message.role === 'assistant' ? <Bot className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        <span>{getRoleLabel(message.role, language)}</span>
                        <span aria-hidden="true">•</span>
                        <time dateTime={new Date(message.timestamp).toISOString()} className="font-mono text-[10px]">
                          {new Intl.DateTimeFormat(language === 'ka' ? 'ka-GE' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(message.timestamp)}
                        </time>
                      </div>
                      <div className="mt-3 space-y-4 text-sm leading-relaxed">
                        {message.content.map((block, blockIndex) => (
                          <div key={`${message.id}-block-${blockIndex}`} className="space-y-3">
                            {block.sections.map((section, sectionIndex) => {
                              const hasBullets = section.bullets.length > 0;
                              const hasTitle = Boolean(section.title.trim());
                              const hasCta = Boolean(section.cta.trim());
                              const shouldRenderList =
                                message.role === 'assistant' && message.contentType !== 'text';

                              return (
                                <div key={`${message.id}-section-${blockIndex}-${sectionIndex}`} className="space-y-2">
                                  {message.role === 'assistant' && hasTitle ? (
                                    <p className="font-semibold tracking-tight">
                                      {section.title}
                                    </p>
                                  ) : null}
                                  {hasBullets ? (
                                    shouldRenderList ? (
                                      <ul className="space-y-2 pl-4">
                                        {section.bullets.map((bullet, bulletIndex) => (
                                          <li
                                            key={`${message.id}-bullet-${blockIndex}-${sectionIndex}-${bulletIndex}`}
                                            className="list-disc"
                                          >
                                            {bullet}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      section.bullets.map((bullet, bulletIndex) => (
                                        <p
                                          key={`${message.id}-text-${blockIndex}-${sectionIndex}-${bulletIndex}`}
                                          className="whitespace-pre-wrap"
                                        >
                                          {bullet}
                                        </p>
                                      ))
                                    )
                                  ) : null}
                                  {hasCta ? (
                                    <p
                                      className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                                        message.role === 'assistant'
                                          ? isDarkMode
                                            ? 'text-emerald-200'
                                            : 'text-emerald-700'
                                          : isDarkMode
                                            ? 'text-white/70'
                                            : 'text-gray-600'
                                      }`}
                                    >
                                      {section.cta}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      {message.status === 'error' && (
                        <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                          {language === 'ka'
                            ? 'შეტყობინების გაგზავნა ვერ მოხერხდა. გთხოვთ, სცადეთ ხელახლა.'
                            : 'Unable to deliver message. Please try again.'}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {isLoading && (
                <div
                  className={`ml-auto flex max-w-[85%] items-center space-x-3 rounded-[26px] border px-4 py-3 shadow-[0_18px_35px_rgba(6,95,70,0.35)] ${
                    isDarkMode
                      ? 'border-emerald-300/40 bg-emerald-900/60 text-emerald-100'
                      : 'border-emerald-200/60 bg-white text-gray-700'
                  }`}
                >
                  <Loader2
                    className={`h-5 w-5 animate-spin ${
                      isDarkMode ? 'text-sky-300' : 'text-emerald-500'
                    }`}
                  />
                  <p className="text-sm font-medium">
                    {language === 'ka' ? 'გურულო ფიქრობს...' : 'Gurulo is thinking...'}
                  </p>
                </div>
              )}

              {messages.length === 0 && !isLoading && (
                <div
                  className={`mx-auto mt-6 max-w-sm rounded-[28px] border px-6 py-8 text-center ${
                    isDarkMode
                      ? 'border-emerald-200/40 bg-emerald-800/40 text-emerald-100'
                      : 'border-emerald-200/60 bg-white text-gray-700'
                  }`}
                >
                  <Wand2
                    className={`mx-auto h-8 w-8 ${
                      isDarkMode ? 'text-sky-200' : 'text-emerald-500'
                    }`}
                  />
                  <p className="mt-3 text-sm">
                    {language === 'ka'
                      ? 'დაიწყეთ საუბარი გურულოსთან — ის მოარგებს პასუხს თქვენს მოგზაურობას.'
                      : 'Open with a question for Gurulo—she tailors every reply to your adventure.'}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSuggestionSelect(language === 'ka' ? 'შეამოწმე ბახმაროს კოტეჯები' : 'Check cottages in Bakhmaro')}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isDarkMode
                          ? 'bg-emerald-500/20 text-emerald-50 hover:bg-emerald-400/25'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {language === 'ka' ? 'შეამოწმე კოტეჯები' : 'Check cottages'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSuggestionSelect(language === 'ka' ? 'როგორია ამინდი ბახმაროში?' : 'What is the weather in Bakhmaro?')}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isDarkMode
                          ? 'bg-sky-500/20 text-sky-100 hover:bg-sky-400/25'
                          : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                      }`}
                    >
                      {language === 'ka' ? 'ამინდი ბახმაროში' : 'Bakhmaro weather'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div
                className={`relative z-20 mx-5 mb-3 rounded-2xl border px-4 py-3 text-sm ${
                  errorTone === 'info'
                    ? isDarkMode
                      ? 'border-emerald-300/50 bg-emerald-600/20 text-emerald-50'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : isDarkMode
                      ? 'border-red-400/40 bg-red-500/10 text-red-200'
                      : 'border-red-200 bg-red-50 text-red-600'
                }`}
              >
                <p className="whitespace-pre-wrap">{error}</p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                      errorTone === 'info'
                        ? isDarkMode
                          ? 'bg-emerald-500/30 text-emerald-50 hover:bg-emerald-500/40'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : isDarkMode
                          ? 'bg-red-400/20 text-red-100 hover:bg-red-400/30'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {retryLabel ?? (language === 'ka' ? 'სცადე თავიდან' : 'Try again')}
                  </button>
                )}
              </div>
            )}

            <div
              className={`relative z-20 space-y-3 border-t px-5 pb-4 pt-3 ${
                isDarkMode
                  ? 'border-emerald-300/20 bg-emerald-950/70 text-white'
                  : 'border-emerald-200/60 bg-white text-gray-900'
              }`}
              style={{ minHeight: 'var(--ai-chat-footer-height)' }}
            >
              {!isPublicAudience && predictiveHint && !isHintDismissed && (
                <div
                  className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-[12px] ${
                    isDarkMode
                      ? 'border-emerald-200/40 bg-emerald-500/10 text-white/80'
                      : 'border-emerald-200/60 bg-white text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Sparkle
                      className={`h-4 w-4 ${
                        isDarkMode ? 'text-sky-200' : 'text-emerald-500'
                      }`}
                    />
                    <span>{predictiveHint}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] uppercase tracking-[0.2em]">
                    <span
                      className={
                        isDarkMode ? 'text-white/70' : 'text-gray-500'
                      }
                    >
                      Gurulo Hint
                    </span>
                    <Switch
                      checked={predictiveEnabled}
                      onCheckedChange={onTogglePredictive}
                      aria-label="პროგნოზული მინიშნებების ჩართვა"
                    />
                    <button
                      type="button"
                      onClick={() => setIsHintDismissed(true)}
                      className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.3em] transition ${
                        isDarkMode
                          ? 'border-emerald-200/30 bg-emerald-500/10 text-white/60 hover:border-emerald-300/60 hover:bg-emerald-400/20 hover:text-white'
                          : 'border-emerald-200/60 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      {language === 'ka' ? 'გაუქმება' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}

              <div
                className={`group relative flex w-full items-center gap-3 rounded-[26px] border px-4 py-2.5 shadow-inner focus-within:border-emerald-300/70 ${
                  isDarkMode
                    ? 'border-emerald-200/40 bg-emerald-500/10 shadow-emerald-900/40'
                    : 'border-emerald-200/60 bg-white shadow-emerald-100'
                }`}
              >
                <textarea
                  value={inputValue}
                  onChange={(event) => onInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      const trimmed = inputValue.trim();
                      if (trimmed) {
                        onSend(trimmed);
                        setIsHintDismissed(true);
                        onInputChange('');
                      }
                    }
                  }}
                  rows={2}
                  aria-label={language === 'ka' ? 'შეტყობინების ველი' : 'Message input field'}
                  placeholder={
                    language === 'ka'
                      ? 'ჰკითხეთ გურულოს ბახმაროს შესახებ, დაგეგმეთ მოგზაურობა ან შეამოწმეთ ამინდი...'
                      : 'Ask Gurulo about Bakhmaro, plan a getaway, or check the weather...'
                  }
                  className={`flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none ${
                    isDarkMode
                      ? 'text-white placeholder:text-emerald-200/60'
                      : 'text-gray-900 placeholder:text-gray-500/60'
                  }`}
                />
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    const trimmed = inputValue.trim();
                    if (trimmed) {
                      onSend(trimmed);
                      setIsHintDismissed(true);
                      onInputChange('');
                    }
                  }}
                  disabled={!inputValue.trim() || isLoading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-sky-400 text-white shadow-[0_14px_28px_rgba(6,95,70,0.4)] transition hover:from-emerald-300 hover:via-teal-300 hover:to-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={language === 'ka' ? 'შეტყობინების გაგზავნა' : 'Send message'}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </motion.button>
              </div>

              {!isPublicAudience && (
                <div
                  className={`flex items-center justify-between text-[11px] uppercase tracking-[0.2em] ${
                    isDarkMode ? 'text-white/50' : 'text-gray-500'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Switch
                      checked={isListening}
                      onCheckedChange={onToggleListening}
                      aria-label={language === 'ka' ? 'ხმის რეჟიმის გადართვა' : 'Toggle voice mode'}
                    />
                    <span>{language === 'ka' ? 'ხმის რეჟიმი' : 'voice mode'}</span>
                  </div>
                  <button
                    onClick={onClearHistory}
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.3em] transition ${
                      isDarkMode
                        ? 'border-emerald-200/40 bg-emerald-500/10 text-white/70 hover:border-red-300/60 hover:bg-red-400/20 hover:text-red-100'
                        : 'border-emerald-200/60 bg-white text-gray-600 hover:border-red-300/60 hover:bg-red-100/60 hover:text-red-700'
                    }`}
                  >
                    {language === 'ka' ? 'ისტორიის გასუფთავება' : 'clear history'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default FuturisticChatPanel;

import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { SafetySwitch, PendingAction } from '@/components/SafetySwitch';
import { getAdminAuthHeaders } from '@/utils/adminToken';
import { cardVariants, responseLimitPresets } from './constants';
import type { PromptConfig } from './types';

interface ChatConfigSectionProps {
  promptConfigs: PromptConfig[];
  selectedPromptId: string;
  onSelectPrompt: (id: string) => void;
  activePromptValue: string;
  onPromptChange: (content: string) => void;
  responseLimit: number;
  onResponseLimitChange: (value: number) => void;
  rateLimit: number;
  onRateLimitChange: (value: number) => void;
  filterStrength: number;
  onFilterStrengthChange: (value: number) => void;
  onResetLimits?: () => void;
  tooltips?: {
    responseLimit?: string;
    rateLimit?: string;
    filterStrength?: string;
  };
}

export function ChatConfigSection({
  promptConfigs,
  selectedPromptId,
  onSelectPrompt,
  activePromptValue,
  onPromptChange,
  responseLimit,
  onResponseLimitChange,
  rateLimit,
  onRateLimitChange,
  filterStrength,
  onFilterStrengthChange,
  onResetLimits,
  tooltips,
}: ChatConfigSectionProps) {
  const { user } = useAuth();

  const handleActionExecute = useCallback(
    async (action: PendingAction) => {
      console.log(
        '🚀 [SAFETY SWITCH] Executing confirmed action from settings panel:',
        action.id,
      );

      try {
        const response = await fetch(`/api/safety-switch/confirm/${action.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAdminAuthHeaders(),
          },
          body: JSON.stringify({
            userId: user?.personalId ?? 'anonymous',
            confirmation:
              action.severity === 'high' || action.severity === 'critical'
                ? 'CONFIRM'
                : 'CONFIRMED',
          }),
        });

        const payload = await response.json().catch(() => ({} as any));

        if (!response.ok || payload?.success === false) {
          const errorMessage =
            payload?.error ||
            payload?.message ||
            `Failed to confirm action (status ${response.status})`;
          throw new Error(errorMessage);
        }

        console.log(
          '✅ [SAFETY SWITCH] Action confirmation sent successfully from settings panel',
        );

        return {
          success: true,
          result: payload?.message ?? 'Action confirmed successfully',
          duration: payload?.duration,
          output: payload?.output,
        };
      } catch (error) {
        console.error(
          '❌ [SAFETY SWITCH] Failed to execute action from settings panel:',
          error,
        );
        throw error;
      }
    },
    [user?.personalId],
  );

  return (
    <section id="gurulo-section-chatConfig" className="space-y-6 scroll-mt-28">
      <h2 className="text-2xl font-semibold text-white">ჩატის კონფიგურაცია</h2>
      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated lg:col-span-2 p-6 text-white">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">პრომპტის შინაარსი</h3>
              <p className="text-sm text-[#A0A4AD]">დაარედაქტირეთ ტონი, ქცევა და ინსტრუქციები</p>
            </div>
            <select
              value={selectedPromptId}
              onChange={(event) => onSelectPrompt(event.target.value)}
              className="rounded-2xl border border-[#7C6CFF33] bg-[#1A1F2F]/80 px-3 py-2 text-sm text-[#E6E8EC] outline-none transition focus:outline-none focus:ring-2 focus:ring-[#7C6CFF80]"
            >
              {promptConfigs.map((prompt) => (
                <option key={prompt.id} value={prompt.id} className="bg-[#0E1116] text-[#E6E8EC]">
                  {prompt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <Editor
              height="260px"
              defaultLanguage="markdown"
              value={activePromptValue}
              onChange={(value) => onPromptChange(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'JetBrains Mono, monospace',
                lineNumbers: 'off',
                wordWrap: 'on',
                smoothScrolling: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </motion.div>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
          className="glass-elevated lg:col-span-3 p-6 text-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">პასუხის ლიმიტები და ფილტრები</h3>
            <div className="flex items-center gap-3">
              {onResetLimits ? (
                <button
                  type="button"
                  onClick={onResetLimits}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#E6E8EC] transition hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  პარამეტრების განულება
                </button>
              ) : null}
              <Sparkles className="h-5 w-5 text-sky-300" />
            </div>
          </div>
          <div className="mt-6 space-y-5">
            <SliderField
              label={`მაქსიმალური ტოკენები (${responseLimitPresets.ka})`}
              min={128}
              max={2048}
              value={responseLimit}
              onChange={onResponseLimitChange}
              valueSuffix="tokens"
              tooltip={tooltips?.responseLimit}
            />
            <SliderField
              label="პასუხების სიჩქარე (წუთში)"
              min={10}
              max={120}
              value={rateLimit}
              onChange={onRateLimitChange}
              valueSuffix="req/min"
              tooltip={tooltips?.rateLimit}
            />
            <SliderField
              label="კონტენტის ფილტრის სიძლიერე"
              min={0}
              max={100}
              value={filterStrength}
              onChange={onFilterStrengthChange}
              valueSuffix="%"
              tooltip={tooltips?.filterStrength}
            />
            <div className="rounded-2xl border border-[#7C6CFF26] bg-[#181C2A]/80 p-4 text-xs text-[#A0A4AD]">
              <p>
                ეს პარამეტრები იკვებება პირდაპირ Groq-ის მიკროსერვისით, ამიტომ ცვლილებები ეგრევე აისახება რეალურ დროში. დარწმუნდით, რომ შედგენილი ლიმიტები თავსებადია თქვენს SLA-ებთან.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.15 }}
        className="glass-elevated p-6 text-white"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">დაცვის რეჟიმი (Safety Switch)</h3>
            <p className="mt-1 text-sm text-[#A0A4AD]">
              მართეთ მოქმედებების დადასტურება უშუალოდ ადმინისტრატორის პანელიდან, რომ გურულომ ვერ შეასრულოს ცვლილებები თანხმობის გარეშე.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SafetySwitch isVisible onActionExecute={handleActionExecute} className="w-full" />
        </div>
      </motion.div>
    </section>
  );
}

interface SliderFieldProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  valueSuffix: string;
  tooltip?: string;
}

function SliderField({ label, min, max, value, onChange, valueSuffix, tooltip }: SliderFieldProps) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm text-[#A0A4AD]">
        {label}
        {tooltip ? (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/70"
            title={tooltip}
          >
            i
          </span>
        ) : null}
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full" />
      <span className="mt-1 inline-block rounded-full border border-[#7C6CFF33] bg-[#1F2435]/80 px-3 py-1 text-xs text-[#E6E8EC]">
        {value} {valueSuffix}
      </span>
    </label>
  );
}

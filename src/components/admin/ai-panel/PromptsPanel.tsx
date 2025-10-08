import { useMemo } from 'react';
import { ChatConfigSection } from './ChatConfigSection';
import type { PromptConfig } from './types';

interface PromptsPanelProps {
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
  onResetLimits: () => void;
}

export function PromptsPanel({
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
}: PromptsPanelProps) {
  const tooltips = useMemo(
    () => ({
      responseLimit: 'განისაზღვრავს რამდენი ტოკენის გენერირება შეუძლია გურულოს ერთ პასუხში. მაღალი ლიმიტი კარგია ანალიტიკისთვის, მაგრამ ნელდება.',
      rateLimit: 'რამდენი მოთხოვნა დაუშვას წუთში. შეამცირეთ DDOS-ის ან მასიური ტესტირებისას.',
      filterStrength: 'უმატებს კონტენტის ფილტრის სიმკაცრეს. მაღალი მნიშვნელობა იცავს ტონს, მაგრამ შეიძლება შეზღუდოს კრეატიულობა.',
    }),
    [],
  );

  return (
    <ChatConfigSection
      promptConfigs={promptConfigs}
      selectedPromptId={selectedPromptId}
      onSelectPrompt={onSelectPrompt}
      activePromptValue={activePromptValue}
      onPromptChange={onPromptChange}
      responseLimit={responseLimit}
      onResponseLimitChange={onResponseLimitChange}
      rateLimit={rateLimit}
      onRateLimitChange={onRateLimitChange}
      filterStrength={filterStrength}
      onFilterStrengthChange={onFilterStrengthChange}
      onResetLimits={onResetLimits}
      tooltips={tooltips}
    />
  );
}

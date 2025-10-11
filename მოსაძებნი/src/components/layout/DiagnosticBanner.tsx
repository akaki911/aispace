import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useDiagnosticVisibility } from '../../hooks/useDiagnosticVisibility';
import { headerTokens } from './headerTokens';

type DiagnosticBannerProps = {
  session: string;
  role: string;
  authState: string;
  additionalDetails?: Record<string, string | number | boolean | null | undefined>;
};

const autoHideDelay = 12000;

const DiagnosticBanner: React.FC<DiagnosticBannerProps> = ({
  session,
  role,
  authState,
  additionalDetails
}) => {
  const { collapsed, dismissed, toggleCollapsed, dismiss } = useDiagnosticVisibility();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!import.meta.env.DEV || dismissed) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelay);

    return () => window.clearTimeout(timer);
  }, [dismissed]);

  useEffect(() => {
    if (!dismissed) {
      setIsVisible(true);
    }
  }, [dismissed]);

  const summary = useMemo(
    () => `[DIAGNOSTIC] Session: ${session} • Role: ${role} • Auth: ${authState}`,
    [session, role, authState]
  );

  const detailEntries = useMemo(() => {
    if (!additionalDetails) {
      return [] as Array<[string, string]>;
    }

    return Object.entries(additionalDetails).map(([key, value]) => [
      key,
      value === null || value === undefined ? '—' : String(value)
    ]);
  }, [additionalDetails]);

  if (dismissed || !isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-[60] text-sm"
      role="status"
      aria-live="polite"
    >
      <div
        className="min-w-[260px] max-w-[360px] shadow-lg"
        style={{
          backgroundColor: headerTokens.colors.surface,
          borderRadius: headerTokens.radii.md,
          border: `1px solid ${headerTokens.colors.border}`,
          boxShadow: '0 16px 32px rgba(15, 23, 42, 0.16)',
          color: headerTokens.colors.textPrimary
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: '#F1F5F9',
              border: `1px solid ${headerTokens.colors.border}`,
              color: headerTokens.colors.textSecondary
            }}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand diagnostic details' : 'Collapse diagnostic details'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          </button>
          <div className="flex-1">
            <p
              className="font-medium"
              style={{
                fontSize: headerTokens.typography.tab.size,
                color: headerTokens.colors.textPrimary
              }}
            >
              {summary}
            </p>
            {!collapsed && detailEntries.length > 0 && (
              <dl
                className="mt-2 space-y-1 text-xs"
                style={{ color: headerTokens.colors.textSecondary }}
              >
                {detailEntries.map(([label, value]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="min-w-[80px] font-semibold uppercase tracking-wide">
                      {label}
                    </dt>
                    <dd className="flex-1 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: '#F1F5F9',
              border: `1px solid ${headerTokens.colors.border}`,
              color: headerTokens.colors.textSecondary
            }}
            aria-label="Dismiss diagnostic banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticBanner;

import React from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface ImproveSidebarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active: boolean;
  badge?: number | string | null;
}

interface ImproveSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  items: ImproveSidebarItem[];
  serviceState?: 'ok' | 'degraded' | 'offline';
  addon?: React.ReactNode;
}

const stateTone: Record<'ok' | 'degraded' | 'offline', string> = {
  ok: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
  degraded: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20',
  offline: 'bg-slate-500/10 text-slate-200 ring-1 ring-slate-500/20',
};

export const ImproveSidebar: React.FC<ImproveSidebarProps> = ({
  collapsed,
  onToggle,
  items,
  serviceState = 'ok',
  addon,
}) => {
  const { t } = useTranslation();

  return (
    <motion.aside
      initial={{ width: 60 }}
      animate={{ width: collapsed ? 60 : 250 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex h-full flex-col border-r border-slate-800/60 bg-slate-950/80 backdrop-blur"
      data-testid="ai-imp:sidebar"
      aria-label={t('aiImprove.sidebar.ariaLabel', 'Auto-Improve გვერდითი ნავიგაცია')}
    >
      <div className="flex items-center justify-between px-3 py-4">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700/70 bg-slate-900 text-slate-200 shadow-sm transition hover:border-violet-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          onClick={onToggle}
          aria-label={collapsed ? t('aiImprove.sidebar.expand', 'გახსნა') : t('aiImprove.sidebar.collapse', 'დახურვა')}
          aria-expanded={!collapsed}
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        {!collapsed && (
          <span
            className={classNames(
              'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
              stateTone[serviceState],
            )}
          >
            {serviceState === 'ok'
              ? t('aiImprove.sidebar.status.ok', 'სტაბილური')
              : serviceState === 'degraded'
                ? t('aiImprove.sidebar.status.degraded', 'დაგვიანება')
                : t('aiImprove.sidebar.status.offline', 'შეზღუდული რეჟიმი')}
          </span>
        )}
      </div>

      <nav
        className={classNames(
          'flex flex-1 flex-col gap-3 px-2 pb-6',
          collapsed ? 'items-center' : 'items-stretch',
        )}
        aria-label={t('aiImprove.sidebar.sections', 'Auto-Improve სექციები')}
      >
        <div
          className={classNames(
            'flex flex-col gap-2',
            collapsed ? 'w-full items-center' : 'items-stretch',
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              data-testid={`ai-imp:sidebar-item:${item.id}`}
              className={classNames(
                'group flex w-full items-center gap-3 rounded-lg border border-transparent bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-violet-500/40 hover:bg-slate-900/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                item.active && 'border-violet-500/60 bg-slate-900 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.25)]',
                collapsed && 'justify-center px-0 py-3',
              )}
              aria-current={item.active ? 'true' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="flex-1 truncate text-left">{item.label}</span>
              )}
              {!collapsed && item.badge !== null && item.badge !== undefined && (
                <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-violet-200">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        {!collapsed && addon ? <div className="flex justify-center">{addon}</div> : null}
      </nav>
    </motion.aside>
  );
};

export default ImproveSidebar;

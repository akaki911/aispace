import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Calendar,
  Car,
  Building2,
  User,
  Home,
  Users,
  LogOut,
  DollarSign,
  Search,
  CreditCard,
  Shield,
  MessageSquare,
  Activity,
  List,
  Mountain,
  Terminal,
  ChevronDown,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './hooks/usePermissions';
import ThemeToggle from './components/ThemeToggle';
import { useUIErrorCapture } from './hooks/useUIErrorCapture';
import { useDailyGreeting } from './hooks/useDailyGreeting';
import { useAiHealth } from '@aispace/hooks';
import { AISpaceStatusIndicator } from '@aispace/components';
import { useFeatureFlag } from './hooks/useFeatureFlag';

type NavigationItem = {
  id?: string;
  name: string;
  href: string;
  icon: LucideIcon;
  children?: NavigationItem[];
  indicator?: 'ai-service';
};

type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
  variant?: 'standalone';
};

export default function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const { captureInteractionError } = useUIErrorCapture('Layout');
  const { status: aiServiceStatus } = useAiHealth({ pollIntervalMs: 45_000 });
  const legacyAiEnabled = useFeatureFlag('LEGACY_AI_DEVELOPER');
  const dailyGreeting = useDailyGreeting();
  const displayName = useMemo(() => {
    if (!user) {
      return 'სტუმარი';
    }

    const composed = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (composed) {
      return composed;
    }

    return user.displayName || user.email || 'სტუმარი';
  }, [user]);
  const dashboardItem = useMemo<NavigationItem>(
    () => ({ name: 'დეშბორდი', href: '/admin', icon: Home }),
    []
  );

  useEffect(() => {
    document.body.classList.add('admin-theme');
    return () => {
      document.body.classList.remove('admin-theme');
    };
  }, []);

  const navigationGroups: NavigationGroup[] = useMemo(() => {
    const essentials: NavigationItem[] = [
      { name: 'ჯავშნების სია', href: '/admin/javshnissia', icon: List },
      { name: 'კალენდარი', href: '/admin/calendar', icon: Calendar },
    ];

    const services: NavigationItem[] = [
      { name: 'კოტეჯები', href: '/admin/cottages', icon: Building2 },
      { name: 'სასტუმროები', href: '/admin/hotels', icon: Building2 },
      { name: 'ავტომობილები', href: '/admin/vehicles', icon: Car },
      { name: 'ცხენები', href: '/admin/horses', icon: Mountain },
      { name: 'თოვლმავლები', href: '/admin/snowmobiles', icon: Mountain },
    ];

    if (isSuperAdmin) {
      const partners: NavigationItem[] = [
        { name: 'პროვაიდერები', href: '/admin/users', icon: Users },
        { name: 'მომხმარებლები', href: '/admin/customers', icon: Users },
        { name: 'პროვაიდერების ჯავშნები', href: '/admin/provider-bookings', icon: Shield },
      ];

      const finance: NavigationItem[] = [
        { name: 'ბანკის ანგარიშები', href: '/admin/bank-accounts', icon: CreditCard },
        { name: 'კომისიების მართვა', href: '/admin/commission', icon: DollarSign },
      ];

      const communication: NavigationItem[] = [
        { name: 'შეტყობინებები', href: '/admin/messaging', icon: MessageSquare },
      ];

      const technology: NavigationItem[] = [
        {
          id: 'ai-developer',
          name: 'AI სივრცე',
          href: '/admin/ai-developer',
          icon: Terminal,
          indicator: 'ai-service',
        },
      ];

      if (legacyAiEnabled) {
        technology.push(
          {
            id: 'ai-developer-secrets',
            name: 'საიდუმლოები',
            href: '/admin/ai-developer?tab=secrets',
            icon: KeyRound,
            indicator: 'ai-service',
          },
          {
            id: 'ai-developer-gurula',
            name: 'გურულო ჩატის მართვა',
            href: '/admin/ai-developer/gurula?section=chatConfig',
            icon: MessageSquare,
            indicator: 'ai-service',
          },
        );
      }

      return [
        { id: 'dashboard', label: 'დეშბორდი', items: [dashboardItem], variant: 'standalone' as const },
        { id: 'essentials', label: 'ძირითადი', items: essentials },
        { id: 'services', label: 'სერვისები', items: services },
        { id: 'partners', label: 'პარტნიორები', items: partners },
        { id: 'finance', label: 'ფინანსები', items: finance },
        { id: 'communication', label: 'კომუნიკაცია', items: communication },
        { id: 'technology', label: 'AI სივრცე', items: technology },
      ];
    }

    const finance: NavigationItem[] = [
      { name: 'ბანკის ანგარიშები', href: '/admin/bank-accounts', icon: CreditCard },
    ];

    const communication: NavigationItem[] = [
      { name: 'შეტყობინებები', href: '/admin/messaging', icon: MessageSquare },
    ];

    return [
      { id: 'dashboard', label: 'დეშბორდი', items: [dashboardItem], variant: 'standalone' as const },
      { id: 'essentials', label: 'ძირითადი', items: essentials },
      { id: 'services', label: 'სერვისები', items: services },
      { id: 'finance', label: 'ფინანსები', items: finance },
      { id: 'communication', label: 'კომუნიკაცია', items: communication },
    ].filter(group => group.items.length > 0);
  }, [isSuperAdmin, dashboardItem, legacyAiEnabled]);

  const normalizePath = (href: string) => href.split('?')[0].split('#')[0];

  const isRouteActive = useCallback(
    (href: string) => {
      const path = normalizePath(href);
      const currentPath = normalizePath(location.pathname);

      if (path === '/admin') {
        return currentPath === path;
      }

      return currentPath === path || currentPath.startsWith(`${path}/`);
    },
    [location.pathname]
  );

  const handleLogout = () => {
    logout();
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (isRouteActive(item.href)) {
      return true;
    }
    return item.children?.some((child) => isItemActive(child)) ?? false;
  };

  const flattenItems = (items: NavigationItem[]): NavigationItem[] => {
    return items.flatMap((item) => [item, ...(item.children ? flattenItems(item.children) : [])]);
  };

  const allNavigationItems = useMemo(
    () => navigationGroups.flatMap((group) => flattenItems(group.items)),
    [navigationGroups]
  );

  const activeItem = useMemo(
    () => allNavigationItems.find((item) => isRouteActive(item.href)),
    [allNavigationItems, location.pathname]
  );

  const activeGroup = useMemo(
    () => navigationGroups.find((group) => group.items.some((item) => isItemActive(item))),
    [navigationGroups, location.pathname]
  );

  const currentTitle = activeItem?.name || activeGroup?.label || 'ადმინის პანელი';

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    return navigationGroups.reduce((acc, group) => {
      acc[group.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      navigationGroups.forEach((group) => {
        const shouldExpand = group.items.some((item) => isItemActive(item));
        if (shouldExpand) {
          next[group.id] = true;
        } else if (!(group.id in next)) {
          next[group.id] = false;
        }
      });
      return next;
    });
  }, [navigationGroups, location.pathname]);

  useEffect(() => {
    setExpandedItems((prev) => {
      const next = { ...prev };
      allNavigationItems.forEach((item) => {
        if (item.children?.length && isItemActive(item)) {
          next[item.href] = true;
        }
      });
      return next;
    });
  }, [allNavigationItems, location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleItem = (href: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

  const renderNavigationItems = (items: NavigationItem[], depth = 0) => {
    return (
      <ul className="admin-nav__list" data-depth={depth}>
        {items.map((item) => {
          const Icon = item.icon;
          const hasChildren = Boolean(item.children?.length);
          const isActive = isRouteActive(item.href);
          const isBranchActive = isItemActive(item);
          const isExpanded = hasChildren ? expandedItems[item.href] ?? isBranchActive : false;

          return (
            <li key={item.href} className="admin-nav__entry" data-active-branch={isBranchActive}>
              <div
                className={`admin-nav__item ${isActive ? 'is-active' : ''} ${isBranchActive ? 'is-branch-active' : ''}`}
                data-depth={depth}
              >
                <Link to={item.href} className="admin-nav__item-link">
                  <Icon className="admin-nav__item-icon" />
                  <span className="admin-nav__item-label">{item.name}</span>
                  {item.indicator === 'ai-service' && (
                    <AISpaceStatusIndicator
                      status={aiServiceStatus}
                      className="admin-nav__item-indicator"
                    />
                  )}
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    className="admin-nav__item-toggle"
                    aria-label={`${isExpanded ? 'დახურვა' : 'გახსნა'} ${item.name}`}
                    aria-expanded={isExpanded}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleItem(item.href);
                    }}
                  >
                    <ChevronRight className={`admin-nav__item-chevron ${isExpanded ? 'is-open' : ''}`} />
                  </button>
                )}
              </div>
              {hasChildren && (
                <div className={`admin-nav__children ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
                  {renderNavigationItems(item.children!, depth + 1)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__header">
          <div className="admin-sidebar__profile">
            <div className="admin-sidebar__avatar admin-sidebar__avatar--logo admin-shimmer">
              <Mountain className="w-6 h-6" />
            </div>
            <div className="admin-sidebar__meta">
              <h1>ბახმარო • Admin</h1>
              <p>
                {user?.firstName} {user?.lastName}
              </p>
              <span className={`admin-role-badge ${isSuperAdmin ? '' : 'admin-role-badge--provider'}`}>
                <Shield className="w-3.5 h-3.5" />
                {isSuperAdmin ? 'სუპერ ადმინი' : 'პროვაიდერი'}
              </span>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          {navigationGroups.map((group) => {
            const isStandalone = group.variant === 'standalone';
            const isExpanded = isStandalone ? true : expandedGroups[group.id] ?? false;
            return (
              <section
                key={group.id}
                className={`admin-nav__group ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${
                  isStandalone ? 'admin-nav__group--standalone' : ''
                }`}
              >
                {!isStandalone && (
                  <button
                    type="button"
                    className="admin-nav__group-header"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`admin-nav-group-${group.id}`}
                  >
                    <span className="admin-nav__group-label">{group.label}</span>
                    <ChevronDown className={`admin-nav__group-chevron ${isExpanded ? 'is-open' : ''}`} />
                  </button>
                )}
                <div
                  id={`admin-nav-group-${group.id}`}
                  className={`admin-nav__group-items ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                >
                  {renderNavigationItems(group.items)}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <button onClick={handleLogout} className="admin-glass-button admin-danger-button">
            <LogOut className="w-4 h-4" />
            გასვლა
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar__title">
            <span>ბახმარო ადმინისტრაცია</span>
            <h2>{currentTitle}</h2>
          </div>

          <div className="admin-topbar__actions">
            <div className="admin-search">
              <Search />
              <input
                type="search"
                placeholder="ძიება მოდულებში, მომხმარებლებში, ჯავშნებში..."
                aria-label="მოძებნე ადმინ პანელში"
              />
            </div>
            {user && (
              <div className="admin-topbar__user-card">
                <Link to="/admin/profile" aria-label="ჩემი პროფილი" className="admin-topbar__user-link">
                  <User className="w-4 h-4" />
                </Link>
                <div className="admin-topbar__user-meta">
                  <span className="admin-topbar__user-name">{displayName}</span>
                  <span className="admin-topbar__user-greeting">{dailyGreeting}</span>
                </div>
              </div>
            )}
            <ThemeToggle className="admin-secondary-button" showLabel={false} />
            <button
              className="admin-primary-button"
              onClick={() =>
                captureInteractionError({
                  action: 'quick-action:system-activity',
                  elementId: 'admin-topbar-system-activity',
                  description: 'Triggered admin system activity quick action from the top bar.',
                  metadata: {
                    route: location.pathname,
                    timestamp: new Date().toISOString(),
                  },
                })
              }
            >
              <Activity className="w-4 h-4" />
              სისტემის აქტივობა
            </button>
          </div>
        </div>

        <div className="admin-content">
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
}

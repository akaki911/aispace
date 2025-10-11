import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  ChevronDown,
  Filter,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Mountain,
  Search,
  Shield,
  User as UserIcon,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useAIMode } from '../contexts/useAIMode';
import type { UserRole } from '../contexts/AuthContext.types';
import DiagnosticBanner from './layout/DiagnosticBanner';
import { headerTokens } from './layout/headerTokens';
import { useDailyGreeting } from '../hooks/useDailyGreeting';

interface HeaderProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

type BadgeTone = 'info' | 'success' | 'warning';

type NavItem = {
  label: string;
  to: string;
  requiresAuth?: boolean;
  roles?: UserRole[];
  badge?: {
    text: string;
    tone?: BadgeTone;
  };
};

type SearchSegment = {
  label: string;
  placeholder: string;
  icon: LucideIcon;
};

type QuickFilter = {
  label: string;
  to?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'მთავარი', to: '/' },
  { label: 'კოტეჯები', to: '/cottages', badge: { text: 'ახალი', tone: 'success' } },
  { label: 'სასტუმროები', to: '/hotels' },
  { label: 'ტრანსპორტი', to: '/vehicles', badge: { text: 'ტოპ', tone: 'info' } },
  { label: 'პროფილი', to: '/profile', requiresAuth: true },
  {
    label: 'სისტემის ჟურნალები',
    to: '/activity',
    requiresAuth: true,
    roles: ['SUPER_ADMIN']
  }
];

const SEARCH_SEGMENTS: SearchSegment[] = [
  {
    label: 'განთავსების ტიპი',
    placeholder: 'აირჩიეთ თავგადასავალი',
    icon: Mountain
  },
  {
    label: 'ლოკაცია',
    placeholder: 'მაგ. ბახმარო',
    icon: MapPin
  },
  {
    label: 'თარიღები',
    placeholder: 'ჩამოსვლა - გასვლა',
    icon: Calendar
  },
  {
    label: 'სტუმრები',
    placeholder: '2 სტუმარი',
    icon: Users
  }
];

const QUICK_FILTERS: QuickFilter[] = [
  { label: 'ბახმაროს ტოპ შეთავაზებები' },
  { label: 'ეკო-კოტეჯები' },
  { label: 'ოჯახური სივრცეები' },
  { label: 'სათხილამურო პაკეტები' }
];

const HIGHLIGHT_STATS = [
  { label: 'დადასტურებული კოტეჯები', value: '120+' },
  { label: 'გულშემატკივართა შეფასება', value: '4.9/5' },
  { label: 'მთის აქტივობები', value: '35+' }
];

const badgeToneStyles: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  info: {
    backgroundColor: headerTokens.colors.badgeInfoBg,
    color: headerTokens.colors.badgeInfoText
  },
  success: {
    backgroundColor: headerTokens.colors.badgeSuccessBg,
    color: headerTokens.colors.badgeSuccessText
  },
  warning: {
    backgroundColor: headerTokens.colors.badgeWarningBg,
    color: headerTokens.colors.badgeWarningText
  }
};

type HeaderCSSProperties = React.CSSProperties & {
  '--header-h'?: string;
  '--safe-padding'?: string;
};

const HEADER_CLASS = 'w-full';

const motionClass = 'transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none';

const Header: React.FC<HeaderProps> = () => {
  const {
    user,
    isAuthenticated,
    logout,
    getAutoRouteTarget,
    routeAdvice
  } = useAuth();
  const { isLive: isLiveMode } = useAIMode();

  const location = useLocation();
  const navigate = useNavigate();
  const [backendSession, setBackendSession] = useState('checking...');
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDesktopNavOpen, setIsDesktopNavOpen] = useState(false);
  const dailyGreeting = useDailyGreeting();

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);
  const desktopNavRef = useRef<HTMLDivElement | null>(null);

  const role = user?.role ?? 'GUEST';
  const displayName = useMemo(() => {
    if (!user) {
      return 'სტუმარი';
    }

    const composedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (composedName) {
      return composedName;
    }

    return user.displayName || user.email || 'სტუმარი';
  }, [user]);
  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return 'ადმინ პანელი';
    if (path.startsWith('/profile')) return 'პროფილი';
    if (path.startsWith('/vehicles')) return 'ტრანსპორტი';
    if (path.startsWith('/hotels')) return 'სასტუმროები';
    if (path.startsWith('/cottages')) return 'კოტეჯები';
    return 'კოტეჯების ჯავშანი';
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchBackendSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/me', {
          credentials: 'include',
          signal: controller.signal
        });

        if (!response.ok) {
          setBackendSession('none');
          return;
        }

        const data = await response.json();
        setBackendSession(data.isAuthenticated ? 'SUPER_ADMIN / backend' : 'none');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.warn('[Header] Failed to fetch backend session', error);
          setBackendSession('error');
        }
      }
    };

    fetchBackendSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsDesktopNavOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (mobileNavRef.current && !mobileNavRef.current.contains(target)) {
        setIsMobileNavOpen(false);
      }
      if (desktopNavRef.current && !desktopNavRef.current.contains(target)) {
        setIsDesktopNavOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const availableNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.requiresAuth && !isAuthenticated) {
        return false;
      }

      if (item.roles && (!user || !item.roles.includes(user.role as UserRole))) {
        return false;
      }

      return true;
    });
  }, [user, isAuthenticated]);

  const isMobile = viewportWidth <= 919;
  const isCompactMobile = viewportWidth <= 640;
  const headerHeight = isCompactMobile ? headerTokens.mobileHeight : headerTokens.height;
  const safePadding = isCompactMobile ? headerTokens.safePadding.mobile : headerTokens.safePadding.desktop;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--header-h', `${headerHeight}px`);
    root.style.setProperty('--safe-padding', `${safePadding}px`);

    return () => {
      root.style.removeProperty('--header-h');
      root.style.removeProperty('--safe-padding');
    };
  }, [headerHeight, safePadding]);

  const headerStyle: HeaderCSSProperties = {
    backgroundColor: headerTokens.colors.headerBackground,
    borderBottom: `1px solid ${headerTokens.colors.border}`,
    boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
    '--header-h': `${headerHeight}px`,
    '--safe-padding': `${safePadding}px`
  };
  const isCompactTabs = viewportWidth >= 920 && viewportWidth < 1200;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSmartLogin = () => {
    const target = getAutoRouteTarget();
    console.info('🧭 [HEADER] Auto-routing to:', target, 'reason:', routeAdvice.reason);
    navigate(target);
  };

  const emailDisplay = user?.email ?? '';

  const userInitial = user?.displayName?.[0] || user?.email?.[0] || 'U';

  return (
    <>
      <header className={`${HEADER_CLASS} relative`} style={headerStyle}>
        <div className="border-b" style={{ borderColor: headerTokens.colors.border }}>
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:gap-4 sm:py-2.5 lg:px-6">
            <div className="flex flex-1 items-center gap-6">
              <Link
                to="/"
                className={`flex items-center gap-3 ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                style={{ color: headerTokens.colors.textPrimary }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm sm:h-11 sm:w-11"
                  style={{
                    backgroundColor: headerTokens.colors.accent,
                    color: '#FFFFFF'
                  }}
                >
                  <Mountain size={22} />
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate text-base font-semibold sm:text-lg"
                    style={{ color: headerTokens.colors.textPrimary }}
                  >
                    ბახმარო
                  </p>
                  <p className="text-[11px] sm:text-xs" style={{ color: headerTokens.colors.textSecondary }}>
                    {pageTitle}
                  </p>
                </div>
              </Link>

              {!isMobile && (
                <div className="relative" ref={desktopNavRef}>
                  <button
                    type="button"
                    onClick={() => setIsDesktopNavOpen(prev => !prev)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: isDesktopNavOpen
                        ? 'rgba(16,185,129,0.4)'
                        : headerTokens.colors.border,
                      color: headerTokens.colors.textPrimary,
                      fontSize: headerTokens.typography.tab.size
                    }}
                    aria-expanded={isDesktopNavOpen}
                    aria-haspopup="menu"
                  >
                    <span>მენიუ</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${isDesktopNavOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isDesktopNavOpen && (
                    <nav
                      role="menu"
                      aria-label="Primary"
                      className="absolute left-0 z-50 mt-3 min-w-[220px] rounded-2xl border bg-white p-2 shadow-xl"
                      style={{ borderColor: headerTokens.colors.border }}
                    >
                      {availableNavItems.map(item => {
                        const tone: BadgeTone = item.badge?.tone ?? 'info';
                        const badgeStyle = badgeToneStyles[tone];

                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            role="menuitem"
                            className={({ isActive }) =>
                              [
                                'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold',
                                isActive
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-emerald-600'
                              ].join(' ')
                            }
                            style={{ fontSize: headerTokens.typography.tab.size }}
                          >
                            <span>{item.label}</span>
                            {item.badge && (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={badgeStyle}
                              >
                                {item.badge.text}
                              </span>
                            )}
                          </NavLink>
                        );
                      })}
                    </nav>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!isLiveMode && (
                <span
                  className="inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    borderColor: headerTokens.colors.accent,
                    backgroundColor: '#FEF3C7',
                    color: headerTokens.colors.accent
                  }}
                >
                  ⚠️ Demo fallback active
                </span>
              )}
              {isMobile && (
                <div className="relative" ref={mobileNavRef}>
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(prev => !prev)}
                    aria-expanded={isMobileNavOpen}
                    aria-haspopup="menu"
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                    style={{
                      backgroundColor: '#F1F5F9',
                      color: headerTokens.colors.textPrimary
                    }}
                  >
                    <Menu size={20} />
                  </button>
                  {isMobileNavOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-3 min-w-[220px] rounded-2xl border bg-white p-2 shadow-xl"
                      style={{ borderColor: headerTokens.colors.border }}
                    >
                      {availableNavItems.map(item => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          className={({ isActive }) =>
                            [
                              'block rounded-xl px-3 py-2 text-sm font-medium',
                              isActive
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-emerald-600'
                            ].join(' ')
                          }
                          style={{ fontSize: headerTokens.typography.tab.size }}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: headerTokens.colors.textSecondary
                  }}
                  aria-label="ფავორიტები"
                >
                  <Heart size={18} />
                </button>
                <button
                  type="button"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: headerTokens.colors.textSecondary
                  }}
                  aria-label="შეტყობინებები"
                >
                  <Bell size={18} />
                </button>
              </div>

              {isAuthenticated && (
                <Link
                  to="/profile"
                  className={`hidden h-10 w-10 items-center justify-center rounded-xl md:flex ${motionClass}`}
                  style={{
                    backgroundColor: '#ECFDF5',
                    color: headerTokens.colors.accent,
                    border: `1px solid ${headerTokens.colors.accent}`
                  }}
                  aria-label="ჩემი პროფილი"
                >
                  <UserIcon size={18} />
                </Link>
              )}

              {isAuthenticated && (
                <div className="hidden min-w-[140px] flex-col text-right md:flex">
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: headerTokens.colors.textPrimary }}
                  >
                    {displayName}
                  </span>
                  <span
                    className="truncate text-xs"
                    style={{ color: headerTokens.colors.textSecondary }}
                  >
                    {dailyGreeting}
                  </span>
                </div>
              )}

              {user && user.role !== 'CUSTOMER' && (
                <Link
                  to="/admin"
                  className={`hidden h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-sm md:flex ${motionClass}`}
                  style={{
                    backgroundColor: headerTokens.colors.accent,
                    boxShadow: '0 12px 24px rgba(34,197,94,0.18)'
                  }}
                >
                  <Shield size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">ადმინ პანელი</span>
                </Link>
              )}

              <div className="relative" ref={userMenuRef}>
                {user ? (
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                    className={`flex h-11 items-center gap-2 rounded-full px-3 text-left text-sm ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                    style={{
                      backgroundColor: '#F1F5F9',
                      color: headerTokens.colors.textPrimary
                    }}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: 'rgba(34,197,94,0.16)',
                        color: headerTokens.colors.accent
                      }}
                    >
                      {userInitial}
                    </div>
                    <div className="hidden min-w-0 flex-col text-left lg:flex">
                      <span className="truncate text-xs font-semibold" style={{ color: headerTokens.colors.textPrimary }}>
                        {user.displayName || user.firstName || user.email || 'მომხმარებელი'}
                      </span>
                      <span
                        className="truncate text-xs"
                        style={{
                          color: headerTokens.colors.textSecondary,
                          maxWidth: isCompactTabs ? 140 : 180
                        }}
                      >
                        {emailDisplay}
                      </span>
                    </div>
                    <ChevronDown size={16} aria-hidden="true" style={{ color: headerTokens.colors.textSecondary }} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSmartLogin}
                    className={`flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-sm ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                    style={{
                      backgroundColor: headerTokens.colors.accent,
                      boxShadow: '0 12px 24px rgba(34,197,94,0.18)'
                    }}
                  >
                    <UserIcon size={16} />
                    სისტემაში შესვლა
                  </button>
                )}

                {isUserMenuOpen && user && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-3 min-w-[240px] space-y-1 rounded-2xl border bg-white p-3 text-sm shadow-xl"
                    style={{ borderColor: headerTokens.colors.border }}
                  >
                    <div className="px-2 py-1 text-xs uppercase tracking-wide" style={{ color: headerTokens.colors.textSecondary }}>
                      {user.email}
                    </div>
                    <Link
                      to="/profile"
                      role="menuitem"
                      className={`block rounded-xl px-3 py-2 text-left text-sm ${motionClass}`}
                      style={{ color: headerTokens.colors.textPrimary }}
                    >
                      პროფილი
                    </Link>
                    {user.role !== 'CUSTOMER' && (
                      <Link
                        to="/admin"
                        role="menuitem"
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${motionClass}`}
                        style={{ color: headerTokens.colors.textPrimary }}
                      >
                        <Shield size={16} />
                        ადმინ პანელი
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      role="menuitem"
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${motionClass}`}
                      style={{ color: '#DC2626' }}
                    >
                      <LogOut size={16} />
                      გამოსვლა
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 via-white to-sky-50/60">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3">
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 shadow-sm">
                  <Mountain size={14} />
                  ბახმაროს ავთენტური გამოცდილება
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold leading-tight text-slate-900 lg:text-3xl">
                    მოემზადეთ მაღალმთიანი თავგადასავლისთვის
                  </h2>
                  <p className="max-w-xl text-sm text-slate-600 lg:text-base">
                    აერთიანეთ დასვენება, აქტივობები და კომფორტი ერთიან პლატფორმაზე. აირჩიეთ თქვენთვის შესაბამისი განთავსების ტიპი და დაგეგმეთ მოგზაურობა რამდენიმე კლიკით.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {HIGHLIGHT_STATS.map(stat => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/60 bg-white/80 p-3 text-center shadow-sm backdrop-blur"
                    >
                      <p className="text-xl font-bold text-emerald-600">{stat.value}</p>
                      <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex w-full max-w-xl flex-col gap-3 rounded-3xl border border-emerald-100/70 bg-white/90 p-3.5 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">სწრაფი ძიება</span>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                    style={{
                      borderColor: headerTokens.colors.border,
                      color: headerTokens.colors.textSecondary,
                      backgroundColor: '#F8FAFC'
                    }}
                  >
                    <Filter size={14} />
                    დეტალური ფილტრები
                  </button>
                </div>

                <div className="grid gap-1.5 sm:grid-cols-2">
                  {SEARCH_SEGMENTS.map(segment => {
                    const Icon = segment.icon;
                    return (
                      <div
                        key={segment.label}
                        className="group flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-emerald-200"
                      >
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"
                        >
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {segment.label}
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {segment.placeholder}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg ${motionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                  style={{ boxShadow: '0 16px 32px rgba(16,185,129,0.25)' }}
                >
                  <Search size={18} />
                  დაიწყე ძიება
                </button>

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_FILTERS.map(filter => (
                    <button
                      key={filter.label}
                      type="button"
                      className={`rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-600 ${motionClass}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <DiagnosticBanner
        session={backendSession}
        role={role}
        authState={isAuthenticated ? 'frontend' : 'anonymous'}
        additionalDetails={{
          email: user?.email,
          hasFrontendUser: Boolean(user),
          backendSession,
          route: location.pathname
        }}
      />
    </>
  );
};

export default Header;

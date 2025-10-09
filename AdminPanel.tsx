// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './contexts/usePermissions';
import { Navigate } from 'react-router-dom';
import {
  User,
  Settings,
  BookOpen,
  Calendar,
  CreditCard,
  LogOut,
  Users,
  Building2,
  Car,
  HelpCircle,
  BarChart3,
  MessageSquare,
  Shield,
  Plus,
  Trash2,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  BrainCircuit,
  Wand2,
  Activity,
  ShieldAlert,
  Settings2,
} from 'lucide-react';
import ActivityLog from './components/ActivityLog';
import ReplitAssistantPanel from './components/ReplitAssistantPanel';
import AIDeveloperPanel from '@aispace/components/AIDeveloperPanel';
import SystemMonitoringDashboard from './components/SystemMonitoringDashboard';
import AutoUpdateMonitoringDashboard from './components/AutoUpdateMonitoringDashboard';
import SecurityAuditTab from './components/SecurityAuditTab'; // Import added for Security Audit tab
import AIDeveloperManagementPanel, { GuruloSectionKey } from '@aispace/components/admin/AIDeveloperManagementPanel';
import AIDiagnosticsCenter from './components/admin/AIDiagnosticsCenter';
import { checkPasskeyAvailability, getWebAuthnErrorMessage } from './utils/webauthn_support';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { setFeatureFlagOverride } from '@/lib/featureFlags';
import { useTheme } from './contexts/useTheme';
import { useAIMode } from './contexts/useAIMode';

const AdminPanel: React.FC = () => {
  const { user, logout, isAuthenticated, registerPasskey: registerPasskeyFromContext } = useAuth();
  const { isDarkMode } = useTheme();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingGuruloSection, setPendingGuruloSection] = useState<GuruloSectionKey | null>(null);
  const [selectedGuruloSection, setSelectedGuruloSection] = useState<GuruloSectionKey>('chatConfig');
  const githubIntegrationEnabled = useFeatureFlag('GITHUB');
  const { mode: aiMode, lastUpdatedAt } = useAIMode();

  // Passkey states
  const [passkeySupport, setPasskeySupport] = useState({ supported: false, platformAuthenticator: false, conditionalUI: false });
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState('');
  const [registeredPasskeys, setRegisteredPasskeys] = useState<any[]>([]);
  const handleGitHubFeatureToggle = useCallback((enabled: boolean) => {
    console.log('🔧 [ADMIN PANEL] Updating GitHub feature flag:', enabled);
    setFeatureFlagOverride('GITHUB', enabled);
  }, []);

  if (!isAuthenticated || !user || (user.role !== 'SUPER_ADMIN' && user.role !== 'PROVIDER')) {
    return <Navigate to="/login" replace />;
  }

  // Check Passkey support on component mount
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const support = await checkPasskeyAvailability();
        setPasskeySupport(support);
        console.log('🔐 [AdminPanel] Passkey support:', support);
      } catch (error) {
        console.warn('⚠️ [AdminPanel] Passkey check failed:', error);
      }
    };

    checkSupport();

    // TODO: Load existing registered Passkeys for this user
    // loadRegisteredPasskeys();
  }, []);

  const handleLogout = async () => {
    try {
      console.log('🔧 [ADMIN PANEL] Starting SUPER_ADMIN logout');
      await logout(); // This will now handle role-based redirection automatically
    } catch (error) {
      console.error('❌ [ADMIN PANEL] Logout error:', error);
      // Force redirect to admin login on error
      window.location.href = '/login';
    }
  };

  // Passkey Registration Function
  const handleRegisterPasskey = async () => {
    if (!user) return;

    setPasskeyLoading(true);
    setPasskeyStatus('');

    try {
      console.log('🔐 [AdminPanel] Starting Passkey registration for:', user.email);

      await registerPasskeyFromContext();
      setPasskeyStatus('✅ Passkey წარმატებით დარეგისტრირდა! ახლა შეგიძლიათ გამოიყენოთ ბიომეტრიული შესვლა.');
      // TODO: Refresh registered passkeys list
      // loadRegisteredPasskeys();
    } catch (error: any) {
      console.error('❌ [AdminPanel] Passkey registration error:', error);
      setPasskeyStatus(`❌ ${getWebAuthnErrorMessage(error)}`);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'დეშბორდი', icon: BarChart3 },
    { id: 'autoupdate', label: 'ავტო-განახლება', icon: Settings },
    { id: 'bookings', label: 'ჯავშნები', icon: BookOpen },
    { id: 'calendar', label: 'კალენდარი', icon: Calendar },
    { id: 'cottages', label: 'კოტეჯები', icon: Building2 },
    { id: 'vehicles', label: 'ავტომობილები', icon: Car },
    { id: 'users', label: 'მომხმარებლები', icon: Users },
    { id: 'messaging', label: 'მესიჯები', icon: MessageSquare },
    { id: 'settings', label: 'პარამეტრები', icon: Settings },
    { id: 'security', label: 'Security Audit', icon: Shield }, // Added Security Audit tab item
  ];

  const aiDeveloperNav = [
    { id: 'aiDeveloper', label: 'AI Developer', icon: BrainCircuit, permission: 'ai_developer_access' },
    { id: 'aiDiagnostics', label: 'Health & Diagnostics', icon: Activity, permission: 'view_ai_diagnostics' },
  ];

  const guruloManagementNav = [
    { id: 'gurulo-overview', label: 'ჯამური ხედვა', icon: Activity, target: 'overview' as GuruloSectionKey },
    { id: 'gurulo-chat', label: 'ჩატის პრომპტები', icon: MessageSquare, target: 'chatConfig' as GuruloSectionKey },
    { id: 'gurulo-users', label: 'მომხმარებლების მართვა', icon: Users, target: 'userManagement' as GuruloSectionKey },
    { id: 'gurulo-ui', label: 'UI & ანიმაციები', icon: Wand2, target: 'uiCustomization' as GuruloSectionKey },
    { id: 'gurulo-analytics', label: 'ანალიტიკა & შეცდომები', icon: ShieldAlert, target: 'analytics' as GuruloSectionKey },
    { id: 'gurulo-integrations', label: 'ინტეგრაციები', icon: Settings2, target: 'integrations' as GuruloSectionKey },
  ];

  const guruloPermissionMap: Record<GuruloSectionKey, string | null> = {
    overview: 'view_gurulo_overview',
    chatConfig: 'edit_gurulo_prompts',
    userManagement: 'manage_gurulo_users',
    uiCustomization: 'manage_gurulo_ui',
    analytics: 'view_gurulo_analytics',
    integrations: 'manage_gurulo_integrations',
  };

  const focusGuruloSection = (section: GuruloSectionKey) => {
    const requiredPermission = guruloPermissionMap[section];
    if (requiredPermission && !hasPermission(requiredPermission as any)) {
      console.warn('🚫 [ADMIN PANEL] Missing permission for section:', section);
      return;
    }
    setActiveTab('aiDeveloper');
    setSelectedGuruloSection(section);
    setPendingGuruloSection(section);
  };

  const navigateToSection = (section: string) => {
    switch (section) {
      case 'bookings':
        window.location.href = '/admin/javshnissia';
        break;
      case 'calendar':
        window.location.href = '/admin/calendar';
        break;
      case 'cottages':
        window.location.href = '/admin/cottages';
        break;
      case 'vehicles':
        window.location.href = '/admin/vehicles';
        break;
      case 'users':
        window.location.href = '/admin/users';
        break;
      case 'messaging':
        window.location.href = '/admin/messaging';
        break;
      case 'aiDeveloper':
        setActiveTab('aiDeveloper');
        setSelectedGuruloSection('overview');
        break;
      case 'aiDiagnostics':
        setActiveTab('aiDiagnostics');
        break;
      default:
        setActiveTab(section);
    }
  };

  const pageThemeClasses = isDarkMode
    ? 'bg-slate-950 text-slate-100'
    : 'bg-slate-100 text-slate-900';

  const headerThemeClasses = isDarkMode
    ? 'border-b border-white/10 bg-slate-950/80'
    : 'border-b border-slate-200 bg-white/80';

  const headerTitleClasses = isDarkMode ? 'text-white' : 'text-slate-900';
  const headerSubtitleClasses = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const logoutButtonClasses = isDarkMode
    ? 'inline-flex items-center px-4 py-2 rounded-md border border-rose-500/30 bg-rose-500/20 text-sm font-medium text-rose-100 transition hover:bg-rose-500/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-400/40'
    : 'inline-flex items-center px-4 py-2 rounded-md border border-rose-500/40 bg-rose-50 text-sm font-medium text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-200';

  const shellCardClasses = isDarkMode
    ? 'rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.55)]'
    : 'rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.12)]';

  const contentCardClasses = isDarkMode
    ? 'rounded-3xl border border-white/10 bg-slate-950/60 p-6'
    : 'rounded-3xl border border-slate-200 bg-white p-6';

  const getPrimaryNavButtonClasses = (itemId: string) => {
    const base = 'inline-flex items-center border-b-2 px-1 py-2 text-sm font-medium transition-colors whitespace-nowrap';
    if (activeTab === itemId) {
      return `${base} ${isDarkMode ? 'border-cyan-400 text-cyan-200' : 'border-cyan-500 text-cyan-600'}`;
    }
    return `${base} ${
      isDarkMode
        ? 'border-transparent text-slate-500 hover:border-slate-700 hover:text-slate-200'
        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
    }`;
  };

  const getSecondaryNavButtonClasses = (isActive: boolean) => {
    const base = 'inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition';
    if (isActive) {
      return `${base} bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 text-white shadow-lg`;
    }
    return `${base} ${
      isDarkMode
        ? 'border border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
    }`;
  };

  const getAiNavButtonClasses = (isActive: boolean) => {
    const base = 'inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition';
    if (isActive) {
      return `${base} bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 text-white shadow-lg`;
    }
    return `${base} ${
      isDarkMode
        ? 'border border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
    }`;
  };

  return (
    <div className={`min-h-screen ${pageThemeClasses}`}>
      {/* Header */}
      <header className={`${headerThemeClasses} backdrop-blur-xl`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className={`text-3xl font-bold ${headerTitleClasses}`}>
                ადმინისტრაციის პანელი
              </h1>
              <p className={headerSubtitleClasses}>
                მოგესალმებით, {user.displayName || user.email}! ({user.role})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className={logoutButtonClasses}
            >
              <LogOut className="w-4 h-4 mr-2" />
              გასვლა
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className={shellCardClasses}>
            {/* Navigation */}
            <div className="mb-8">
              <nav className="flex flex-col space-y-6">
                <div className="flex space-x-8 overflow-x-auto">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateToSection(item.id)}
                        className={getPrimaryNavButtonClasses(item.id)}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {user.role === 'SUPER_ADMIN' && (
                  <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">AI Developer</p>
                    <div className="flex space-x-6 overflow-x-auto">
                      {aiDeveloperNav
                        .filter((item) => !item.permission || hasPermission(item.permission as any))
                        .map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => navigateToSection(item.id)}
                            className={getAiNavButtonClasses(activeTab === item.id)}
                          >
                            <Icon className="mr-2 h-4 w-4" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">გურულოს მართვა</p>
                      <div className="flex space-x-6 overflow-x-auto">
                        {guruloManagementNav
                          .filter((item) => {
                            const required = guruloPermissionMap[item.target];
                            return !required || hasPermission(required as any);
                          })
                          .map((item) => {
                            const Icon = item.icon;
                            const isActive =
                              activeTab === 'aiDeveloper' && selectedGuruloSection === item.target;
                            return (
                              <button
                              key={item.id}
                              onClick={() => focusGuruloSection(item.target)}
                              className={getSecondaryNavButtonClasses(isActive)}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </nav>
            </div>

            {/* Content */}
            <div className={contentCardClasses}>
              {activeTab === 'dashboard' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    ადმინისტრაციული პანელი
                  </h2>

                  {/* Main Dashboard Grid - 4 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    {/* მომხმარებლები */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-100 text-sm font-medium">მომხმარებლები</p>
                          <p className="text-3xl font-bold">150</p>
                        </div>
                        <Users className="w-10 h-10 text-blue-200" />
                      </div>
                    </div>

                    {/* აქტიური ჯავშნები */}
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-green-100 text-sm font-medium">აქტიური ჯავშნები</p>
                          <p className="text-3xl font-bold">23</p>
                        </div>
                        <Calendar className="w-10 h-10 text-green-200" />
                      </div>
                    </div>

                    {/* შემოსავალი */}
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-100 text-sm font-medium">შემოსავალი</p>
                          <p className="text-3xl font-bold">₾45000</p>
                        </div>
                        <CreditCard className="w-10 h-10 text-purple-200" />
                      </div>
                    </div>

                    {/* მოლოდინში */}
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-orange-100 text-sm font-medium">მოლოდინში</p>
                          <p className="text-3xl font-bold">5</p>
                        </div>
                        <HelpCircle className="w-10 h-10 text-orange-200" />
                      </div>
                    </div>
                  </div>

                  {/* Second Row - 3 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* AI Developer Panel */}
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-500 p-6 rounded-xl text-white cursor-pointer hover:from-blue-500 hover:to-blue-600 transition-all"
                      onClick={() => window.location.href = '/admin/ai-developer'}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Users className="w-8 h-8 text-blue-200" />
                        <div className="text-right">
                          <p className="text-blue-100 text-sm">AI დეველოპერი</p>
                          <p className="text-blue-100 text-xs">გურულო AI ასისტენტი</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">AI</p>
                    </div>

                    {/* ჯავშნები */}
                    <div className="bg-gradient-to-r from-green-400 to-green-500 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <Calendar className="w-8 h-8 text-green-200" />
                        <div className="text-right">
                          <p className="text-green-100 text-sm">ჯავშნები</p>
                          <p className="text-green-100 text-xs">ახალი ჯავშნები</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">23</p>
                    </div>

                    {/* კოტეჯები */}
                    <div className="bg-gradient-to-r from-purple-400 to-purple-500 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <Building2 className="w-8 h-8 text-purple-200" />
                        <div className="text-right">
                          <p className="text-purple-100 text-sm">კოტეჯები</p>
                          <p className="text-purple-100 text-xs">რეგისტრირებული კოტეჯები</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">12</p>
                    </div>
                  </div>

                  {/* Third Row - 3 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* სისტემები */}
                    <div className="bg-gradient-to-r from-indigo-400 to-indigo-500 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <Settings className="w-8 h-8 text-indigo-200" />
                        <div className="text-right">
                          <p className="text-indigo-100 text-sm">სისტემები</p>
                          <p className="text-indigo-100 text-xs">აქტიური სისტემები</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">8</p>
                    </div>

                    {/* აპლიკაციები */}
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <BookOpen className="w-8 h-8 text-yellow-200" />
                        <div className="text-right">
                          <p className="text-yellow-100 text-sm">აპლიკაციები</p>
                          <p className="text-yellow-100 text-xs">დაინსტალირებული აპები</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">15</p>
                    </div>

                    {/* ბილიინგი */}
                    <div className="bg-gradient-to-r from-red-400 to-red-500 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <CreditCard className="w-8 h-8 text-red-200" />
                        <div className="text-right">
                          <p className="text-red-100 text-sm">ბილინგი</p>
                          <p className="text-red-100 text-xs">მიმდინარე თანხები</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">₾45000</p>
                    </div>
                  </div>

                  {/* Fourth Row - 2 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ლოგები */}
                    <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <BarChart3 className="w-8 h-8 text-gray-200" />
                        <div className="text-right">
                          <p className="text-gray-100 text-sm">ლოგები</p>
                          <p className="text-gray-100 text-xs">სისტემური ლოგები</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">6ათასი</p>
                    </div>

                    {/* შეტყობინებები */}
                    <div className="bg-gradient-to-r from-teal-400 to-teal-500 p-6 rounded-xl text-white">
                      <div className="flex items-center justify-between mb-2">
                        <MessageSquare className="w-8 h-8 text-teal-200" />
                        <div className="text-right">
                          <p className="text-teal-100 text-sm">შეტყობინებები</p>
                          <p className="text-teal-100 text-xs">შეტყობინებები დღეს</p>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">მარჩა</p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      სწრაფი მოქმედებები
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button
                        onClick={() => navigateToSection('bookings')}
                        className="p-4 bg-blue-100 dark:bg-blue-800 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                      >
                        <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          ჯავშნები
                        </p>
                      </button>

                      <button
                        onClick={() => navigateToSection('cottages')}
                        className="p-4 bg-green-100 dark:bg-green-800 rounded-lg hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                      >
                        <Building2 className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          კოტეჯები
                        </p>
                      </button>

                      <button
                        onClick={() => navigateToSection('vehicles')}
                        className="p-4 bg-orange-100 dark:bg-orange-800 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-700 transition-colors"
                      >
                        <Car className="w-6 h-6 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          ავტომობილები
                        </p>
                      </button>

                      <button
                        onClick={() => navigateToSection('calendar')}
                        className="p-4 bg-purple-100 dark:bg-purple-800 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors"
                      >
                        <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          კალენდარი
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'aiDeveloper' && (
                <AIDeveloperManagementPanel
                  focusSection={pendingGuruloSection}
                  onSectionFocusHandled={() => setPendingGuruloSection(null)}
                />
              )}

              {activeTab === 'aiDiagnostics' && <AIDiagnosticsCenter />}

              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    პარამეტრები
                  </h2>

                  {/* Account Information */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      ანგარიშის ინფორმაცია
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          ელ-ფოსტა
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {user.email}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          როლი
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {user.role}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* GitHub Integration Toggle */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            GitHub ინტეგრაცია
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          ჩართეთ <code className="rounded bg-gray-100 dark:bg-gray-900 px-1 py-0.5 text-xs font-mono">VITE_GITHUB_ENABLED</code>{' '}
                          feature flag რათა გააქტიურდეს GitHub მენეჯმენტის ჰაბი და ავტომატიზაციები.
                        </p>
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                          ეს პარამეტრი ინახება მხოლოდ ამ ბრაუზერში. საერთო გარემოსთვის დაამატეთ <code className="rounded bg-gray-100 dark:bg-gray-900 px-1 py-0.5 text-[10px] font-mono">VITE_GITHUB_ENABLED=1</code>{' '}
                          თქვენს კონფიგურაციაში.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {githubIntegrationEnabled ? 'აქტიურია' : 'გამორთულია'}
                        </span>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={githubIntegrationEnabled}
                            onChange={(event) => handleGitHubFeatureToggle(event.target.checked)}
                          />
                          <div className="h-6 w-11 rounded-full bg-gray-300 transition-colors duration-200 peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500"></div>
                          <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5"></span>
                        </label>
                      </div>
                    </div>
                    {githubIntegrationEnabled ? (
                      <div className="mt-4 flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="h-4 w-4" />
                        <span>GitHub მენეჯმენტის ჰაბი აქტიურია. დაბრუნდით AI Developer პანელში სრული GitOps გამოცდილებისთვის.</span>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4" />
                        <span>GitHub ინტეგრაცია გათიშულია სანამ არ ჩართავთ ამ ტოგლს ან არ განსაზღვრავთ VITE_GITHUB_ENABLED=1 გარემოში.</span>
                      </div>
                    )}
                  </div>

                  {user.role === 'SUPER_ADMIN' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                              AI ჩატის რეჟიმი
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            მართე Gurulo-ს ჩატი. რეალური დროის რეჟიმი უშუალოდ უკავშირდება Groq-ის მიკროსერვისს, ხოლო Demo რეჟიმი აჩვენებს სანიტარიზებულ ფოლბექ-პასუხებს.
                          </p>
                          <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                            ცვლილება მხოლოდ ვიზუალურია — უსაფრთხოების პოლიტიკები და ავტენტიკაცია უცვლელია.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {aiMode === 'live' ? 'Realtime' : 'Demo'}
                          </span>
                          <label className="relative inline-flex cursor-not-allowed items-center" title="Realtime relay is enforced for all users">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked
                              disabled
                              aria-disabled="true"
                            />
                            <div className="h-6 w-11 rounded-full bg-emerald-600 transition-colors duration-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500"></div>
                            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5"></span>
                          </label>
                        </div>
                      </div>
                      <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                        <span className="text-xs font-semibold uppercase tracking-wide">AI</span>
                        <div>
                          <p className="font-medium">
                            AI სერვერი რეალურ დროში სვლაშია და შეტყობინებები იგზავნება უშუალოდ Groq-ის წარმოების არხზე.
                          </p>
                          <p className="mt-1 text-xs opacity-80">
                            ბოლო განახლება: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('ka-GE') : '—'}
                          </p>
                          <p className="mt-1 text-xs opacity-80">
                            ტოგლი მხოლოდ სტატუსის ჩვენებისთვისაა — ფუნქციურად რეალური დროის არხი ყოველთვის აქტიურია.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Passkey Security Section */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center mb-4">
                      <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Passkey უსაფრთხოება
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Passkey-ები საშუალებას გაძლევთ უსაფრთხოდ შეხვიდეთ ბიომეტრიული ავტორიზაციით (TouchID, FaceID, Windows Hello) ან PIN კოდით.
                      </p>

                      {/* Browser Support Status */}
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          ბრაუზერის მხარდაჭერა
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${passkeySupport.supported ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="text-gray-700 dark:text-gray-300">
                              WebAuthn მხარდაჭერა: {passkeySupport.supported ? 'მხარდაჭერილია' : 'არ არის მხარდაჭერილი'}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${passkeySupport.platformAuthenticator ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                            <span className="text-gray-700 dark:text-gray-300">
                              ბიომეტრია: {passkeySupport.platformAuthenticator ? 'ხელმისაწვდომია' : 'მხოლოდ უსაფრთხოების გასაღები'}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${passkeySupport.conditionalUI ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            <span className="text-gray-700 dark:text-gray-300">
                              ავტომატური შესვლა: {passkeySupport.conditionalUI ? 'მხარდაჭერილია' : 'არ არის მხარდაჭერილი'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Registration Section */}
                      {passkeySupport.supported ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                Passkey-ის რეგისტრაცია
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                დაამატეთ ახალი Passkey უსაფრთხო შესვლისთვის
                              </p>
                            </div>
                            <button
                              onClick={handleRegisterPasskey}
                              disabled={passkeyLoading}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {passkeyLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  რეგისტრაცია...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Passkey-ის დამატება
                                </>
                              )}
                            </button>
                          </div>

                          {/* Status Message */}
                          {passkeyStatus && (
                            <div className={`p-3 rounded-md text-sm ${
                              passkeyStatus.includes('✅')
                                ? 'bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            }`}>
                              {passkeyStatus}
                            </div>
                          )}

                          {/* Registered Passkeys List */}
                          {registeredPasskeys.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                რეგისტრირებული Passkey-ები
                              </h4>
                              <div className="space-y-2">
                                {registeredPasskeys.map((passkey, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                                    <div className="flex items-center">
                                      <Shield className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        Passkey #{index + 1}
                                      </span>
                                    </div>
                                    <button
                                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                      title="წაშლა"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                          <div className="flex">
                            <HelpCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                                Passkey არ არის მხარდაჭერილი
                              </h4>
                              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                თქვენი ბრაუზერი არ მხარს უჭერს Passkey ტექნოლოგიას. გამოიყენეთ Chrome, Firefox, Safari ან Edge-ის უახლესი ვერსია.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'autoupdate' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    ავტო-განახლება
                  </h2>
                  <AutoUpdateMonitoringDashboard />
                </div>
              )}
              {activeTab === 'security' && <SecurityAuditTab />} {/* Render SecurityAuditTab when activeTab is 'security' */}
              {activeTab === 'logs' && <ActivityLog />}
              {activeTab === 'monitoring' && <SystemMonitoringDashboard />}
              {activeTab === 'ai-developer' && <AIDeveloperPanel />}
              {activeTab === 'replit-assistant' && <ReplitAssistantPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Profiler } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Edit2, Save, X, AlertCircle, Activity, Clock, BarChart3 } from 'lucide-react';
import { User } from './types/user';
import { getAllUsers, updateUser } from './services/userService';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { logAuditEvent } from './services/auditService';

// 🔧 PROFILER CALLBACK with detailed analysis
const onRenderCallback = (
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
  interactions: Set<any>
) => {
  const performanceData = {
    component: id,
    phase,
    actualDuration: Math.round(actualDuration * 100) / 100,
    baseDuration: Math.round(baseDuration * 100) / 100,
    startTime: Math.round(startTime * 100) / 100,
    commitTime: Math.round(commitTime * 100) / 100,
    efficiency: Math.round((baseDuration / actualDuration) * 100),
    interactions: interactions.size
  };

  console.group(`🔍 React Profiler: ${id} (${phase})`);
  console.table(performanceData);
  
  // Performance warnings with specific thresholds
  if (actualDuration > 100) {
    console.error(`🚨 CRITICAL SLOW RENDER: ${actualDuration.toFixed(2)}ms > 100ms threshold`);
  } else if (actualDuration > 50) {
    console.warn(`⚠️ SLOW RENDER: ${actualDuration.toFixed(2)}ms > 50ms threshold`);
  } else if (actualDuration > 16) {
    console.info(`ℹ️ MODERATE RENDER: ${actualDuration.toFixed(2)}ms > 16ms (60fps)`);
  } else {
    console.log(`✅ FAST RENDER: ${actualDuration.toFixed(2)}ms`);
  }
  
  if (actualDuration > baseDuration * 3) {
    console.error(`🚨 VERY INEFFICIENT RENDER: ${(actualDuration / baseDuration).toFixed(1)}x slower than optimal`);
  } else if (actualDuration > baseDuration * 2) {
    console.warn(`⚠️ INEFFICIENT RENDER: ${(actualDuration / baseDuration).toFixed(1)}x slower than optimal`);
  }
  
  console.groupEnd();
  
  // Store performance data globally for analysis
  if (!window.performanceData) window.performanceData = [];
  window.performanceData.push(performanceData);
};

// Performance monitoring is now handled by the usePerformanceMonitor hookor Hook with detailed metrics
const usePerformanceMonitor = (componentName: string) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(performance.now());
  const renderTimesRef = useRef<number[]>([]);
  const memoryCheckIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    renderCountRef.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;
    renderTimesRef.current.push(timeSinceLastRender);

    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current = renderTimesRef.current.slice(-10);
    }

    const avgRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;

    console.log(`🔄 ${componentName} Render #${renderCountRef.current}`);
    console.log(`⏱️ Time since last: ${timeSinceLastRender.toFixed(2)}ms`);
    console.log(`📊 Average render time: ${avgRenderTime.toFixed(2)}ms`);

    // Detect rapid re-renders (potential infinite loop)
    if (timeSinceLastRender < 100 && renderCountRef.current > 3) {
      console.error(`🚨 RAPID RE-RENDERS detected in ${componentName}! Possible infinite loop.`);
      console.trace('Render stack trace');
    }

    // Memory monitoring every 5 renders
    if (renderCountRef.current % 5 === 0) {
      checkMemoryUsage();
    }
  });

  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryData = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
      };
      
      console.log(`💾 Memory Usage:`, memoryData);
      
      // Memory leak detection
      if (memoryData.used > memoryData.limit * 0.8) {
        console.error(`🚨 HIGH MEMORY USAGE: ${memoryData.used}MB (${((memoryData.used / memoryData.limit) * 100).toFixed(1)}% of limit)`);
      }
      
      return memoryData;
    }
    return null;
  }, []);

  const getPerformanceSummary = useCallback(() => {
    const avgRenderTime = renderTimesRef.current.length > 0 
      ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length 
      : 0;
    
    return {
      renderCount: renderCountRef.current,
      averageRenderTime: Math.round(avgRenderTime * 100) / 100,
      lastRenderTimes: [...renderTimesRef.current],
      memoryUsage: checkMemoryUsage()
    };
  }, [checkMemoryUsage]);

  return {
    renderCount: renderCountRef.current,
    checkMemoryUsage,
    getPerformanceSummary
  };
};

// 🔧 Stub Data Hook for testing
const useStubData = (enabled: boolean, providerId?: string) => {
  const [provider, setProvider] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    console.time('🔧 STUB DATA: Provider fetch');
    
    const timer = setTimeout(() => {
      const stubProvider: User = {
        id: providerId || 'stub-provider-1',
        email: 'stub.provider@bakhmaro.ge',
        firstName: 'ტესტ',
        lastName: 'პროვაიდერი',
        role: 'PROVIDER_ADMIN',
        isActive: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20')
      };
      
      setProvider(stubProvider);
      setLoading(false);
      setError(null);
      
      console.timeEnd('🔧 STUB DATA: Provider fetch');
      console.log('🔧 STUB DATA loaded successfully');
    }, 50); // Very fast for testing

    return () => clearTimeout(timer);
  }, [enabled, providerId]);

  const updateProvider = useCallback(async (updates: Partial<User>) => {
    if (!enabled) return;
    
    console.time('🔧 STUB DATA: Provider update');
    
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setProvider(prev => prev ? { ...prev, ...updates, updatedAt: new Date() } : null);
        console.timeEnd('🔧 STUB DATA: Provider update');
        console.log('🔧 STUB DATA updated successfully');
        resolve();
      }, 30);
    });
  }, [enabled]);

  return { provider, loading, error, updateProvider };
};

export default function ProviderDetails() {
  console.time('🚀 ProviderDetails Component Mount');
  
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { canManageUsers } = usePermissions();
  
  // 🔧 Performance monitoring
  const { renderCount, checkMemoryUsage, getPerformanceSummary } = usePerformanceMonitor('ProviderDetails');
  
  // 🔧 TOGGLE THIS FOR TESTING - Set to true to use stub data
  const USE_STUB_DATA = false;
  
  // Component state
  const isMountedRef = useRef(true);
  const [provider, setProvider] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    isActive: true
  });
  
  // 🔧 Stub data for testing
  const stubData = useStubData(USE_STUB_DATA, id);
  
  // 🔧 Performance tracking on mount/unmount
  useEffect(() => {
    console.log('🔍 Component mounted - Performance tracking started');
    console.log('🔍 Initial Performance Summary:', getPerformanceSummary());
    
    return () => {
      console.timeEnd('🚀 ProviderDetails Component Mount');
      console.log('🔍 Final Performance Summary:', getPerformanceSummary());
      console.log('🔍 Component unmounted');
      isMountedRef.current = false;
    };
  }, [getPerformanceSummary]);

  // 🔧 Main data fetching effect
  useEffect(() => {
    console.time('📊 Data Fetch Effect');
    
    // Use stub data if enabled
    if (USE_STUB_DATA) {
      console.log('🔧 Using STUB DATA for testing');
      setProvider(stubData.provider);
      setLoading(stubData.loading);
      setError(stubData.error);
      
      if (stubData.provider) {
        setEditForm({
          firstName: stubData.provider.firstName,
          lastName: stubData.provider.lastName,
          email: stubData.provider.email,
          isActive: stubData.provider.isActive
        });
      }
      
      console.timeEnd('📊 Data Fetch Effect');
      return;
    }
    
    // Permission check
    if (!canManageUsers() || !id) {
      console.timeEnd('📊 Data Fetch Effect');
      setLoading(false);
      return;
    }

    const fetchProviderData = async () => {
      console.time('🌐 API Call: getAllUsers');
      
      try {
        setLoading(true);
        setError(null);

        // Timeout protection
        const timeoutId = setTimeout(() => {
          console.error('🚨 TIMEOUT: Data fetch took too long');
          if (isMountedRef.current) {
            setError('მონაცემების ჩატვირთვა ძალიან დიდხანს გრძელდება');
            setLoading(false);
          }
        }, 10000); // 10 second timeout

        // Fetch data
        const users = await getAllUsers();
        console.timeEnd('🌐 API Call: getAllUsers');
        
        clearTimeout(timeoutId);
        
        if (!isMountedRef.current) {
          console.warn('⚠️ Component unmounted during fetch');
          return;
        }
        
        const providerUser = users.find(u => u.id === id);
        
        if (!providerUser) {
          console.warn('⚠️ Provider not found, redirecting');
          navigate('/admin/users');
          return;
        }
        
        console.time('🔄 State Update');
        setProvider(providerUser);
        setEditForm({
          firstName: providerUser.firstName,
          lastName: providerUser.lastName,
          email: providerUser.email,
          isActive: providerUser.isActive
        });
        console.timeEnd('🔄 State Update');

      } catch (error) {
        console.error('🚨 Error fetching provider data:', error);
        console.timeEnd('🌐 API Call: getAllUsers');
        if (isMountedRef.current) {
          setError('მონაცემების ჩატვირთვისას დაფიქსირდა შეცდომა');
        }
      } finally {
        console.timeEnd('📊 Data Fetch Effect');
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchProviderData();
  }, [canManageUsers, id, navigate, USE_STUB_DATA, stubData.provider, stubData.loading, stubData.error]);

  // 🔧 Optimized form change handler
  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.time('⚡ Form Change Handler');
    
    if (!isMountedRef.current || saving) {
      console.timeEnd('⚡ Form Change Handler');
      return;
    }
    
    const { name, value, type, checked } = e.target;
    
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    console.timeEnd('⚡ Form Change Handler');
  }, [saving]);

  // 🔧 Optimized edit handlers
  const handleStartEdit = useCallback(() => {
    console.time('✏️ Start Edit');
    
    if (!provider || isEditing || saving || !isMountedRef.current) {
      console.timeEnd('✏️ Start Edit');
      return;
    }
    
    setEditForm({
      firstName: provider.firstName,
      lastName: provider.lastName,
      email: provider.email,
      isActive: provider.isActive
    });
    setIsEditing(true);
    
    console.timeEnd('✏️ Start Edit');
  }, [provider, isEditing, saving]);

  const handleSaveProvider = useCallback(async () => {
    console.time('💾 Save Provider');
    
    if (!provider || !currentUser || saving || !isEditing || !isMountedRef.current) {
      console.timeEnd('💾 Save Provider');
      return;
    }
    
    setSaving(true);
    
    try {
      // Validation
      if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
        alert('გთხოვთ შეავსოთ ყველა სავალდებულო ველი');
        console.timeEnd('💾 Save Provider');
        return;
      }

      const oldData = { ...provider };
      const updates = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        isActive: editForm.isActive
      };
      
      console.time('🌐 API Call: updateUser');
      
      // Use stub update if enabled
      if (USE_STUB_DATA && stubData.updateProvider) {
        await stubData.updateProvider(updates);
      } else {
        await updateUser(provider.id, updates);
      }
      
      console.timeEnd('🌐 API Call: updateUser');
      
      if (!isMountedRef.current) {
        console.timeEnd('💾 Save Provider');
        return;
      }
      
      // Update local state
      const updatedProvider = { ...provider, ...updates, updatedAt: new Date() };
      setProvider(updatedProvider);
      
      // Log audit event
      console.time('📝 Audit Log');
      await logAuditEvent(
        currentUser.id,
        currentUser.email,
        'UPDATE',
        'user',
        provider.id,
        oldData,
        updatedProvider
      );
      console.timeEnd('📝 Audit Log');
      
      if (isMountedRef.current) {
        setIsEditing(false);
        alert('პროვაიდერის ინფორმაცია წარმატებით განახლდა');
      }
    } catch (error) {
      console.error('🚨 Error updating provider:', error);
      if (isMountedRef.current) {
        alert('შეცდომა პროვაიდერის განახლებისას');
      }
    } finally {
      console.timeEnd('💾 Save Provider');
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [provider, currentUser, saving, isEditing, editForm, USE_STUB_DATA, stubData.updateProvider]);

  const handleCancelEdit = useCallback(() => {
    console.time('❌ Cancel Edit');
    
    if (!isMountedRef.current || saving) {
      console.timeEnd('❌ Cancel Edit');
      return;
    }
    
    if (provider) {
      setEditForm({
        firstName: provider.firstName,
        lastName: provider.lastName,
        email: provider.email,
        isActive: provider.isActive
      });
    }
    setIsEditing(false);
    
    console.timeEnd('❌ Cancel Edit');
  }, [provider, saving]);

  // 🔧 Memoized performance data
  const performanceData = useMemo(() => {
    const summary = getPerformanceSummary();
    return {
      renderCount: summary.renderCount,
      avgRenderTime: summary.averageRenderTime,
      memoryUsage: summary.memoryUsage,
      dataSource: USE_STUB_DATA ? 'STUB DATA' : 'REAL API'
    };
  }, [getPerformanceSummary, USE_STUB_DATA]);

  console.timeEnd('🚀 ProviderDetails Component Mount');

  // 🔧 Early returns for error states
  if (!canManageUsers()) {
    return (
      <div className="p-8">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">წვდომა შეზღუდულია</h3>
          <p className="text-gray-500 mb-4">თქვენ არ გაქვთ პროვაიდერების ნახვის უფლება</p>
          <button
            onClick={() => navigate('/admin')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            მთავარ გვერდზე დაბრუნება
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">მონაცემების ჩატვირთვა...</p>
          <p className="text-sm text-gray-500 mt-2">
            {USE_STUB_DATA ? '🔧 STUB DATA Loading...' : '🌐 API Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">შეცდომა</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/admin/users')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            უკან დაბრუნება
          </button>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-8">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">პროვაიდერი ვერ მოიძებნა</h3>
          <button
            onClick={() => navigate('/admin/users')}
            className="text-blue-600 hover:text-blue-700"
          >
            უკან დაბრუნება
          </button>
        </div>
      </div>
    );
  }

  // 🔧 MAIN RENDER - Wrapped in Profiler for detailed analysis
  return (
    <Profiler id="ProviderDetails" onRender={onRenderCallback}>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              უკან
            </button>
            <div>
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                      <span className="text-blue-600 font-bold text-lg">
                        {editForm.firstName.charAt(0) || 'P'}{editForm.lastName.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        name="firstName"
                        value={editForm.firstName}
                        onChange={handleEditChange}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="სახელი"
                        disabled={saving}
                        required
                      />
                      <input
                        type="text"
                        name="lastName"
                        value={editForm.lastName}
                        onChange={handleEditChange}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="გვარი"
                        disabled={saving}
                        required
                      />
                    </div>
                  </div>
                  <div className="ml-16">
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleEditChange}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="ელ-ფოსტა"
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className="ml-16 flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={editForm.isActive}
                        onChange={handleEditChange}
                        disabled={saving}
                        className="sr-only"
                      />
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${
                        editForm.isActive ? 'bg-green-600' : 'bg-gray-300'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          editForm.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-700">
                        {editForm.isActive ? 'აქტიური' : 'დეაქტივირებული'}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                      <span className="text-blue-600 font-bold text-lg">
                        {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
                      </span>
                    </div>
                    {provider.firstName} {provider.lastName}
                  </h1>
                  <p className="text-gray-600 ml-16">{provider.email}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {!isEditing && (
              <>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  provider.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {provider.isActive ? 'აქტიური' : 'დეაქტივირებული'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  🏢 პროვაიდერი
                </span>
                <button
                  onClick={handleStartEdit}
                  disabled={isEditing || saving}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  რედაქტირება
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={handleSaveProvider}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      შენახვა...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      შენახვა
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4 mr-2" />
                  გაუქმება
                </button>
              </>
            )}
          </div>
        </div>

        {/* Provider Information */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">პროვაიდერის ინფორმაცია</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">რეგისტრაციის თარიღი</h3>
              <p className="text-lg text-gray-900">
                {provider.createdAt.toLocaleDateString('ka-GE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">ბოლო განახლება</h3>
              <p className="text-lg text-gray-900">
                {provider.updatedAt.toLocaleDateString('ka-GE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Performance Analysis Panel */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border border-blue-200">
          <h2 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
            <Activity className="w-6 h-6 mr-2" />
            🔧 PERFORMANCE ANALYSIS RESULTS
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Render Count</p>
                  <p className="text-2xl font-bold text-blue-600">{performanceData.renderCount}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Render Time</p>
                  <p className="text-2xl font-bold text-green-600">{performanceData.avgRenderTime}ms</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Memory Used</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {performanceData.memoryUsage?.used || 'N/A'}MB
                  </p>
                </div>
                <Activity className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Data Source</p>
                  <p className="text-lg font-bold text-orange-600">{performanceData.dataSource}</p>
                </div>
                <div className="text-2xl">
                  {USE_STUB_DATA ? '🔧' : '🌐'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-800">
                ✅ ISOLATION TEST: ყველა ცხრილი და სტატისტიკა გამორთულია
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-800">
                📊 React Profiler: onRender callbacks აქტიურია (იხილეთ Console)
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-800">
                💾 Memory Monitoring: ყოველ 5 render-ზე ერთხელ
              </span>
            </div>
          </div>
          
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => {
                checkMemoryUsage();
                console.log('🔍 Manual Performance Check:', getPerformanceSummary());
                console.log('🔍 Global Performance Data:', window.performanceData || []);
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Check Performance
            </button>
            
            <button
              onClick={() => {
                console.clear();
                console.log('🧹 Console cleared for fresh performance analysis');
              }}
              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Console
            </button>
            
            <button
              onClick={() => {
                const summary = getPerformanceSummary();
                const report = `
🔍 PERFORMANCE REPORT
===================
Render Count: ${summary.renderCount}
Average Render Time: ${summary.averageRenderTime}ms
Memory Usage: ${summary.memoryUsage?.used || 'N/A'}MB
Data Source: ${USE_STUB_DATA ? 'STUB DATA' : 'REAL API'}
Page Unresponsive: ${summary.averageRenderTime > 100 ? '❌ YES' : '✅ NO'}
                `;
                console.log(report);
                alert('Performance report logged to console');
              }}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </Profiler>
  );
}
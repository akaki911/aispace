import React from 'react';
import { Server, Globe, Clock, CheckCircle, AlertCircle, XCircle, ArrowRight, FileText, Code, X, Terminal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface ServiceInfo {
  name: string;
  port: number;
  status: 'running' | 'stopped' | 'error';
  uptime: string;
  url?: string;
  pid?: number;
  cpu?: number;
  memory?: number;
}

interface RouteMapping {
  route: string;
  file: string;
  method?: string;
  type: 'frontend' | 'backend' | 'api';
}

// 🔧 Port Status Interface
interface PortStatus {
  port: number;
  status: 'available' | 'in_use' | 'conflict' | 'reserved' | 'cleaning';
  service?: string;
  pid?: number;
  details?: {
    command?: string;
    startTime?: string;
    targetPort?: number;
    memoryUsage?: string;
    cpuUsage?: string;
    processPath?: string;
    listeningAddress?: string;
  };
}

interface ServicesViewProps {
  onBackToLogs: () => void;
}

// Smart API Base Detection - Fixed HTTPS Protocol
const detectAPIBase = () => {
  const env = import.meta.env.VITE_API_BASE;
  if (env) return env;

  // Fallback detection with HTTPS protocol
  const currentHost = window.location.host;
  if (currentHost.includes('replit.dev')) {
    const backendHost = currentHost.replace(':5000', ':5002').replace(':3000', ':5002');
    return `https://${backendHost}`;
  }
  return 'http://localhost:5002';
};

const API_BASE = detectAPIBase();

export const ServicesView: React.FC<ServicesViewProps> = ({ onBackToLogs }) => {
  // 🔧 State declarations first to avoid initialization issues
  const [portStatuses, setPortStatuses] = useState<PortStatus[]>([]);
  const [conflictHistory, setConflictHistory] = useState<any[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<PortStatus | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // 🇬🇪 Dynamic Service Names based on real port status
  const getDynamicServices = (): ServiceInfo[] => {
    return portStatuses.map(portStatus => ({
      name: getServiceDisplayName(portStatus.port),
      port: portStatus.port,
      status: mapPortStatusToServiceStatus(portStatus.status),
      uptime: calculateUptime(portStatus.details?.startTime),
      url: `https://bakhmaro.replit.dev:${portStatus.port}`,
      pid: portStatus.pid,
      cpu: parseFloat(portStatus.details?.cpuUsage?.replace('%', '') || '0'),
      memory: parseFloat(portStatus.details?.memoryUsage?.replace('%', '') || '0')
    }));
  };

  const getServiceDisplayName = (port: number) => {
    switch (port) {
      case 3000: return 'Frontend-Vite (დეველოპმენტი)';
      case 5000: return 'Frontend (ვებსაიტი)';
      case 5001: return 'AI Service (ხელოვნური ინტელექტი)';
      case 5002: return 'Backend (სერვერი)';
      default: return `Service (${port})`;
    }
  };

  const mapPortStatusToServiceStatus = (portStatus: PortStatus['status']): ServiceInfo['status'] => {
    switch (portStatus) {
      case 'in_use': return 'running';
      case 'available': return 'stopped';
      case 'conflict': return 'error';
      case 'cleaning': return 'error';
      default: return 'error';
    }
  };

  const calculateUptime = (startTime?: string): string => {
    if (!startTime) return 'Unknown';
    try {
      const start = new Date(startTime);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m`;
      } else {
        return `${diffMins}m`;
      }
    } catch {
      return 'Unknown';
    }
  };

  const [routeMappings, setRouteMappings] = useState<RouteMapping[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);

  // 🎯 Get services safely after state is initialized
  const services = getDynamicServices();

  // 🔍 Automatic Route Discovery
  const discoverRoutes = async () => {
    try {
      setIsLoadingRoutes(true);
      console.log('🔍 Starting automatic route discovery...');

      const routes: RouteMapping[] = [];

      // 📋 Frontend Routes Discovery (from App.tsx)
      try {
        const appResponse = await fetch(`${API_BASE}/api/files/content/src/App.tsx`);
        if (appResponse.ok) {
          const appContent = await appResponse.text();

          // Extract React routes using regex
          const routeRegex = /<Route\s+path="([^"]+)"\s+element={[^}]*<([^>\s]+)[^>]*>.*?}/g;
          let match;

          while ((match = routeRegex.exec(appContent)) !== null) {
            const [, path, component] = match;

            // Skip protected route wrappers
            if (component === 'ProtectedRoute' || component === 'Layout') continue;

            routes.push({
              route: path,
              file: `src/${component}.tsx`,
              type: 'frontend'
            });
          }

          console.log(`✅ Discovered ${routes.filter(r => r.type === 'frontend').length} frontend routes`);
        }
      } catch (error) {
        console.warn('⚠️ Error discovering frontend routes:', error);
      }

      // 🔧 Backend Routes Discovery
      try {
        const backendResponse = await fetch(`${API_BASE}/api/files/content/backend/index.js`);
        if (backendResponse.ok) {
          const backendContent = await backendResponse.text();

          // Extract Express routes
          const routeRegex = /app\.use\(['"`]([^'"`]+)['"`],\s*require\(['"`]([^'"`]+)['"`]\)/g;
          let match;

          while ((match = routeRegex.exec(backendContent)) !== null) {
            const [, basePath, filePath] = match;
            routes.push({
              route: basePath,
              file: `backend${filePath}.js`,
              type: 'backend'
            });
          }

          console.log(`✅ Discovered ${routes.filter(r => r.type === 'backend').length} backend routes`);
        }
      } catch (error) {
        console.warn('⚠️ Error discovering backend routes:', error);
      }

      // 🤖 AI Service Routes Discovery
      try {
        const aiResponse = await fetch(`${API_BASE}/api/files/content/ai-service/server.js`);
        if (aiResponse.ok) {
          const aiContent = await aiResponse.text();

          // Extract AI service routes
          const routeRegex = /app\.use\(['"`]([^'"`]+)['"`],\s*require\(['"`]([^'"`]+)['"`]\)/g;
          let match;

          while ((match = routeRegex.exec(aiContent)) !== null) {
            const [, basePath, filePath] = match;
            routes.push({
              route: basePath,
              file: `ai-service${filePath}.js`,
              type: 'api'
            });
          }

          console.log(`✅ Discovered ${routes.filter(r => r.type === 'api').length} AI service routes`);
        }
      } catch (error) {
        console.warn('⚠️ Error discovering AI service routes:', error);
      }

      // 📊 Use code index for additional route discovery
      try {
        const codeIndexResponse = await fetch(`${API_BASE}/api/files/content/ai-service/code_index.json`);
        if (codeIndexResponse.ok) {
          const codeIndexText = await codeIndexResponse.text();
          const codeIndex = JSON.parse(codeIndexText);

          // Extract routes from code index
          if (codeIndex.api_routes) {
            Object.entries(codeIndex.api_routes).forEach(([route, file]) => {
              const [method, path] = route.split(' ');
              routes.push({
                route: path,
                file: String(file),
                method: method as any,
                type: String(file).includes('ai-service') ? 'api' : 'backend'
              });
            });
          }

          console.log(`✅ Enhanced with ${Object.keys(codeIndex.api_routes || {}).length} routes from code index`);
        }
      } catch (error) {
        console.warn('⚠️ Error reading code index:', error);
      }

      // Remove duplicates and sort
      const uniqueRoutes = routes.filter((route, index, self) => 
        index === self.findIndex(r => r.route === route.route && r.type === route.type)
      );

      setRouteMappings(uniqueRoutes);
      console.log(`🎯 Final route discovery complete: ${uniqueRoutes.length} unique routes`);

    } catch (error) {
      console.error('❌ Route discovery failed:', error);
      // Fallback to static routes
      setRouteMappings([
        { route: '/', file: 'src/MainPage.tsx', type: 'frontend' },
        { route: '/admin', file: 'src/MainDashboard.tsx', type: 'frontend' },
        { route: '/api/health', file: 'backend/routes/health.js', method: 'GET', type: 'backend' }
      ]);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // Discover routes on component mount and every 30 seconds
  useEffect(() => {
    discoverRoutes();
    const interval = setInterval(discoverRoutes, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // 🔧 Port Management Functions
  const getServiceName = (port: number) => {
    switch (port) {
      case 3000: return 'Frontend-Vite';
      case 5000: return 'Frontend-Alt';
      case 5001: return 'AI-Service';
      case 5002: return 'Backend';
      default: return `Unknown Service (${port})`;
    }
  };

  const checkPortStatus = async (port: number): Promise<PortStatus> => {
    try {
      console.log(`🔍 Checking port ${port} via: ${API_BASE}/api/port-check/${port}`);
      const response = await fetch(`${API_BASE}/api/port-check/${port}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Port ${port} response:`, data);

        // Better status mapping based on actual response
        let status: 'available' | 'in_use' | 'conflict' = 'available';

        if (data.pid && data.pid > 0) {
          status = 'in_use';
        } else if (data.status === 'in_use' || data.service) {
          status = 'in_use';
        } else if (data.status === 'conflict') {
          status = 'conflict';
        }

        return {
          port,
          status,
          service: data.service || getServiceName(port),
          pid: data.pid,
          details: {
            command: data.command || data.service || (data.pid ? `PID ${data.pid}` : 'Available'),
            startTime: data.startTime || new Date().toISOString(),
            targetPort: port,
            memoryUsage: data.memoryUsage || data.memory || 'N/A',
            cpuUsage: data.cpuUsage || data.cpu || 'N/A',
            processPath: data.processPath || 'N/A',
            listeningAddress: data.listeningAddress || `0.0.0.0:${port}`
          }
        };
      } else {
        console.warn(`❌ Port ${port} check failed:`, response.status);
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(`📄 Error response:`, errorText.substring(0, 200));
      }
    } catch (error) {
      console.warn(`🚨 Port ${port} network error:`, error);
    }

    // Default to available if can't determine
    return {
      port,
      status: 'available',
      service: getServiceName(port),
      pid: undefined,
      details: {
        command: 'Status Unknown',
        startTime: new Date().toISOString(),
        targetPort: port,
        memoryUsage: 'Unknown',
        cpuUsage: 'Unknown'
      }
    };
  };

  const killPortProcess = async (port: number): Promise<boolean> => {
    try {
      console.log(`🔧 Killing process on port ${port} via: ${API_BASE}/api/port-kill/${port}`);
      const response = await fetch(`${API_BASE}/api/port-kill/${port}`, { method: 'POST' });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Port ${port} kill successful:`, result);
        return true;
      } else {
        console.warn(`❌ Port ${port} kill failed:`, response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error(`🚨 Port ${port} kill error:`, error);
      return false;
    }
  };

  const handlePortConflictRecovery = async (conflictedPorts: number[]) => {
    try {
      console.log(`🚨 კონფლიქტური ports-ების ავტო-გამოსწორება: ${conflictedPorts.join(', ')}`);

      // Enhanced cleanup with multiple methods
      for (const port of conflictedPorts) {
        console.log(`🔧 Cleaning port ${port} with enhanced methods...`);

        // Try backend port management API first
        try {
          const response = await fetch(`${API_BASE}/api/port/kill/${port}`, { 
            method: 'POST',
            credentials: 'include'
          });

          if (response.ok) {
            console.log(`✅ Port ${port} cleaned via API`);
          } else {
            console.warn(`⚠️ API cleanup failed for port ${port}, trying direct kill`);
            await killPortProcess(port);
          }
        } catch (apiError) {
          console.warn(`⚠️ API cleanup failed for port ${port}:`, apiError);
          const killed = await killPortProcess(port);
          if (killed) {
            console.log(`✅ Port ${port} cleaned via direct kill`);
          } else {
            console.warn(`❌ Failed to clean port ${port}`);
          }
        }

        // Delay between cleanups
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Verify cleanup and refresh
      console.log('🔍 Verifying port cleanup...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      checkAllServices();

      console.log('🎉 Port conflict recovery completed');
    } catch (error) {
      console.error('🚨 Auto-recovery failed:', error);
    }
  };

  const checkAllServices = () => {
    loadPortStatuses();
    discoverRoutes(); // Also refresh routes when services are reloaded
  };

  const loadPortStatuses = async () => {
    const criticalPorts = [3000, 5000, 5001, 5002];

    // Get port statuses
    const statuses = await Promise.all(
      criticalPorts.map(port => checkPortStatus(port))
    );

    // Get real process information
    try {
      const processResponse = await fetch(`${API_BASE}/api/process-list`);
      if (processResponse.ok) {
        const processData = await processResponse.json();

        // Enhance port statuses with real process info
        const enhancedStatuses = statuses.map(status => {
          const matchingProcess = processData.processes.find((p: any) => p.port === status.port);

          if (matchingProcess) {
            return {
              ...status,
              status: 'in_use' as const,
              pid: matchingProcess.pid,
              service: matchingProcess.service,
              details: {
                ...status.details,
                command: matchingProcess.command,
                cpuUsage: `${matchingProcess.cpu}%`,
                memoryUsage: `${matchingProcess.memory}%`,
                processPath: matchingProcess.command.split(' ')[0]
              }
            };
          }

          return status;
        });

        setPortStatuses(enhancedStatuses);
      } else {
        setPortStatuses(statuses);
      }
    } catch (error) {
      console.warn('⚠️ Failed to get process info:', error);
      setPortStatuses(statuses);
    }

    // Detect conflicts - Only actual conflicts, not normal in_use
    const conflicts = statuses.filter(s => s.status === 'conflict');
    if (conflicts.length > 0) {
      const conflictPorts = conflicts.map(c => c.port);
      setConflictHistory(prev => [...prev.slice(-10), {
        timestamp: new Date(),
        ports: conflictPorts,
        services: conflicts.map(c => c.service).filter(Boolean)
      }]);
      console.log(`🚨 Real conflicts detected: ${conflictPorts.join(', ')}`);
    }
  };

  // Load port statuses on mount and refresh every 5 seconds
  useEffect(() => {
    loadPortStatuses();
    const interval = setInterval(loadPortStatuses, 5000); // Check every 5 seconds for real-time updates
    return () => clearInterval(interval);
  }, []);

  // 🎯 Georgian Language Support
  const georgianStatus = {
    running: 'მუშაობს',
    stopped: 'შეჩერდა', 
    error: 'შეცდომა',
    available: 'ხელმისაწვდომი',
    in_use: 'დაკავებული',
    conflict: 'კონფლიქტი',
    cleaning: 'გასუფთავება...'
  };

  // 🔴 Conflict Click Handler
  const handleConflictClick = (portInfo: PortStatus) => {
    setSelectedConflict(portInfo);
    setShowConflictModal(true);
  };

  // 🔧 Modal Close Handler  
  const closeConflictModal = () => {
    setShowConflictModal(false);
    setSelectedConflict(null);
  };

  const getStatusIcon = (status: ServiceInfo['status'] | PortStatus['status'], isConflicted: boolean = false) => {
    // 🔴 წითელი იკონები კონფლიქტებისთვის
    if (isConflicted || status === 'conflict' || status === 'error') {
      return (
        <div 
          title="დეტალების სანახავად დააწკაპუნეთ" 
          className="cursor-pointer"
          onClick={() => console.log('ℹ️ General status icon clicked:', status)}
        >
          <AlertCircle size={16} className="text-red-500 animate-pulse" />
        </div>
      );
    }

    switch (status) {
      case 'running':
      case 'available':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'stopped':
      case 'in_use':
        return <XCircle size={16} className="text-yellow-500" />;
      case 'cleaning':
        return <Clock size={16} className="text-blue-500 animate-spin" />;
      default:
        return <XCircle size={16} className="text-gray-500" />;
    }
  };


  const getStatusBg = (status: ServiceInfo['status']) => {
    switch (status) {
      case 'running': return 'bg-green-400/10';
      case 'stopped': return 'bg-gray-400/10';
      case 'error': return 'bg-red-400/10';
      default: return 'bg-gray-400/10';
    }
  };

  const getRouteTypeIcon = (type: string) => {
    switch (type) {
      case 'frontend': return <Globe size={14} className="text-blue-500" />;
      case 'backend': return <Server size={14} className="text-green-500" />;
      case 'api': return <Code size={14} className="text-purple-500" />;
      default: return <FileText size={14} className="text-gray-500" />;
    }
  };

  const groupedRoutes = routeMappings.reduce((acc, route) => {
    if (!acc[route.type]) acc[route.type] = [];
    acc[route.type].push(route);
    return acc;
  }, {} as Record<string, RouteMapping[]>);

  // 🔴 ConflictDetails Modal Component
  const ConflictDetailsModal = () => {
    if (!showConflictModal || !selectedConflict) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              🚨 Port კონფლიქტის დეტალები
            </h3>
            <button 
              onClick={closeConflictModal}
              className="p-1 hover:bg-gray-800 rounded"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Port Info */}
            <div className="bg-gray-800/40 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                🔌 Port ინფორმაცია
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Port:</span>
                  <span className="text-white ml-2 font-mono">:{selectedConflict.port}</span>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    selectedConflict.status === 'conflict' ? 'bg-red-900/30 text-red-300' :
                    selectedConflict.status === 'in_use' ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-gray-900/30 text-gray-300'
                  }`}>
                    {georgianStatus[selectedConflict.status as keyof typeof georgianStatus] || selectedConflict.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Service:</span>
                  <span className="text-white ml-2">{selectedConflict.service}</span>
                </div>
                <div>
                  <span className="text-gray-400">PID:</span>
                  <span className="text-white ml-2 font-mono">{selectedConflict.pid || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Process Details */}
            {selectedConflict.details && (
              <div className="bg-gray-800/40 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  ⚙️ პროცესის დეტალები
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Command:</span>
                    <span className="text-white ml-2 font-mono">{selectedConflict.details.command || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Memory:</span>
                    <span className="text-white ml-2">{selectedConflict.details.memoryUsage || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">CPU:</span>
                    <span className="text-white ml-2">{selectedConflict.details.cpuUsage || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Start Time:</span>
                    <span className="text-white ml-2">{selectedConflict.details.startTime ? new Date(selectedConflict.details.startTime).toLocaleString('ka-GE') : 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-gray-800/40 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                🛠️ მოქმედებები
              </h4>
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={() => killPortProcess(selectedConflict.port)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors flex items-center gap-2"
                >
                  <Terminal size={14} />
                  პროცესის მოკვლა
                </button>
                <button 
                  onClick={() => handlePortConflictRecovery([selectedConflict.port])}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  გასუფთავება
                </button>
                <button 
                  onClick={() => loadPortStatuses()}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  🔄 შემოწმება
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Conflict Modal */}
      <ConflictDetailsModal />
      {/* Header */}
      <div className="p-3 border-b border-gray-300 dark:border-gray-600 flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center">
          🧭 Services და Route Mappings
        </h3>
        <button
          onClick={onBackToLogs}
          className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
        >
          ← Logs-ზე დაბრუნება
        </button>
      </div>

      <div className="flex-1 p-3 space-y-4 overflow-y-auto">
        {/* Port Status Panel */}
        <div className="mb-6 p-4 bg-gray-800/40 border border-gray-700/30 rounded-lg">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            🔌 Port-ების Status Dashboard
            <span className="text-xs text-gray-400">ცოცხალი მონიტორინგი</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {[
              { port: 3000, name: 'Frontend', service: 'Vite' },
              { port: 5000, name: 'Frontend-Alt', service: 'Vite' },
              { port: 5001, name: 'AI Service', service: 'Node.js' },
              { port: 5002, name: 'Backend', service: 'Express' }
            ].map(({ port, name, service }) => {
              const statusInfo = portStatuses.find(p => p.port === port);
              const status = statusInfo?.status || 'unknown';
              const statusColor =
                status === 'available' ? 'bg-green-400' :
                status === 'in_use' ? 'bg-yellow-400' :
                status === 'cleaning' ? 'bg-blue-400' : 'bg-red-400';

              return (
                <div key={port} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                      <span className="text-white text-sm font-medium">:{port}</span>
                    </div>
                    <span className="text-xs text-gray-400">{name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1">{service}</div>
                  <div 
                    className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                      status === 'available' ? 'bg-green-900/30 text-green-300 hover:bg-green-900/40' :
                      status === 'in_use' ? 'bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40' :
                      status === 'cleaning' ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/40' :
                      'bg-red-900/30 text-red-300 hover:bg-red-900/40'
                    }`}
                    onClick={() => statusInfo && handleConflictClick(statusInfo)}
                    title="დეტალების სანახავად დააწკაპუნეთ"
                  >
                    {status === 'conflict' || status === 'in_use' ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle size={10} className="animate-pulse" />
                        {georgianStatus[status as keyof typeof georgianStatus] || status}
                      </span>
                    ) : (
                      georgianStatus[status as keyof typeof georgianStatus] || status
                    )}
                  </div>
                  {statusInfo?.pid && (
                    <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                      <span>PID: {statusInfo.pid}</span>
                      <button
                        onClick={() => killPortProcess(port)}
                        className="text-red-400 hover:text-red-300"
                        title="Kill Process"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Port Conflicts History */}
          {conflictHistory.length > 0 && (
            <div className="bg-red-900/20 border border-red-400/20 rounded-lg p-3 mb-3">
              <h5 className="text-red-300 text-sm font-medium mb-2">⚠️ რეცენტ კონფლიქტები</h5>
              <div className="space-y-1">
                {conflictHistory.slice(-3).map((conflict, idx) => (
                  <div key={idx} className="text-xs text-red-200 flex items-center justify-between">
                    <span>Ports: {conflict.ports.join(', ')}</span>
                    <span className="text-gray-400">
                      {new Date(conflict.timestamp).toLocaleTimeString('ka-GE', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Port Management Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const conflictPorts = portStatuses
                  .filter(p => p.status === 'conflict' || p.status === 'in_use')
                  .map(p => p.port);
                if (conflictPorts.length > 0) {
                  handlePortConflictRecovery(conflictPorts);
                } else {
                  console.log('ℹ️ კონფლიქტური ports არ მოიძებნა');
                }
              }}
              disabled={!portStatuses.some(p => p.status === 'conflict' || p.status === 'in_use')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors flex items-center gap-1"
            >
              🔧 კონფლიქტების გამოსწორება
            </button>

            <button
              onClick={() => {
                fetch(`${API_BASE}/api/port-cleanup`, { method: 'POST' })
                  .then(() => console.log('🧹 Port cleanup initiated'))
                  .catch(error => console.error('❌ Cleanup failed:', error));
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition-colors flex items-center gap-1"
            >
              🧹 Cleanup All
            </button>
          </div>
        </div>

        {/* Services Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center">
            <Server size={12} className="mr-1 text-blue-500" />
            Running Services
          </h4>

          <div className="grid gap-3">
            {services.map((service, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border-l-4 ${getStatusBg(service.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(service.status)}
                    <span className="font-medium text-sm">{service.name}</span>
                    <span className="text-xs text-gray-500">:{service.port}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                    <Clock size={12} />
                    <span>{service.uptime}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">CPU:</span>
                    <span className="ml-1 font-mono">{service.cpu}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Memory:</span>
                    <span className="ml-1 font-mono">{service.memory}MB</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">PID:</span>
                    <span className="ml-1 font-mono">{service.pid}</span>
                  </div>
                </div>

                {service.url && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 flex items-center"
                    >
                      <Globe size={12} className="mr-1" />
                      {service.url}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Route Mappings Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center justify-between">
            <div className="flex items-center">
              <ArrowRight size={12} className="mr-1 text-green-500" />
              Route Mappings
              {isLoadingRoutes && (
                <div className="ml-2 w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                ცოცხალი: {routeMappings.length} routes
              </span>
              <button
                onClick={() => discoverRoutes()}
                disabled={isLoadingRoutes}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
                title="Route-ების განახლება"
              >
                🔄
              </button>
            </div>
          </h4>

          {Object.entries(groupedRoutes).map(([type, routes]) => (
            <div key={type} className="space-y-2">
              <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize flex items-center">
                {getRouteTypeIcon(type)}
                <span className="ml-1">{type} Routes</span>
              </h5>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
                {routes.map((mapping, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        {mapping.method && (
                          <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded mr-1">
                            {mapping.method}
                          </span>
                        )}
                        {mapping.route}
                      </span>
                      <ArrowRight size={10} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {mapping.file}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Quick Stats
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <div className="text-gray-500">Total Services</div>
              <div className="text-lg font-bold text-green-600">{services.length}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <div className="text-gray-500">Total Routes</div>
              <div className="text-lg font-bold text-blue-600">
                {isLoadingRoutes ? '...' : routeMappings.length}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <div className="text-gray-500">Running</div>
              <div className="text-lg font-bold text-green-600">
                {services.filter(s => s.status === 'running').length}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <div className="text-gray-500">Route Types</div>
              <div className="text-xs text-gray-700 dark:text-gray-300">
                <div>Frontend: {routeMappings.filter(r => r.type === 'frontend').length}</div>
                <div>Backend: {routeMappings.filter(r => r.type === 'backend').length}</div>
                <div>AI: {routeMappings.filter(r => r.type === 'api').length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
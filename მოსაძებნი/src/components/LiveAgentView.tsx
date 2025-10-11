
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Cpu, 
  Database, 
  Network, 
  Zap,
  Activity,
  Shield,
  RefreshCw,
  Play,
  Pause,
  Brain
} from 'lucide-react';

interface ThinkingStep {
  id: string;
  type: 'thinking' | 'analyzing' | 'coding' | 'testing' | 'complete';
  message: string;
  timestamp: string;
  emoji: string;
}


interface PendingChange {
  id: string;
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  files: string[];
  testResults: {
    passed: number;
    failed: number;
    coverage: number;
  };
  impactAnalysis: string;
  timestamp: string;
}

interface LiveEvent {
  timestamp: string;
  type: string;
  message: string;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
  cid?: string;
}

interface AutoUpdateKPIs {
  aiHealth: 'OK' | 'WARN' | 'ERROR';
  backendHealth: 'OK' | 'WARN' | 'ERROR';
  frontendHealth: 'OK' | 'WARN' | 'ERROR';
  queueLength: number;
  p95ResponseTime: number;
  errorRate: number;
  lastRunAt: string;
  mode: 'auto' | 'manual' | 'paused';
}

interface LiveAgentViewProps {
  kpis?: AutoUpdateKPIs;
  liveEvents?: LiveEvent[];
}

const LiveAgentView: React.FC<LiveAgentViewProps> = ({ 
  kpis: propKpis, 
  liveEvents: propLiveEvents 
}) => {
  const [agentStatus, setAgentStatus] = useState<'active' | 'thinking' | 'coding' | 'idle'>('active');
  const [thinkingProcess, setThinkingProcess] = useState<ThinkingStep[]>([]);
  const [currentTask] = useState<string>('სისტემის ანალიზი და ოპტიმიზაცია...');
  const [isAgentRunning, setIsAgentRunning] = useState(true);
  const [workTime] = useState<string>('2 საათი 34 წუთი');
  const [completedTasks] = useState<number>(12);
  const [dailyProgress] = useState<number>(75);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([
    {
      id: 'change-001',
      title: '🎨 ინტერფეისის გაუმჯობესება - მარტივი და გასაგები',
      description: 'ცოცხალი აგენტის ფანჯრის გაუმჯობესება: ახლა უფრო ადვილი იქნება გაგება AI რას აკეთებს და როგორ. მეტი ქართული ტექსტი და ნაცნობი ღილაკები.',
      riskLevel: 'low',
      files: ['src/components/LiveAgentView.tsx', 'src/index.css'],
      testResults: { passed: 15, failed: 0, coverage: 95 },
      impactAnalysis: 'მხოლოდ გარეგნული ცვლილებები - პროგრამა იგივე ფუნქციებს ასრულებს, უბრალოდ უფრო ლამაზად და გასაგებად. არაფერი გაიფუჭება.',
      timestamp: new Date().toISOString()
    },
    {
      id: 'change-002', 
      title: '🔒 უსაფრთხოების გაძლიერება - დამცავი სისტემა',
      description: 'ვამატებ უფრო ძლიერ დამცავ სისტემას, რომ ვირუსებმა ან არასასურველმა ადამიანებმა ვერ შეძლონ ფაილების ცვლილება. ეს ისეთი რამაა როგორც სახლის უფრო ძლიერი საკეტი.',
      riskLevel: 'medium',
      files: ['ai-service/middleware/authz.js'],
      testResults: { passed: 12, failed: 1, coverage: 88 },
      impactAnalysis: 'შესაძლოა იგივე პაროლი ახლა უფრო ხშირად მოგიწიოთ შეყვანა უსაფრთხოებისთვის. თუ რაიმე პრობლემა იქნება, მარტივად დავაბრუნებ ძველ რეჟიმზე.',
      timestamp: new Date().toISOString()
    },
    {
      id: 'change-003',
      title: '📊 სტატისტიკის დაზუსტება - უკეთესი ინფორმაცია',
      description: 'ახლა უფრო ზუსტად ვაჩვენებ რამდენ ხანს მუშაობს AI, რამდენი ამოცანა შეასრულა და რომელ ფაილებზე მუშაობს. ეს ისეთია როგორც თქვენი სამუშაოს დღიური ანგარიში.',
      riskLevel: 'low',
      files: ['src/components/LiveAgentView.tsx'],
      testResults: { passed: 18, failed: 0, coverage: 98 },
      impactAnalysis: 'მხოლოდ მეტი და უკეთესი ინფორმაცია აჩვენებს. არაფერს ვერ გააფუჭებს, უბრალოდ უფრო ბევრს გაიგებთ AI-ს მუშაობის შესახებ.',
      timestamp: new Date().toISOString()
    }
  ]);

  const [kpis, setKpis] = useState<AutoUpdateKPIs>(propKpis || {
    aiHealth: 'OK',
    backendHealth: 'OK',
    frontendHealth: 'OK',
    queueLength: 0,
    p95ResponseTime: 150,
    errorRate: 2.3,
    lastRunAt: new Date().toISOString(),
    mode: 'auto'
  });
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>(propLiveEvents || []);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const stepIdCounter = useRef(0);

  const generateStepId = useCallback(() => {
    stepIdCounter.current += 1;

    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
      return `step-${window.crypto.randomUUID()}`;
    }

    return `step-${Date.now()}-${stepIdCounter.current}`;
  }, []);

  const handleApproveChange = (changeId: string) => {
    setPendingChanges(prev => prev.filter(change => change.id !== changeId));
    
    const newStep: ThinkingStep = {
      id: generateStepId(),
      type: 'complete',
      message: `ცვლილება ${changeId} დამტკიცდა და გამოიყენება...`,
      timestamp: new Date().toLocaleTimeString('ka-GE'),
      emoji: '✅'
    };
    
    setThinkingProcess(prev => [newStep, ...prev]);
    console.log(`✅ Change ${changeId} approved by user`);
  };

  const handleRejectChange = (changeId: string, reason?: string) => {
    setPendingChanges(prev => prev.filter(change => change.id !== changeId));
    
    const newStep: ThinkingStep = {
      id: generateStepId(),
      type: 'thinking',
      message: `ცვლილება ${changeId} უარყვებულია: ${reason || 'მომხმარებლის გადაწყვეტილება'}`,
      timestamp: new Date().toLocaleTimeString('ka-GE'),
      emoji: '❌'
    };
    
    setThinkingProcess(prev => [newStep, ...prev]);
    console.log(`❌ Change ${changeId} rejected:`, reason);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400 bg-green-900/20';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20';
      case 'high': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  // Connect to real SSE stream with enhanced error handling
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    
    const connectSSE = () => {
      try {
        console.log('🔗 [LiveAgent] Setting up SSE connection...');
        setConnectionStatus('connecting');

        const eventSource = new EventSource('/api/ai/autoimprove/monitor/stream');

        eventSource.onopen = () => {
          console.log('✅ [LiveAgent] SSE connection established');
          setConnectionStatus('connected');
          retryCount = 0; // Reset retry count on successful connection
        };

        eventSource.onmessage = (event) => {
          try {
            const eventData: LiveEvent = JSON.parse(event.data);
            console.log('📦 [LiveAgent] Received event:', eventData);

            setLiveEvents(prev => [eventData, ...prev.slice(0, 49)]);

            // Update thinking process based on real events
            const newStep: ThinkingStep = {
              id: generateStepId(),
              type: eventData.type === 'CheckStarted' ? 'analyzing' :
                    eventData.type === 'ProposalsPushed' ? 'coding' :
                    eventData.type === 'TestsRunning' ? 'testing' : 'complete',
              message: eventData.message,
              timestamp: new Date(eventData.timestamp).toLocaleTimeString('ka-GE'),
              emoji: eventData.type === 'CheckStarted' ? '🔍' :
                     eventData.type === 'ProposalsPushed' ? '💻' :
                     eventData.type === 'TestsRunning' ? '🧪' : '✅'
            };

            setThinkingProcess(prev => [newStep, ...prev.slice(0, 10)]);
            
            // Update agent status based on event
            if (eventData.type === 'CheckStarted') {
              setAgentStatus('thinking');
            } else if (eventData.type === 'ProposalsPushed') {
              setAgentStatus('coding');
            } else {
              setAgentStatus('active');
            }
          } catch (error) {
            console.error('❌ [LiveAgent] Failed to parse SSE event:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('❌ [LiveAgent] SSE connection error:', error);
          setConnectionStatus('disconnected');
          eventSource.close();

          // Retry with exponential backoff, but limited attempts
          if (retryCount < maxRetries) {
            const retryDelay = Math.min(5000 * Math.pow(2, retryCount), 30000);
            console.log(`🔄 [LiveAgent] Retrying SSE connection in ${retryDelay/1000}s (attempt ${retryCount + 1}/${maxRetries})`);
            retryCount++;
            setTimeout(connectSSE, retryDelay);
          } else {
            console.warn('⚠️ [LiveAgent] Max SSE retry attempts reached, falling back to simulation');
            setConnectionStatus('disconnected');
          }
        };

        eventSourceRef.current = eventSource;
      } catch (error) {
        console.error('❌ [LiveAgent] Failed to setup SSE:', error);
        setConnectionStatus('disconnected');
      }
    };

    // Only connect if not rate limited
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Fetch KPIs periodically with rate limit handling
  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const response = await fetch('/api/ai/autoimprove/monitor/status', {
          credentials: 'include'
        });

        if (response.status === 429) {
          console.warn('⚠️ [LiveAgent] Rate limited, using cached data');
          setConnectionStatus('disconnected');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setKpis(data.kpis || kpis);
          setConnectionStatus('connected');
          console.log('📊 [LiveAgent] KPIs updated:', data.kpis);
        }
      } catch (error) {
        console.error('❌ [LiveAgent] Failed to fetch KPIs:', error);
        setConnectionStatus('disconnected');
      }
    };

    fetchKPIs();
    const interval = setInterval(fetchKPIs, 30000); // Reduced frequency to 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Enhanced simulation when real data is unavailable
  useEffect(() => {
    if (!isAgentRunning) return;
    
    // Only simulate when disconnected or not getting real data
    if (connectionStatus === 'connected' && liveEvents.length > 0) return;

    const interval = setInterval(() => {
      const thinkingSteps = [
        {
          type: 'analyzing' as const,
          message: 'ვანალიზებ თქვენი პროექტის კოდს და ვეძებ გასაუმჯობესებელ ადგილებს... 🔍',
          emoji: '🔍'
        },
        {
          type: 'thinking' as const,
          message: 'ვფიქრობ რომელი ცვლილება იქნება ყველაზე სასარგებლო და უსაფრთხო... 🤔',
          emoji: '🧠'
        },
        {
          type: 'coding' as const,
          message: 'ვქმნი ოპტიმიზებულ კოდს რომელიც გაიუმჯობესებს წარმადობას... 💻',
          emoji: '💻'
        },
        {
          type: 'testing' as const,
          message: 'ვამოწმებ ახალ კოდს რომ დავრწმუნდე ყველაფერი სწორად მუშაობს... 🧪',
          emoji: '🧪'
        }
      ];

      const randomStep = thinkingSteps[Math.floor(Math.random() * thinkingSteps.length)];
      const newStep: ThinkingStep = {
        id: generateStepId(),
        ...randomStep,
        timestamp: new Date().toLocaleTimeString('ka-GE')
      };

      setThinkingProcess(prev => [newStep, ...prev.slice(0, 10)]);
      // Map type to valid agentStatus
      const statusMap: Record<string, 'active' | 'thinking' | 'coding' | 'idle'> = {
        'thinking': 'thinking',
        'coding': 'coding', 
        'testing': 'coding',
        'analyzing': 'thinking'
      };
      setAgentStatus(statusMap[randomStep.type] || 'thinking');

      // Update KPIs with realistic simulation
      if (connectionStatus === 'disconnected') {
        setKpis(prev => ({
          ...prev,
          queueLength: Math.floor(Math.random() * 5),
          p95ResponseTime: 150 + Math.floor(Math.random() * 100),
          errorRate: Math.random() * 3,
          lastRunAt: new Date().toISOString()
        }));
      }
    }, 4000); // Slightly slower simulation

    return () => clearInterval(interval);
  }, [isAgentRunning, connectionStatus, liveEvents.length]);

  const getAgentStatusIcon = () => {
    switch (agentStatus) {
      case 'active': return '🟢';
      case 'thinking': return '🧠';
      case 'coding': return '💻';
      default: return '⏸️';
    }
  };

  const getAgentStatusText = () => {
    switch (agentStatus) {
      case 'active': return 'აქტიური';
      case 'thinking': return 'ფიქრის პროცესში';
      case 'coding': return 'კოდის დაწერაში';
      default: return 'უმოქმედო';
    }
  };

  const getHealthColor = (health: 'OK' | 'WARN' | 'ERROR') => {
    switch (health) {
      case 'OK': return 'text-green-400 bg-green-900/20 border-green-600';
      case 'WARN': return 'text-yellow-400 bg-yellow-900/20 border-yellow-600';
      case 'ERROR': return 'text-red-400 bg-red-900/20 border-red-600';
    }
  };

  const getHealthIcon = (health: 'OK' | 'WARN' | 'ERROR') => {
    switch (health) {
      case 'OK': return <CheckCircle className="w-4 h-4" />;
      case 'WARN': return <AlertTriangle className="w-4 h-4" />;
      case 'ERROR': return <XCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 text-white h-full overflow-hidden">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-gray-800/90 to-gray-700/90 backdrop-blur-sm border-b border-gray-700/50 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Eye className="w-8 h-8 text-blue-400" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                ცოცხალი AI აგენტი
              </h2>
              <p className="text-sm text-gray-400">ავტომატური სისტემის გაუმჯობესება</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-gray-800/50 rounded-lg px-3 py-2">
              <div className="text-xs text-gray-400 mb-1">Connection</div>
              <div className={`flex items-center gap-2 text-sm font-medium ${
                connectionStatus === 'connected' ? 'text-green-400' : 
                connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {connectionStatus === 'connected' ? <CheckCircle className="w-4 h-4" /> :
                 connectionStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                 <XCircle className="w-4 h-4" />}
                {connectionStatus === 'connected' ? 'დაკავშირებულია' : 
                 connectionStatus === 'connecting' ? 'იკავშირება...' : 'გათიშულია'}
              </div>
            </div>

            <button
              onClick={() => setIsAgentRunning(!isAgentRunning)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                isAgentRunning 
                  ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-lg' 
                  : 'bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-700 hover:to-gray-600 shadow-lg'
              }`}
            >
              {isAgentRunning ? <Pause className="w-4 h-4 inline mr-2" /> : <Play className="w-4 h-4 inline mr-2" />}
              {isAgentRunning ? 'გაჩერება' : 'გაშვება'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-full">
        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* AI Status Card */}
          <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-6xl animate-pulse">{getAgentStatusIcon()}</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">{getAgentStatusText()}</h3>
                <p className="text-gray-300">{currentTask}</p>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-400">მუშაობის დრო: {workTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">შესრულებული: {completedTasks}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">დღიური პროგრესი</span>
                <span className="text-blue-400 font-medium">{dailyProgress}%</span>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${dailyProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Real-time KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                <div className="text-xs text-gray-400 mb-1">Queue</div>
                <div className="text-lg font-bold text-blue-400">{kpis.queueLength}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                <div className="text-xs text-gray-400 mb-1">Response</div>
                <div className="text-lg font-bold text-green-400">{kpis.p95ResponseTime}ms</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                <div className="text-xs text-gray-400 mb-1">Errors</div>
                <div className="text-lg font-bold text-red-400">{kpis.errorRate}%</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                <div className="text-xs text-gray-400 mb-1">Mode</div>
                <div className="text-lg font-bold text-purple-400 capitalize">{kpis.mode}</div>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              სისტემის ჯანმრთელობა
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border transition-all duration-300 ${getHealthColor(kpis.aiHealth)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    AI Service
                  </span>
                  {getHealthIcon(kpis.aiHealth)}
                </div>
                <div className="text-xs opacity-75">{kpis.aiHealth}</div>
              </div>

              <div className={`p-4 rounded-xl border transition-all duration-300 ${getHealthColor(kpis.backendHealth)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Backend
                  </span>
                  {getHealthIcon(kpis.backendHealth)}
                </div>
                <div className="text-xs opacity-75">{kpis.backendHealth}</div>
              </div>

              <div className={`p-4 rounded-xl border transition-all duration-300 ${getHealthColor(kpis.frontendHealth)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    Frontend
                  </span>
                  {getHealthIcon(kpis.frontendHealth)}
                </div>
                <div className="text-xs opacity-75">{kpis.frontendHealth}</div>
              </div>
            </div>
          </div>

          {/* Pending Changes */}
          {pendingChanges.length > 0 && (
            <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                მომლოდინე ცვლილებები ({pendingChanges.length})
              </h3>
              
              <div className="space-y-4">
                {pendingChanges.map((change) => (
                  <div key={change.id} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white mb-2">{change.title}</h4>
                        <p className="text-sm text-gray-300 mb-3">{change.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs">
                          <span className={`px-2 py-1 rounded-full ${getRiskColor(change.riskLevel)}`}>
                            {change.riskLevel.toUpperCase()} RISK
                          </span>
                          <span className="text-gray-400">
                            ტესტები: {change.testResults.passed}✅ {change.testResults.failed}❌
                          </span>
                          <span className="text-gray-400">
                            ფაილები: {change.files.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                      <div className="text-xs text-gray-400 mb-1">გავლენის ანალიზი:</div>
                      <div className="text-sm text-gray-300">{change.impactAnalysis}</div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveChange(change.id)}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-lg transition-all duration-300 text-sm font-medium shadow-lg"
                      >
                        ✅ დამტკიცება
                      </button>
                      <button
                        onClick={() => handleRejectChange(change.id, 'მომხმარებლის გადაწყვეტილება')}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-lg transition-all duration-300 text-sm font-medium shadow-lg"
                      >
                        ❌ უარყოფა
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Thinking Process Sidebar */}
        <div className="w-80 bg-gradient-to-b from-gray-800/90 to-gray-900/90 backdrop-blur-sm border-l border-gray-700/50 flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-purple-400" />
              ცოცხალი ფიქრები
            </h3>
            <div className="text-sm text-gray-400">
              {liveEvents.length > 0 ? `${liveEvents.length} ივენთი` : 'მიმდინარე აქტივობა'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {thinkingProcess.length === 0 && liveEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">AI ელოდება ახალ ამოცანებს...</p>
              </div>
            ) : (
              <>
                {thinkingProcess.map((step, index) => (
                  <div key={step.id} className={`bg-gray-700/50 rounded-lg p-3 animate-slideInUp border border-gray-600/30 ${index === 0 ? 'ring-2 ring-blue-500/50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0 mt-1">{step.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white mb-1 capitalize">
                          {step.type}
                        </div>
                        <p className="text-xs text-gray-300 mb-2 leading-relaxed">{step.message}</p>
                        <div className="text-xs text-gray-500">{step.timestamp}</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {liveEvents.slice(0, 5).map((event, index) => (
                  <div key={`${event.cid}-${index}`} className="bg-gray-700/30 rounded-lg p-3 animate-fadeInUp border border-blue-500/30">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-blue-400">{event.type}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(event.timestamp).toLocaleTimeString('ka-GE')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2">{event.message}</p>
                    {event.risk && (
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        event.risk === 'LOW' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                        event.risk === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' :
                        'bg-red-900/50 text-red-300 border border-red-700'
                      }`}>
                        {event.risk} RISK
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveAgentView;

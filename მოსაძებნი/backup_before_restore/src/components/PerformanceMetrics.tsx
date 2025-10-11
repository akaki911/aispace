import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Clock, Zap, Target, Activity,
  Brain, Database, Info, Maximize2, Minimize2, RefreshCw,
  Star, Trophy, TrendingDown
} from 'lucide-react';

// ===== INTERFACES =====
export interface PerformanceMetrics {
  responseTime: number;
  tokenEfficiency: number;
  accuracyScore: number;
  userSatisfaction: number;
  memoryUsage: number;
  cacheHitRate: number;
  sessionDuration: number;
  messageQuality: number;
  contextRelevance: number;
  georgianLanguageScore: number;
}

interface PerformanceMetricsProps {
  currentMetrics: PerformanceMetrics;
  metricsHistory: PerformanceMetrics[];
  telemetry: {
    tokenUsage: { prompt: number; completion: number; total: number };
    responseLatency: number;
    successRate: number;
    modelEfficiency: number;
    intentClassification: string;
    contextSize: number;
    memoryCacheHits: number;
  };
  isRealTime?: boolean;
}

export default function PerformanceMetrics({
  currentMetrics,
  metricsHistory,
  telemetry,
  isRealTime = true
}: PerformanceMetricsProps) {
  // ===== LOCAL STATE =====
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // ===== COMPUTED VALUES =====
  const getMetricTrend = (key: keyof PerformanceMetrics): 'up' | 'down' | 'stable' => {
    if (metricsHistory.length < 2) return 'stable';
    
    const recent = metricsHistory.slice(-5).map(m => m[key]);
    const avg1 = recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recent.length / 2);
    const avg2 = recent.slice(Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(recent.length / 2);
    
    if (avg2 > avg1 + 5) return 'up';
    if (avg2 < avg1 - 5) return 'down';
    return 'stable';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number): string => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20 border-green-200';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200';
    if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 border-orange-200';
    return 'bg-red-100 dark:bg-red-900/20 border-red-200';
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ===== RENDER HELPERS =====
  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    format = 'number',
    description,
    trend,
    colorClass
  }: {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    format?: 'number' | 'percentage' | 'time' | 'bytes';
    description?: string;
    trend?: 'up' | 'down' | 'stable';
    colorClass?: string;
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'percentage':
          return `${Math.round(value)}%`;
        case 'time':
          return formatDuration(value);
        case 'bytes':
          return formatBytes(value);
        default:
          return Math.round(value * 100) / 100;
      }
    };

    return (
      <div className={`
        p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer
        ${colorClass || getScoreBg(value)}
        ${selectedMetric === title ? 'ring-2 ring-blue-500' : ''}
      `}
      onClick={() => setSelectedMetric(selectedMetric === title ? null : title)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${colorClass ? 'text-current' : getScoreColor(value)}`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {title}
            </span>
          </div>
          
          {trend && (
            <div className="flex items-center gap-1">
              {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
              {trend === 'stable' && <div className="w-3 h-3 rounded-full bg-gray-400" />}
            </div>
          )}
        </div>
        
        <div className={`text-2xl font-bold ${colorClass ? 'text-current' : getScoreColor(value)}`}>
          {formatValue()}
        </div>
        
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
    );
  };

  const ProgressBar = ({ value, max = 100, label, color = 'blue' }: {
    value: number;
    max?: number;
    label?: string;
    color?: 'blue' | 'green' | 'yellow' | 'red';
  }) => {
    const percentage = Math.min((value / max) * 100, 100);
    
    return (
      <div className="w-full">
        {label && (
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>{label}</span>
            <span>{Math.round(value)}/{max}</span>
          </div>
        )}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 bg-${color}-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !isRealTime) return;
    
    const interval = setInterval(() => {
      // This would trigger a refresh in the parent component
      // For now, we'll just force a re-render
      setSelectedMetric(prev => prev);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, isRealTime]);

  // ===== MAIN RENDER =====
  return (
    <div className={`w-full mx-auto transition-all duration-300 ${expanded ? 'max-w-7xl' : 'max-w-4xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Performance Analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              რეალურ დროში მეტრიკების მონიტორინგი
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Selector */}
          <div className="flex border rounded-lg overflow-hidden">
            {(['overview', 'detailed', 'trends'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs ${
                  viewMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {mode === 'overview' ? 'მიმოხილვა' : mode === 'detailed' ? 'დეტალური' : 'ტრენდები'}
              </button>
            ))}
          </div>
          
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-600 dark:bg-green-900/20' 
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
            }`}
            title={autoRefresh ? 'ავტო განახლება ჩართულია' : 'ავტო განახლება გამორთულია'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Overview Mode */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Response Time"
              value={currentMetrics.responseTime}
              icon={Clock}
              format="time"
              description="საშუალო პასუხის ხანგრძლივობა"
              trend={getMetricTrend('responseTime')}
            />
            
            <MetricCard
              title="Accuracy Score"
              value={currentMetrics.accuracyScore}
              icon={Target}
              format="percentage"
              description="პასუხის სიზუსტე"
              trend={getMetricTrend('accuracyScore')}
            />
            
            <MetricCard
              title="User Satisfaction"
              value={currentMetrics.userSatisfaction}
              icon={Star}
              format="percentage"
              description="მომხმარებლის კმაყოფილება"
              trend={getMetricTrend('userSatisfaction')}
            />
            
            <MetricCard
              title="Token Efficiency"
              value={currentMetrics.tokenEfficiency * 100}
              icon={Zap}
              format="percentage"
              description="Token-ების ეფექტურობა"
              trend={getMetricTrend('tokenEfficiency')}
            />
            
            <MetricCard
              title="ქართული Score"
              value={currentMetrics.georgianLanguageScore}
              icon={Brain}
              format="percentage"
              description="ქართული ენის მხარდაჭერა"
              trend={getMetricTrend('georgianLanguageScore')}
            />
          </div>

          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Health */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                სისტემის მდგომარეობა
              </h3>
              
              <div className="space-y-4">
                <ProgressBar 
                  value={telemetry.successRate} 
                  label="Success Rate" 
                  color="green" 
                />
                <ProgressBar 
                  value={telemetry.modelEfficiency} 
                  label="Model Efficiency" 
                  color="blue" 
                />
                <ProgressBar 
                  value={currentMetrics.cacheHitRate} 
                  label="Cache Hit Rate" 
                  color="blue" 
                />
                <ProgressBar 
                  value={100 - currentMetrics.memoryUsage} 
                  label="Available Memory" 
                  color="yellow" 
                />
              </div>
            </div>

            {/* Session Statistics */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                სესიის სტატისტიკა
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {telemetry.tokenUsage.total.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">სულ Tokens</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatDuration(currentMetrics.sessionDuration)}
                  </div>
                  <div className="text-xs text-gray-500">სესიის ხანგრძლივობა</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {telemetry.contextSize}
                  </div>
                  <div className="text-xs text-gray-500">კონტექსტი Files</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {telemetry.memoryCacheHits}
                  </div>
                  <div className="text-xs text-gray-500">Memory Hits</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Mode */}
      {viewMode === 'detailed' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Message Quality"
              value={currentMetrics.messageQuality}
              icon={Trophy}
              format="percentage"
              description="შეტყობინების ხარისხი"
              trend={getMetricTrend('messageQuality')}
            />
            
            <MetricCard
              title="Context Relevance"
              value={currentMetrics.contextRelevance}
              icon={Brain}
              format="percentage"
              description="კონტექსტის შესაბამისობა"
              trend={getMetricTrend('contextRelevance')}
            />
            
            <MetricCard
              title="Memory Usage"
              value={currentMetrics.memoryUsage}
              icon={Database}
              format="percentage"
              description="მეხსიერების გამოყენება"
              trend={getMetricTrend('memoryUsage')}
            />
          </div>

          {/* Token Usage Breakdown */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Token გამოყენების ანალიზი
            </h3>
            
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {telemetry.tokenUsage.prompt.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Prompt Tokens</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="h-2 rounded-full bg-blue-500"
                    style={{ 
                      width: `${(telemetry.tokenUsage.prompt / telemetry.tokenUsage.total) * 100}%` 
                    }}
                  />
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {telemetry.tokenUsage.completion.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Completion Tokens</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="h-2 rounded-full bg-green-500"
                    style={{ 
                      width: `${(telemetry.tokenUsage.completion / telemetry.tokenUsage.total) * 100}%` 
                    }}
                  />
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {((telemetry.tokenUsage.completion / telemetry.tokenUsage.prompt) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Efficiency Ratio</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="h-2 rounded-full bg-purple-500"
                    style={{ 
                      width: `${Math.min(((telemetry.tokenUsage.completion / telemetry.tokenUsage.prompt) * 50), 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trends Mode */}
      {viewMode === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Performance ტრენდები
            </h3>
            
            {metricsHistory.length < 3 ? (
              <div className="text-center py-8 text-gray-500">
                <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>არასაკმარისი მონაცემები ტრენდების ჩვენებისთვის</p>
                <p className="text-xs">საჭიროა მინიმუმ 3 მეტრიკის ჩანაწერი</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Response Time Trend */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Response Time Trend</span>
                  </div>
                  <div className="h-20 flex items-end space-x-1">
                    {metricsHistory.slice(-10).map((metric, index) => (
                      <div
                        key={index}
                        className="bg-blue-500 rounded-t flex-1 min-h-1"
                        style={{
                          height: `${Math.max((metric.responseTime / 2000) * 100, 5)}%`
                        }}
                        title={`${formatDuration(metric.responseTime)}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Accuracy Trend */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-green-500" />
                    <span className="font-medium">Accuracy Score Trend</span>
                  </div>
                  <div className="h-20 flex items-end space-x-1">
                    {metricsHistory.slice(-10).map((metric, index) => (
                      <div
                        key={index}
                        className="bg-green-500 rounded-t flex-1 min-h-1"
                        style={{
                          height: `${Math.max(metric.accuracyScore, 5)}%`
                        }}
                        title={`${Math.round(metric.accuracyScore)}%`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-time Status */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className={`w-2 h-2 rounded-full ${isRealTime ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {isRealTime ? 'რეალურ დროში განახლება' : 'სტატიკური მონაცემები'}
        </div>
        
        <div className="text-xs text-gray-500">
          ბოლო განახლება: {new Date().toLocaleTimeString('ka-GE')}
        </div>
      </div>
    </div>
  );
}
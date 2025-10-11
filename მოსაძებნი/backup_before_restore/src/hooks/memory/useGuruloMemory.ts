
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMemorySync } from './useMemorySync';
import { GuruloInteraction, GuruloContext, GuruloPreferences, GuruloFact } from '../../types/aimemory';

// 🌐 Real-time WebSocket Events Interface
interface GuruloWebSocketEvents {
  'memory:updated': GuruloMemoryUpdate;
  'chat:message': GuruloFormattedMessage;
  'context:changed': ProjectContextUpdate;
  'facts:discovered': NewFactEvent;
}

interface GuruloMemoryUpdate {
  type: 'interaction' | 'context' | 'fact' | 'preference';
  data: any;
  timestamp: number;
  userId: string;
}

interface GuruloFormattedMessage {
  id: string;
  content: string;
  formatting: GeorgianFormatting;
  memoryIntegrated: boolean;
}

interface ProjectContextUpdate {
  projectName: string;
  files: string[];
  currentTask: string;
}

interface NewFactEvent {
  category: string;
  fact: string;
  confidence: number;
  source: string;
}

interface GeorgianFormatting {
  headers: boolean;
  emojis: boolean;
  checkpoints: boolean;
  structured: boolean;
}

interface GuruloMemoryHook {
  // მეხსიერების მონაცემები
  interactions: GuruloInteraction[];
  context: GuruloContext[];
  preferences: GuruloPreferences;
  facts: GuruloFact[];
  
  // ფუნქციები
  rememberInteraction: (query: string, response: string, context?: string) => void;
  updateContext: (projectName: string, currentTask: string, workingFiles?: string[]) => void;
  rememberFact: (category: string, fact: string, confidence?: number, source?: string) => void;
  updatePreferences: (newPreferences: Partial<GuruloPreferences>) => void;
  getRecentInteractions: (limit?: number) => GuruloInteraction[];
  getFactsByCategory: (category: string) => GuruloFact[];
  
  // 📊 გაუმჯობესებული სტატისტიკა
  getMemoryStats: () => {
    totalInteractions: number;
    totalFacts: number;
    contextEntries: number;
    lastInteraction: number | null;
    memoryAccuracy: number;
    dailyInteractions: number;
    topCategories: string[];
    memoryGrowthRate: number;
    contextSwitches: number;
  };
  
  // 🌐 Real-time ფუნქციები  
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  getWebSocketStatus: () => 'connected' | 'disconnected' | 'connecting';
  
  // 🎯 Context-aware ფუნქციები
  getSmartSuggestions: () => string[];
  getContextualFacts: (currentContext: string) => GuruloFact[];
  analyzeInteractionPatterns: () => {
    commonQueries: string[];
    peakHours: number[];
    averageResponseLength: number;
  };
}

/**
 * გურულოს მეხსიერების მართვის Hook
 * უზრუნველყოფს გურულო-სპეციფიკური მეხსიერების ოპერაციებს
 */
export const useGuruloMemory = (): GuruloMemoryHook => {
  const { data, setData } = useMemorySync();

  // ინტერაქციის დამახსოვრება
  const rememberInteraction = useCallback((query: string, response: string, context: string = '') => {
    const interaction: GuruloInteraction = {
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      response,
      context,
      timestamp: Date.now()
    };

    setData(prev => ({
      ...prev,
      guruloInteractions: [...prev.guruloInteractions, interaction].slice(-50) // უახლესი 50
    }));

    console.log('🧠 [Gurulo Memory] ინტერაქცია შენახულია:', query.substring(0, 30) + '...');
  }, [setData]);

  // კონტექსტის განახლება
  const updateContext = useCallback((projectName: string, currentTask: string, workingFiles: string[] = []) => {
    const contextEntry: GuruloContext = {
      id: `context_${Date.now()}`,
      projectName,
      currentTask,
      workingFiles,
      lastActivity: new Date().toISOString(),
      timestamp: Date.now()
    };

    setData(prev => ({
      ...prev,
      guruloContext: [...prev.guruloContext, contextEntry].slice(-10) // უახლესი 10
    }));

    console.log('🎯 [Gurulo Memory] კონტექსტი განახლდა:', projectName, currentTask);
  }, [setData]);

  // ფაქტის დამახსოვრება
  const rememberFact = useCallback((
    category: string, 
    fact: string, 
    confidence: number = 0.8, 
    source: string = 'gurulo_inferred'
  ) => {
    const factEntry: GuruloFact = {
      id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: category as any,
      fact,
      confidence,
      timestamp: Date.now(),
      source: source as any
    };

    setData(prev => ({
      ...prev,
      guruloFacts: [...prev.guruloFacts, factEntry].slice(-100) // უახლესი 100
    }));

    console.log('💡 [Gurulo Memory] ფაქტი შენახულია:', fact.substring(0, 30) + '...');
  }, [setData]);

  // პრეფერენსების განახლება
  const updatePreferences = useCallback((newPreferences: Partial<GuruloPreferences>) => {
    setData(prev => ({
      ...prev,
      guruloPreferences: {
        ...prev.guruloPreferences,
        ...newPreferences
      }
    }));

    console.log('⚙️ [Gurulo Memory] პრეფერენსები განახლდა:', newPreferences);
  }, [setData]);

  // უახლესი ინტერაქციების მიღება
  const getRecentInteractions = useCallback((limit: number = 5) => {
    return data.guruloInteractions.slice(-limit).reverse();
  }, [data.guruloInteractions]);

  // ფაქტები კატეგორიის მიხედვით
  const getFactsByCategory = useCallback((category: string) => {
    return data.guruloFacts.filter(fact => fact.category === category);
  }, [data.guruloFacts]);

  // 🌐 Real-time WebSocket connection state
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  
  // 📊 გაუმჯობესებული მეხსიერების სტატისტიკა
  const getMemoryStats = useCallback(() => {
    const lastInteraction = data.guruloInteractions.length > 0
      ? data.guruloInteractions[data.guruloInteractions.length - 1].timestamp
      : null;

    // Daily interactions (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const dailyInteractions = data.guruloInteractions.filter(i => i.timestamp > oneDayAgo).length;
    
    // Memory accuracy calculation
    const totalFacts = data.guruloFacts.length;
    const highConfidenceFacts = data.guruloFacts.filter(f => f.confidence > 0.8).length;
    const memoryAccuracy = totalFacts > 0 ? (highConfidenceFacts / totalFacts) * 100 : 100;
    
    // Top categories
    const categoryCount: { [key: string]: number } = {};
    data.guruloFacts.forEach(fact => {
      categoryCount[fact.category] = (categoryCount[fact.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);
    
    // Memory growth rate (interactions per hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentInteractions = data.guruloInteractions.filter(i => i.timestamp > oneHourAgo).length;
    const memoryGrowthRate = recentInteractions;
    
    // Context switches (how often working context changes)
    const contextSwitches = data.guruloContext.length;

    return {
      totalInteractions: data.guruloInteractions.length,
      totalFacts: data.guruloFacts.length,
      contextEntries: data.guruloContext.length,
      lastInteraction,
      memoryAccuracy: Math.round(memoryAccuracy),
      dailyInteractions,
      topCategories,
      memoryGrowthRate,
      contextSwitches
    };
  }, [data]);
  
  // 🌐 WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setWsStatus('connecting');
    try {
      // Connect to backend WebSocket for real-time updates
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/gurulo/ws`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setWsStatus('connected');
        console.log('🌐 [Gurulo Memory] WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ [Gurulo Memory] WebSocket message parse error:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        setWsStatus('disconnected');
        console.log('❌ [Gurulo Memory] WebSocket disconnected');
      };
      
    } catch (error) {
      setWsStatus('disconnected');
      console.error('❌ [Gurulo Memory] WebSocket connection failed:', error);
    }
  }, []);
  
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('disconnected');
  }, []);
  
  const getWebSocketStatus = useCallback(() => wsStatus, [wsStatus]);
  
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'memory:updated':
        // Refresh memory data from server
        console.log('🔄 [Gurulo Memory] Memory updated from server');
        break;
      case 'context:changed':
        // Update project context
        if (message.data) {
          updateContext(message.data.projectName, message.data.currentTask, message.data.files);
        }
        break;
      case 'facts:discovered':
        // Add new fact from server
        if (message.data) {
          rememberFact(message.data.category, message.data.fact, message.data.confidence, 'server_discovery');
        }
        break;
      case 'chat:message':
        // Handle real-time formatted chat messages
        if (message.data) {
          console.log('💬 [Gurulo Memory] Chat message received:', message.data.id);
        }
        break;
    }
  }, [updateContext, rememberFact]);
  
  // 🎯 Context-aware functionality
  const getSmartSuggestions = useCallback(() => {
    const recentInteractions = getRecentInteractions(10);
    const suggestions: string[] = [];
    
    // Extract common patterns from recent queries
    const queryWords = recentInteractions.flatMap(i => 
      i.query.toLowerCase().split(' ').filter(w => w.length > 3)
    );
    
    // Count word frequency
    const wordCount: { [key: string]: number } = {};
    queryWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Generate suggestions based on frequent patterns
    Object.entries(wordCount)
      .filter(([, count]) => count >= 2)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([word]) => {
        suggestions.push(`${word}-ის შესახებ მეტი ინფორმაცია`);
      });
    
    return suggestions.length > 0 ? suggestions : [
      'კოდის ანალიზი',
      'პრობლემის მოგვარება',
      'ფუნქციონალი მახასიათებლები'
    ];
  }, [getRecentInteractions]);
  
  const getContextualFacts = useCallback((currentContext: string) => {
    // Find facts relevant to current context
    return data.guruloFacts.filter(fact => 
      fact.fact.toLowerCase().includes(currentContext.toLowerCase()) ||
      currentContext.toLowerCase().includes(fact.category.toLowerCase())
    ).sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }, [data.guruloFacts]);
  
  const analyzeInteractionPatterns = useCallback(() => {
    const interactions = data.guruloInteractions;
    
    // Common queries (most frequent)
    const queryCount: { [key: string]: number } = {};
    interactions.forEach(i => {
      const firstWords = i.query.split(' ').slice(0, 3).join(' ');
      queryCount[firstWords] = (queryCount[firstWords] || 0) + 1;
    });
    
    const commonQueries = Object.entries(queryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([query]) => query);
    
    // Peak hours analysis
    const hourCount: { [key: number]: number } = {};
    interactions.forEach(i => {
      const hour = new Date(i.timestamp).getHours();
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    });
    
    const peakHours = Object.entries(hourCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    // Average response length
    const totalLength = interactions.reduce((sum, i) => sum + i.response.length, 0);
    const averageResponseLength = interactions.length > 0 ? Math.round(totalLength / interactions.length) : 0;
    
    return {
      commonQueries,
      peakHours,
      averageResponseLength
    };
  }, [data.guruloInteractions]);
  
  // Auto-connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [connectWebSocket, disconnectWebSocket]);

  return {
    // მეხსიერების მონაცემები
    interactions: data.guruloInteractions || [],
    context: data.guruloContext || [],
    preferences: data.guruloPreferences || {
      responseStyle: 'detailed',
      language: 'ka',
      codeCommentStyle: 'georgian',
      explanationLevel: 'intermediate'
    },
    facts: data.guruloFacts || [],
    
    // ფუნქციები
    rememberInteraction,
    updateContext,
    rememberFact,
    updatePreferences,
    getRecentInteractions,
    getFactsByCategory,
    getMemoryStats,
    
    // 🌐 Real-time ფუნქციები  
    connectWebSocket,
    disconnectWebSocket,
    getWebSocketStatus,
    
    // 🎯 Context-aware ფუნქციები
    getSmartSuggestions,
    getContextualFacts,
    analyzeInteractionPatterns
  };
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalTab, TerminalSession, TerminalEventMessage, TerminalState } from '../types/terminal';

// Define API_BASE outside the hook to avoid redefining it on every render
// This will be overridden by the specific API_BASE logic within the functions if needed.
const API_BASE = '/api/terminal';

export const useTerminalStore = (): TerminalState => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [connections, setConnections] = useState<Map<string, EventSource>>(new Map());

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  // Helper function to get the correct API base URL
  const getApiBaseUrl = useCallback(() => {
    return import.meta.env.VITE_API_BASE || 
      (window.location.host.includes('replit.dev') 
        ? `https://${window.location.host.replace(':5000', ':5002').replace(':3000', ':5002')}`
        : 'http://localhost:5002');
  }, []);

  // Cleanup connections on unmount
  useEffect(() => {
    return () => {
      connectionsRef.current.forEach(connection => {
        connection.close();
      });
    };
  }, []);

  // Create a new terminal tab and session
  const createTab = useCallback(async (name?: string, workingDirectory?: string): Promise<string> => {
    try {
      console.log(`🔄 Creating new terminal session: ${name || 'Terminal'}`);
      const currentApiBase = getApiBaseUrl();

      const response = await fetch(`${currentApiBase}/api/terminal/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'dev-user' // TODO: Get from auth context
        },
        body: JSON.stringify({
          name: name || `Terminal ${tabs.length + 1}`,
          workingDirectory: workingDirectory || '/home/runner/workspace'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create terminal session: ${response.statusText}`);
      }

      const data = await response.json();
      const session: TerminalSession = {
        ...data.session,
        output: data.session.output || [],
        history: data.session.history || [],
        environment: data.session.environment || {},
        workingDirectory: data.session.workingDirectory || '/home/runner/workspace'
      };

      console.log(`✅ Terminal session created: ${session.id}`);

      // Create tab
      const tabId = `tab_${Date.now()}`;
      const newTab: TerminalTab = {
        id: tabId,
        name: session.name,
        sessionId: session.id,
        isActive: true,
        hasUnsavedOutput: false,
        status: 'connecting'
      };

      // Update sessions
      setSessions(prev => new Map(prev).set(session.id, session));

      // Update tabs
      setTabs(prev => {
        const updatedTabs = prev.map(tab => ({ ...tab, isActive: false }));
        return [...updatedTabs, newTab];
      });

      setActiveTabIdState(tabId);

      // Connect to session stream
      await connectToSession(session.id, tabId);

      return tabId;
    } catch (error) {
      console.error('❌ Failed to create terminal tab:', error);
      throw error;
    }
  }, [tabs.length, getApiBaseUrl]); // Added getApiBaseUrl to dependencies

  // Connect to terminal session stream
  const connectToSession = useCallback(async (sessionId: string, tabId: string) => {
    try {
      console.log(`🔌 Connecting to terminal session stream: ${sessionId}`);
      const currentApiBase = getApiBaseUrl();

      const eventSource = new EventSource(`${currentApiBase}/api/terminal/sessions/${sessionId}/stream`);

      eventSource.onopen = () => {
        console.log(`✅ Terminal stream connected: ${sessionId}`);
        setTabs(prev => prev.map(tab => 
          tab.id === tabId 
            ? { ...tab, status: 'idle' as const }
            : tab
        ));
      };

      eventSource.onmessage = (event) => {
        try {
          const message: TerminalEventMessage = JSON.parse(event.data);
          handleTerminalMessage(sessionId, tabId, message);
        } catch (error) {
          console.error('❌ Failed to parse terminal message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`❌ Terminal stream error for ${sessionId}:`, error);
        setTabs(prev => prev.map(tab => 
          tab.id === tabId 
            ? { ...tab, status: 'error' as const }
            : tab
        ));
      };

      // Store connection
      setConnections(prev => new Map(prev).set(sessionId, eventSource));

    } catch (error) {
      console.error(`❌ Failed to connect to terminal session ${sessionId}:`, error);
      setTabs(prev => prev.map(tab => 
        tab.id === tabId 
          ? { ...tab, status: 'error' as const }
          : tab
      ));
    }
  }, [getApiBaseUrl]); // Added getApiBaseUrl to dependencies

  // Handle terminal messages from SSE
  const handleTerminalMessage = useCallback((sessionId: string, tabId: string, message: TerminalEventMessage) => {
    switch (message.type) {
      case 'connection_established':
        console.log(`🔗 Terminal connection established: ${sessionId}`);
        if (message.session) {
          setSessions(prev => {
            const updated = new Map(prev);
            const existing = updated.get(sessionId);
            if (existing) {
              updated.set(sessionId, { ...existing, ...message.session });
            }
            return updated;
          });
        }
        break;

      case 'history_output':
      case 'output':
        setSessions(prev => {
          const updated = new Map(prev);
          const session = updated.get(sessionId);
          if (session) {
            const newOutput = {
              type: message.outputType || 'stdout',
              content: message.data || '',
              timestamp: message.timestamp
            };

            // Ensure output is always an array
            const currentOutput = Array.isArray(session.output) ? session.output : [];
            
            const updatedSession = {
              ...session,
              output: [...currentOutput, newOutput],
              lastActivity: message.timestamp
            };

            updated.set(sessionId, updatedSession);
          }
          return updated;
        });

        // Mark tab as having new output
        setTabs(prev => prev.map(tab => 
          tab.id === tabId 
            ? { ...tab, hasUnsavedOutput: !tab.isActive }
            : tab
        ));
        break;

      case 'command_start':
        console.log(`⚡ Command started: ${message.command}`);
        setTabs(prev => prev.map(tab => 
          tab.id === tabId 
            ? { ...tab, status: 'running' as const, lastCommand: message.command }
            : tab
        ));
        break;

      case 'command_complete':
        console.log(`✅ Command completed: ${message.result?.command}`);
        setTabs(prev => prev.map(tab => 
          tab.id === tabId 
            ? { ...tab, status: 'idle' as const }
            : tab
        ));
        break;

      case 'command_error':
        console.error(`❌ Command error: ${message.error}`);
        setTabs(prev => prev.map(tab => 
          tab.id === tabId 
            ? { ...tab, status: 'error' as const }
            : tab
        ));
        break;

      case 'session_terminated':
        console.log(`🔴 Session terminated: ${sessionId}`);
        closeTab(tabId);
        break;

      case 'heartbeat':
        // Keep connection alive
        break;

      default:
        console.log(`📡 Terminal message: ${message.type}`);
    }
  }, []);

  // Close a terminal tab and cleanup
  const closeTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    console.log(`🗑️ Closing terminal tab: ${tab.name}`);
    const currentApiBase = getApiBaseUrl();

    // Close SSE connection
    const connection = connections.get(tab.sessionId);
    if (connection) {
      connection.close();
      setConnections(prev => {
        const updated = new Map(prev);
        updated.delete(tab.sessionId);
        return updated;
      });
    }

    // Remove session
    setSessions(prev => {
      const updated = new Map(prev);
      updated.delete(tab.sessionId);
      return updated;
    });

    // Remove tab
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);

      // If this was the active tab, activate another one
      if (tab.isActive && filtered.length > 0) {
        const newActiveTab = filtered[Math.max(0, filtered.findIndex(t => t.id === tabId) - 1)];
        newActiveTab.isActive = true;
        setActiveTabIdState(newActiveTab.id);
      } else if (filtered.length === 0) {
        setActiveTabIdState(null);
      }

      return filtered.map(t => ({ ...t, isActive: t.id === (tab.isActive ? filtered[0]?.id : activeTabId) }));
    });

    // Destroy session on backend
    fetch(`${currentApiBase}/api/terminal/sessions/${tab.sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': 'dev-user'
      }
    }).catch(error => {
      console.warn(`⚠️ Failed to destroy session ${tab.sessionId}:`, error);
    });
  }, [tabs, connections, activeTabId, getApiBaseUrl]); // Added getApiBaseUrl to dependencies

  // Set active tab
  const setActiveTab = useCallback((tabId: string) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.id === tabId,
      hasUnsavedOutput: tab.id === tabId ? false : tab.hasUnsavedOutput
    })));
    setActiveTabIdState(tabId);
  }, []);

  // Execute command in terminal session
  const executeCommand = useCallback(async (sessionId: string, command: string, options: { safetyConfirmed?: boolean } = {}): Promise<void> => {
    try {
      console.log(`⚡ Executing command in session ${sessionId}: ${command}`);
      const currentApiBase = getApiBaseUrl();

      const response = await fetch(`${currentApiBase}/api/terminal/sessions/${sessionId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'dev-user'
        },
        body: JSON.stringify({ 
          command,
          safetyConfirmed: options.safetyConfirmed || false
        })
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle safety confirmation requirement
        if (response.status === 422 && result.requiresSafety) {
          throw new Error(`SAFETY_REQUIRED:${result.error}`);
        }
        throw new Error(result.error || `Failed to execute command: ${response.statusText}`);
      }

      // Command execution events will be handled via SSE stream
      console.log(`✅ Command execution initiated: ${command}`);

    } catch (error) {
      console.error('❌ Failed to execute command:', error);
      throw error;
    }
  }, [getApiBaseUrl]); // Added getApiBaseUrl to dependencies

  // Rename terminal tab
  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, name: newName }
        : tab
    ));
    
    const currentApiBase = getApiBaseUrl();
    // Update session name on backend
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      fetch(`${currentApiBase}/api/terminal/sessions/${tab.sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'dev-user'
        },
        body: JSON.stringify({ name: newName })
      }).catch(error => {
        console.warn(`⚠️ Failed to rename session ${tab.sessionId}:`, error);
      });
    }
  }, [tabs, getApiBaseUrl]); // Added getApiBaseUrl to dependencies

  // Get command history for a tab
  const getTabHistory = useCallback((tabId: string): { command: string; timestamp: string; }[] => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return [];

    const session = sessions.get(tab.sessionId);
    return session?.history || [];
  }, [tabs, sessions]);

  // Clear terminal output for a tab
  const clearTabOutput = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    setSessions(prev => {
      const updated = new Map(prev);
      const session = updated.get(tab.sessionId);
      if (session) {
        updated.set(tab.sessionId, {
          ...session,
          output: []
        });
      }
      return updated;
    });
  }, [tabs]);

  // Load existing sessions on mount
  useEffect(() => {
    const loadExistingSessions = async () => {
      try {
        const currentApiBase = getApiBaseUrl();
        const response = await fetch(`${currentApiBase}/api/terminal/sessions`, {
          headers: {
            'X-User-Id': 'dev-user'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const existingSessions: TerminalSession[] = data.sessions || [];

          if (existingSessions.length > 0) {
            console.log(`📋 Loading ${existingSessions.length} existing terminal sessions`);

            // Create tabs for existing sessions and ensure proper session structure
            const existingTabs: TerminalTab[] = existingSessions.map((session, index) => ({
              id: `tab_${session.id}`,
              name: session.name,
              sessionId: session.id,
              isActive: index === 0,
              hasUnsavedOutput: false,
              status: 'connecting' as const
            }));

            // Ensure sessions have proper structure
            const normalizedSessions = existingSessions.map(session => ({
              ...session,
              output: Array.isArray(session.output) ? session.output : [],
              history: Array.isArray(session.history) ? session.history : [],
              environment: session.environment || {},
              workingDirectory: session.workingDirectory || '/home/runner/workspace'
            }));

            setTabs(existingTabs);
            setSessions(new Map(normalizedSessions.map(session => [session.id, session])));

            if (existingTabs.length > 0) {
              setActiveTabIdState(existingTabs[0].id);

              // Connect to all existing sessions
              for (const tab of existingTabs) {
                await connectToSession(tab.sessionId, tab.id);
              }
            }
          }
        } else {
           console.warn('Failed to load existing terminal sessions:', response.statusText);
        }
      } catch (error) {
        console.warn('⚠️ Failed to load existing terminal sessions:', error);
      }
    };

    loadExistingSessions();
  }, [connectToSession, getApiBaseUrl]); // Added getApiBaseUrl to dependencies

  return {
    tabs,
    activeTabId,
    sessions,
    connections,
    createTab,
    closeTab,
    setActiveTab,
    executeCommand,
    renameTab,
    getTabHistory,
    clearTabOutput
  };
};
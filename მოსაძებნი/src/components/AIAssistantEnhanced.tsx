// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/useAuth";
import { useDarkMode } from "../hooks/useDarkMode";
import GuruloFsqIllustration from "./illustrations/GuruloFsqIllustration";

/**
 * Message describes a single chat exchange between the user and the assistant.
 */
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  functionCalled?: string;
  functionResult?: any;
  memoryStored?: boolean;
  model?: string;
  responseTime?: number;
}

/**
 * PendingOperation is used when the assistant proposes a file write and waits
 * for the user to confirm or cancel. It stores the type of operation,
 * the target file path and the new file contents.
 */
interface PendingOperation {
  type: string;
  filePath: string;
  content: string;
}

interface MemoryData {
  mainMemory: any;
  facts: any[];
  grammarFixes: any[];
  timestamp: string;
}

interface EditableMemoryItem {
  id: string;
  content: string;
  type: 'fact' | 'grammar';
  isEditing: boolean;
}

/**
 * Enhanced AI Assistant component. This component manages its own messages,
 * tracks the connection state to the backend API, performs a simple
 * Georgian language validation client side and provides UI for writing
 * messages and viewing assistant replies. The assistant only renders for
 * authorised users (defined by their personalId) and will minimise into
 * a small button when the user collapses it.
 */
const AIAssistantEnhanced: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "error" | "checking"
  >("checking");
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [showMemoryModal, setShowMemoryModal] = useState(false);

  // Memory Modal State - moved to top level to fix hooks order
  const [editableItems, setEditableItems] = useState<EditableMemoryItem[]>([]);
  const [memorySearchTerm, setMemorySearchTerm] = useState("");
  const [selectedMemoryTab, setSelectedMemoryTab] = useState<'overview' | 'facts' | 'grammar'>('overview');
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [isEditingMainMemory, setIsEditingMainMemory] = useState(false);
  const [mainMemoryContent, setMainMemoryContent] = useState("");
  const [showPersonalInfoEditor, setShowPersonalInfoEditor] = useState(false);
  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    age: '',
    interests: '',
    notes: ''
  });

  const [guestSessionId] = useState(() => {
    if (typeof window === 'undefined') {
      return `guest_${Date.now()}`;
    }

    try {
      const stored = window.localStorage.getItem('guest_session_id');
      if (stored) {
        return stored;
      }

      const randomId = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const newId = `guest_${randomId}`;
      window.localStorage.setItem('guest_session_id', newId);
      return newId;
    } catch (error) {
      console.warn('⚠️ Unable to access localStorage for guest session:', error);
      return `guest_${Date.now()}`;
    }
  });

  const activePersonalId = user?.personalId || guestSessionId;
  const isGuestUser = !user;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ALL hooks must be at the top level - no early returns before this point
  /**
   * Determine the backend API endpoint based on environment. In development
   * we use the Vite proxy which forwards /api/ai/* to AI service on port 5001.
   * In production we use the current origin which should proxy to AI service.
   */
  const getApiEndpoint = useCallback(() => {
    const isProduction = window.location.protocol === "https:";
    // Use Vite proxy in development, current origin in production
    const baseURL = isProduction
      ? window.location.origin
      : window.location.origin;
    return `${baseURL}/api/ai/chat`;
  }, []);

  /**
   * Scroll the chat container to the bottom whenever new messages arrive.
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Add ref for tracking active requests
  const activeRequestsRef = useRef(new Set());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Health check the backend service with proper authentication.
   * Only check health if user is authenticated to avoid audit log spam.
   */
  const checkConnectionHealth = useCallback(async () => {
    // Only check health if user is authenticated
    if (!user) {
      setConnectionStatus("error");
      return false;
    }

    try {
      const isProduction = window.location.protocol === "https:";
      const baseURL = isProduction
        ? window.location.origin
        : window.location.origin; // Use Vite proxy in development
      const healthEndpoint = `${baseURL}/api/health`;

      console.log("🔍 Environment check:", { isProduction, baseURL, healthEndpoint });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Track this request
      activeRequestsRef.current.add(controller);

      const response = await fetch(healthEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      activeRequestsRef.current.delete(controller);

      if (response.ok) {
        const healthData = await response.json();
        console.log("✅ AI Service Health:", healthData);
        setConnectionStatus("connected");
        return true;
      } else {
        console.warn("⚠️ AI Service returned non-OK status:", response.status);
        setConnectionStatus("error");
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error("🤖 Health check timeout");
      } else {
        console.error("🤖 Health check failed:", error);
      }
      setConnectionStatus("error");
      return false;
    }
  }, []);

  /**
   * Perform simple Georgian text corrections on the assistant response. This
   * helper fixes common misspellings and ensures the assistant output is
   * more natural. For more advanced grammar correction you may integrate
   * a dedicated service, but this local replacement covers frequent errors.
   */
  const validateGeorgianText = useCallback((text: string): string => {
    return text
      .replace(/შეგირია/g, "შეგიძლია")
      .replace(/\bკავ\b/g, "კაკი")
      .replace(/მე დამეხმაროს/g, "მე დამეხმარო")
      .replace(/შეასრულებს/g, "შეასრულო");
  }, []);

  /**
   * Attempt to sync any unsaved memory entries. This is a silent best
   * effort operation; errors are logged but do not affect UI state.
   */
  const attemptSyncRecovery = useCallback(async () => {
    if (!user?.personalId) return;
    try {
      const endpoint = getApiEndpoint().replace("/chat", "/memory/sync");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalId: user.personalId }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log("🔄 Enhanced sync recovery successful");
        }
      }
    } catch (error) {
      console.log("🔄 Sync recovery unavailable:", (error as Error).message);
    }
  }, [user?.personalId, getApiEndpoint]);

  /**
   * Load user memory from the backend. This function triggers a sync
   * recovery after loading memory to ensure any unsynced items are
   * recovered. Errors are logged but do not break the UI.
   */
  const loadMemoryData = useCallback(async () => {
    if (!user?.personalId) return;
    try {
      const endpoint = getApiEndpoint().replace("/chat", "/memory/view");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalId: user.personalId }),
      });
      if (response.ok) {
        const data = await response.json();
        setMemoryData(data);
        setShowMemoryModal(true);
        setMainMemoryContent(typeof data?.mainMemory === 'string' ? data.mainMemory : '');
        await attemptSyncRecovery();
      }
    } catch (error) {
      console.error("🧠 Memory loading error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **მეხსიერების ჩატვირთვაში შეცდომა:**\n\n${error instanceof Error ? error.message : "უცნობი შეცდომა"}`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user?.personalId, getApiEndpoint, attemptSyncRecovery]);

  /**
   * ოპტიმიზებული სტრიმინგის გადაწყვეტილება
   */
  const shouldUseStreaming = useCallback((message: string): boolean => {
    // მარტივი პატერნები - არ გამოიყენო სტრიმინგი
    const simplePatterns = [
      /^(გამარჯობა|hello|hi|მადლობა|thanks)[\s\!\?]*$/i,
      /^[\d\+\-\*\/\s\(\)]+[\s\?\!]*$/, // მათემატიკა
      /^რამდენია\s*[\d\+\-\*\/\s\(\)]+/i
    ];

    // რთული პატერნები - გამოიყენე სტრიმინგი
    const complexPatterns = [
      /სრული.*?ინფორმაცია|დეტალური.*?ანალიზი/i,
      /ვისტარული.*?(ანალიზი|ინფორმაცია)/i
    ];

    if (simplePatterns.some(pattern => pattern.test(message))) {
      return false; // არ გამოიყენო სტრიმინგი
    }

    return message.length > 80 || 
           complexPatterns.some(pattern => pattern.test(message));
  }, []);

  /**
   * Send a streaming message to the backend AI service for real-time responses.
   */
  const sendStreamingMessage = useCallback(async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    // Create placeholder for streaming response
    const streamingMessageId = Date.now();
    const streamingMessage: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, streamingMessage]);

    try {
      const endpoint = getApiEndpoint().replace("/chat", "/stream");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({
          message: currentInput,
          userId: activePersonalId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk' && data.content) {
                  streamedContent += data.content;
                  // Update streaming message
                  setMessages((prev) => 
                    prev.map((msg, index) => 
                      index === prev.length - 1 
                        ? { ...msg, content: streamedContent }
                        : msg
                    )
                  );
                }

                if (data.type === 'done' || data.type === 'complete') {
                  // Finalize message
                  setMessages((prev) => 
                    prev.map((msg, index) => 
                      index === prev.length - 1 
                        ? { 
                            ...msg, 
                            content: data.content || streamedContent,
                            responseTime: Date.now() - streamingMessageId 
                          }
                        : msg
                    )
                  );
                  break;
                }

                if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.log('Parse error:', parseError);
              }
            }
          }
        }
      }

      setConnectionStatus("connected");
    } catch (error) {
      console.error('🌊 Streaming error:', error);
      // Fallback to regular message
      await sendMessage();
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, activePersonalId, getApiEndpoint]);

  /**
   * Send a message from the user to the backend AI service. This function
   * handles memory triggers, error handling and conversation history. It
   * also measures response times for performance monitoring.
   */
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim()) return;
    // Append user message to chat
    const userMessage: Message = {
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);
    const startTime = Date.now();
    // Handle memory triggers before sending to chat endpoint
    if (
      currentInput.toLowerCase().includes("დაიმახსოვრე") ||
      currentInput.toLowerCase().includes("გახსოვდეს") ||
      currentInput.toLowerCase().includes("დამიმახსოვრე")
    ) {
      try {
        const factToRemember = currentInput
          .replace(/დაიმახსოვრე/gi, "")
          .replace(/გახსოვდეს/gi, "")
          .replace(/დამიმახსოვრე/gi, "")
          .trim();
        if (factToRemember && user?.personalId) {
          const endpoint = getApiEndpoint().replace("/chat", "/remember");
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.personalId,
              fact: factToRemember,
            }),
          });
          if (response.ok) {
            const memoryResult = await response.json();
            const responseTime = Date.now() - startTime;
            const memoryMessage: Message = {
              role: "assistant",
              content: `🧠 **დამახსოვრდა!** ${memoryResult.message}`,
              timestamp: new Date(),
              memoryStored: true,
              responseTime,
            };
            setMessages((prev) => [...prev, memoryMessage]);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error("🧠 Memory storage error:", error);
      }
    }
    // Send message to chat endpoint
    try {
      const endpoint = getApiEndpoint();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({
          message: currentInput,
          personalId: activePersonalId,
          conversationHistory: messages
            .slice(-3)
            .map((m) => ({ role: m.role, content: m.content.substring(0, 200) })),
        }),
      });
      if (!response.ok) {
        // Try to extract error text for more detailed error messages
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      if (data.error) {
        throw new Error(data.error);
      }
      // Either response or reply field may contain the assistant's message
      const assistantRaw = data.response || data.reply || "";
      // Validate Georgian output
      const validatedResponse = validateGeorgianText(
        assistantRaw || "პასუხი ვერ იქნა გენერირებული.",
      );
      const assistantMessage: Message = {
        role: "assistant",
        content: validatedResponse,
        timestamp: new Date(),
        functionCalled: data.functionCalled,
        functionResult: data.functionResult,
        memoryStored: data.memoryStored || false,
        model: data.model,
        responseTime,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConnectionStatus("connected");
    } catch (error) {
      // On error show user friendly message and schedule a health check
      const responseTime = Date.now() - startTime;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **შეცდომა AI სისტემაში:**\n\n${
            error instanceof Error ? error.message : "უცნობი შეცდომა"
          }\n\n🔄 **რეკომენდაცია:**\n• შეამოწმეთ ინტერნეტ კავშირი\n• სცადეთ სხვა ფორმულირებით\n• დაელოდეთ რამდენიმე წამი და სცადეთ ხელახლა`,
          timestamp: new Date(),
          responseTime,
        },
      ]);
      setConnectionStatus("error");
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      // After 5 seconds attempt to re-check the health endpoint
      retryTimeoutRef.current = setTimeout(() => {
        checkConnectionHealth();
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  }, [
    inputMessage,
    messages,
    activePersonalId,
    getApiEndpoint,
    validateGeorgianText,
    checkConnectionHealth,
  ]);

  /**
   * Execute a pending file operation once the user confirms or declines.
   */
  const executeOperation = useCallback(
    async (approved: boolean) => {
      if (!pendingOperation) return;
      if (approved) {
        setIsLoading(true);
        try {
          const endpoint = getApiEndpoint().replace("/chat", "/execute");
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: pendingOperation }),
          });
          const result = await response.json();
          const statusMessage: Message = {
            role: "assistant",
            content: result.success
              ? `✅ **წარმატებით დასრულდა:** ${result.message}`
              : `❌ **შეცდომა:** ${result.error}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, statusMessage]);
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ **ოპერაციის შესრულებაში შეცდომა:** ${
                error instanceof Error ? error.message : "უცნობი შეცდომა"
              }`,
              timestamp: new Date(),
            },
          ]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Operation was cancelled by the user
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "❌ **ოპერაცია გაუქმდა** მომხმარებლის მიერ",
            timestamp: new Date(),
          },
        ]);
      }
      setPendingOperation(null);
    },
    [pendingOperation, getApiEndpoint],
  );

  /**
   * Smart message sender that chooses streaming vs regular based on complexity
   */
  const sendSmartMessage = useCallback(async () => {
    if (!inputMessage.trim()) return;

    // Use streaming for complex queries, regular for simple ones
    if (shouldUseStreaming(inputMessage)) {
      console.log('🌊 Using streaming for complex query');
      await sendStreamingMessage();
    } else {
      console.log('⚡ Using regular mode for simple query');
      await sendMessage();
    }
  }, [inputMessage, shouldUseStreaming, sendStreamingMessage, sendMessage]);

  /**
   * Submit message on Enter (without shift) when typing. This prevents
   * newline insertion from sending prematurely.
   */
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendSmartMessage();
      }
    },
    [sendSmartMessage],
  );

  // ALL useEffect hooks must be declared here before any early returns
  /**
   * Scroll to bottom whenever messages change. Using effect so that DOM
   * updates after state updates finish.
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * Perform an initial health check once the assistant is loaded and
   * authorised. This ensures the connection status indicator is
   * immediately updated when the component mounts.
   */
  useEffect(() => {
    const isAuthorized = 
      (user?.personalId && AUTHORIZED_AI_USERS.includes(user.personalId)) || 
      (user?.role && AUTHORIZED_AI_ROLES.includes(user.role));
    if (user && isAuthorized) {
      checkConnectionHealth();
    }
  }, [checkConnectionHealth, user]);

  /**
   * Clean up any pending retry timeouts and intervals when the component unmounts.
   */
  useEffect(() => {
    return () => {
      // Clear timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // Clear health check interval
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      
      // Cancel all active requests
      activeRequestsRef.current.forEach(controller => {
        try {
          controller.abort();
        } catch (e) {
          console.warn('Error aborting request:', e);
        }
      });
      activeRequestsRef.current.clear();
      
      // Remove any event listeners that might have been added
      window.removeEventListener('beforeunload', () => {});
    };
  }, []);

  // Prepare editable items when modal opens
  useEffect(() => {
    if (memoryData && showMemoryModal) {
      const facts = (memoryData.facts || []).map((fact: any, index: number) => ({
        id: `fact_${index}`,
        content: typeof fact === 'string' ? fact : JSON.stringify(fact),
        type: 'fact' as const,
        isEditing: false
      }));

      const grammar = (memoryData.grammarFixes || []).map((fix: any, index: number) => ({
        id: `grammar_${index}`,
        content: typeof fix === 'string' ? fix : JSON.stringify(fix),
        type: 'grammar' as const,
        isEditing: false
      }));

      setEditableItems([...facts, ...grammar]);
    }
  }, [memoryData, showMemoryModal]);

  // AI Assistant Authorization Configuration
  const AUTHORIZED_AI_USERS = ["01019062020"]; // Array of authorized personal IDs
  const AUTHORIZED_AI_ROLES = ["SUPER_ADMIN", "PROVIDER_ADMIN", "ADMIN"]; // Authorized roles
  const guestAccessEnabled = import.meta.env.VITE_ENABLE_PUBLIC_CHAT !== 'false';

  // Enhanced authorization check with detailed logging
  const authorizedAccount = user && (
    (user.personalId && AUTHORIZED_AI_USERS.includes(user.personalId)) ||
    (user.role && AUTHORIZED_AI_ROLES.includes(user.role)) ||
    (user.email && user.email === "admin@bakhmaro.com") // Admin email fallback
  );

  const isAuthorized = Boolean(authorizedAccount) || guestAccessEnabled;

  // Debug mode: Show AI Assistant even without authorization for testing
  const DEBUG_MODE = import.meta.env.MODE === 'development';
  const FORCE_SHOW_AI = DEBUG_MODE && window.location.search.includes('debug=ai');

  // More detailed debugging
  console.log("🔍 AI Authorization Check (Enhanced):", {
    hasUser: !!user,
    userObject: user,
    personalId: user?.personalId,
    guestSessionId,
    activePersonalId,
    role: user?.role,
    email: user?.email,
    uid: user?.uid,
    isAuthenticated: !!user,
    isGuestUser,
    guestAccessEnabled,
    shouldShowAI: isAuthorized || FORCE_SHOW_AI,
    authState: user ? 'authenticated' : 'guest',
    authorizedUsers: AUTHORIZED_AI_USERS,
    authorizedRoles: AUTHORIZED_AI_ROLES,
    personalIdMatch: user?.personalId ? AUTHORIZED_AI_USERS.includes(user.personalId) : false,
    roleMatch: user?.role ? AUTHORIZED_AI_ROLES.includes(user.role) : false
  });

  // Early return ONLY after ALL hooks are declared
  if (!isAuthorized && !FORCE_SHOW_AI) {
    console.log("🚫 AI Assistant access denied for:", user?.personalId || user?.email || guestSessionId || 'unknown_user');
    console.log("💡 Debug tip: Add ?debug=ai to URL to force show AI Assistant in development");
    return null;
  }

  if (FORCE_SHOW_AI) {
    console.log("🔧 DEBUG MODE: AI Assistant forced to show for debugging");
  }

  // Render the minimised button when collapsed
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className={`p-3 rounded-full shadow-lg transition-all flex items-center space-x-2 ${
            isDarkMode
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          <span>🤖</span>
          <span className="text-sm font-medium">ბახმარო AI</span>
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-400"
                : connectionStatus === "error"
                  ? "bg-red-400"
                  : "bg-yellow-400"
            } animate-pulse`}
          ></div>
        </button>
      </div>
    );
  }



  const handleEditItem = (id: string) => {
    setEditableItems(prev => prev.map(item => 
      item.id === id ? { ...item, isEditing: true } : item
    ));
  };

  const handleSaveItem = async (id: string, newContent: string) => {
    if (!user?.personalId) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'ℹ️ მეხსიერების რედაქტირება ხელმისაწვდომია მხოლოდ ავტორიზებული მომხმარებლებისთვის.',
        timestamp: new Date()
      }]);
      return;
    }
    try {
      // Update local state
      setEditableItems(prev => prev.map(item =>
        item.id === id ? { ...item, content: newContent, isEditing: false } : item
      ));

      // Send update to backend
      const endpoint = getApiEndpoint().replace('/chat', '/memory/update');
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalId: user?.personalId,
          itemId: id,
          content: newContent
        })
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ მეხსიერების ელემენტი განახლდა!',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Memory update error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ მეხსიერების განახლება ვერ მოხერხდა',
        timestamp: new Date()
      }]);
    }
  };

  const handleCancelEdit = (id: string) => {
    setEditableItems(prev => prev.map(item => 
      item.id === id ? { ...item, isEditing: false } : item
    ));
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('დარწმუნებული ხართ, რომ გსურთ ამ ელემენტის წაშლა?')) return;

    if (!user?.personalId) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'ℹ️ მეხსიერების მართვა ხელმისაწვდომია მხოლოდ ავტორიზებული მომხმარებლებისთვის.',
        timestamp: new Date()
      }]);
      return;
    }

    try {
      const endpoint = getApiEndpoint().replace('/chat', '/memory/delete');
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalId: user?.personalId,
          itemId: id
        })
      });

      setEditableItems(prev => prev.filter(item => item.id !== id));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🗑️ მეხსიერების ელემენტი წაშლილია',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Memory delete error:', error);
    }
  };

  const handleAddNewMemoryItem = async (content: string, type: 'fact' | 'grammar') => {
    if (!user?.personalId) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'ℹ️ ახალი მეხსიერების დამატება შესაძლებელია მხოლოდ ავტორიზებული მომხმარებლებისთვის.',
        timestamp: new Date()
      }]);
      return;
    }
    try {
      const endpoint = getApiEndpoint().replace('/chat', '/memory/add');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalId: user?.personalId,
          content,
          type
        })
      });

      if (response.ok) {
        // Add to local state
        const newItem: EditableMemoryItem = {
          id: `new_${type}_${Date.now()}`,
          content,
          type,
          isEditing: false
        };
        setEditableItems(prev => [...prev, newItem]);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '✅ ახალი მეხსიერების ელემენტი დაემატა!',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Memory add error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ ახალი ელემენტის დამატება ვერ მოხერხდა',
        timestamp: new Date()
      }]);
    }
  };

    const handleSaveMainMemory = async () => {
        if (!user?.personalId) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'ℹ️ მთავარი მეხსიერების ცვლილება ხელმისაწვდომია მხოლოდ ავტორიზებული მომხმარებლებისთვის.',
                timestamp: new Date()
            }]);
            return;
        }
        try {
            const endpoint = getApiEndpoint().replace('/chat', '/memory/update');
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personalId: user?.personalId,
                    itemId: 'mainMemory',
                    content: mainMemoryContent
                })
            });

            setMemoryData(prev => ({ ...prev, mainMemory: mainMemoryContent }));
            setIsEditingMainMemory(false);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '✅ მთავარი მეხსიერება განახლდა!',
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error('Main memory update error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ მთავარი მეხსიერების განახლება ვერ მოხერხდა',
                timestamp: new Date()
            }]);
        }
    };

  // Filter items based on search
  const filteredItems = editableItems.filter(item => 
    item.content.toLowerCase().includes(memorySearchTerm.toLowerCase())
  );

  // Memory Modal with modern design
  const memoryModal = showMemoryModal && (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className={`max-w-6xl w-full max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden border flex flex-col ${
          isDarkMode 
            ? "bg-gray-900 text-white border-gray-700" 
            : "bg-white text-gray-900 border-gray-200"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex justify-between items-center backdrop-blur-sm ${
            isDarkMode 
              ? "bg-gray-800/90 border-gray-700" 
              : "bg-gray-50/90 border-gray-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <span className="text-xl">🧠</span>
            </div>
            <div>
              <h3 className="text-xl font-bold">AI მეხსიერების მენეჯერი</h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                მონაცემების ნახვა, რედაქტირება და მართვა
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowMemoryModal(false)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? "hover:bg-gray-700 text-gray-400 hover:text-white" 
                : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`px-6 py-3 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex space-x-1">
            {[
              { id: 'overview', label: '📊 მიმოხილვა', icon: '📊' },
              { id: 'facts', label: '🔍 ფაქტები', icon: '🔍' },
              { id: 'grammar', label: '✏️ გრამატიკა', icon: '✏️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedMemoryTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedMemoryTab === tab.id
                    ? isDarkMode
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-blue-500 text-white shadow-lg"
                    : isDarkMode
                      ? "text-gray-400 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {selectedMemoryTab === 'overview' && memoryData && (
            <div className="space-y-6">
              {/* Debug Information */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">🔍 მეხსიერების მდგომარეობა</h5>
                <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <div>მონაცემების ზომა: {memoryData ? JSON.stringify(memoryData).length : 0} ბაიტი</div>
                  <div>ბოლო განახლება: {memoryData?.timestamp ? new Date(memoryData.timestamp).toLocaleString('ka-GE') : 'მიუწვდომელი'}</div>
                  <div>მეხსიერების ტიპი: {typeof memoryData?.mainMemory}</div>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border ${
                  isDarkMode 
                    ? "bg-gray-800 border-gray-700" 
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        ფაქტების რაოდენობა
                      </p>
                      <p className="text-2xl font-bold text-blue-500">
                        {memoryData.facts?.length || 0}
                      </p>
                    </div>
                    <span className="text-3xl">🔍</span>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  isDarkMode 
                    ? "bg-gray-800 border-gray-700" 
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        გრამატიკული შესწორებები
                      </p>
                      <p className="text-2xl font-bold text-green-500">
                        {memoryData.grammarFixes?.length || 0}
                      </p>
                    </div>
                    <span className="text-3xl">✏️</span>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  isDarkMode 
                    ? "bg-gray-800 border-gray-700" 
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        ბოლო განახლება
                      </p>
                      <p className="text-sm font-medium">
                        {new Date(memoryData.timestamp).toLocaleString('ka-GE')}
                      </p>
                    </div>
                    <span className="text-3xl">⏰</span>
                  </div>
                </div>
              </div>

              {/* Main Memory Display with Editing */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold flex items-center">
                    <span className="mr-2">📊</span>
                    მთავარი მეხსიერება
                  </h4>
                  <button
                    onClick={() => setIsEditingMainMemory(!isEditingMainMemory)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isDarkMode 
                        ? "bg-blue-600 hover:bg-blue-700 text-white" 
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                    }`}
                  >
                    {isEditingMainMemory ? '👁️ ნახვა' : '✏️ რედაქტირება'}
                  </button>
                </div>
                <div className={`p-4 rounded-xl border ${
                  isDarkMode 
                    ? "bg-gray-800 border-gray-700" 
                    : "bg-gray-50 border-gray-200"
                }`}>
                  {isEditingMainMemory ? (
                    <div className="space-y-3">
                      <textarea
                        value={mainMemoryContent}
                        onChange={(e) => setMainMemoryContent(e.target.value)}
                        className={`w-full p-3 rounded-lg border resize-none min-h-40 ${
                          isDarkMode
                            ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                            : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                        }`}
                        placeholder="მთავარი მეხსიერების შინაარსი..."
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveMainMemory}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                        >
                          ✓ შენახვა
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingMainMemory(false);
                            setMainMemoryContent(typeof memoryData?.mainMemory === 'string' ? memoryData.mainMemory : '');
                          }}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
                        >
                          ✗ გაუქმება
                        </button>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {mainMemoryContent || 'მთავარი მეხსიერება ცარიელია'}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {(selectedMemoryTab === 'facts' || selectedMemoryTab === 'grammar') && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="მეხსიერების ძიება..."
                  value={memorySearchTerm}
                  onChange={(e) => setMemorySearchTerm(e.target.value)}
                  className={`w-full px-4 py-3 pl-10 rounded-xl border transition-colors ${
                    isDarkMode
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
                <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Add New Item */}
              <div className={`p-4 rounded-xl border-2 border-dashed ${
                isDarkMode 
                  ? "border-gray-600 bg-gray-800/50" 
                  : "border-gray-300 bg-gray-50/50"
              }`}>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">
                    {selectedMemoryTab === 'facts' ? '🔍' : '✏️'}
                  </span>
                  <h4 className="font-medium">
                    ახალი {selectedMemoryTab === 'facts' ? 'ფაქტი' : 'გრამატიკული შესწორება'}
                  </h4>
                </div>
                <div className="space-y-3">
                  <textarea
                    placeholder={selectedMemoryTab === 'facts' 
                      ? "მაგ: ადმინ პანელი მუშაობს პორტ 3000-ზე" 
                      : "მაგ: არა 'შეგირია', არამედ 'შეგიძლია'"
                    }
                    className={`w-full p-3 rounded-lg border resize-none ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    }`}
                    rows={3}
                    value={newMemoryContent}
                    onChange={(e) => setNewMemoryContent(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      if (newMemoryContent.trim()) {
                        handleAddNewMemoryItem(newMemoryContent.trim(), selectedMemoryTab as 'fact' | 'grammar');
                        setNewMemoryContent('');
                      }
                    }}
                    disabled={!newMemoryContent.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ➕ დამატება
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {filteredItems
                  .filter(item => selectedMemoryTab === 'facts' ? item.type === 'fact' : item.type === 'grammar')
                  .map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isDarkMode 
                          ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
                          : "bg-gray-50 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {item.isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={item.content}
                                onChange={(e) => setEditableItems(prev => prev.map(i => 
                                  i.id === item.id ? { ...i, content: e.target.value } : i
                                ))}
                                className={`w-full p-3 rounded-lg border resize-none ${
                                  isDarkMode
                                    ? "bg-gray-700 border-gray-600 text-white"
                                    : "bg-white border-gray-300 text-gray-900"
                                }`}
                                rows={3}
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleSaveItem(item.id, item.content)}
                                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                                >
                                  ✓ შენახვა
                                </button>
                                <button
                                  onClick={() => handleCancelEdit(item.id)}
                                  className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
                                >
                                  ✗ გაუქმება
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm mb-2 whitespace-pre-wrap">{item.content}</p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditItem(item.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isDarkMode 
                                      ? "hover:bg-gray-700 text-gray-400 hover:text-white" 
                                      : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                                  }`}
                                  title="რედაქტირება"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className={`p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-50 ${
                                    isDarkMode ? "hover:bg-red-900/20" : "hover:bg-red-50"
                                  }`}
                                  title="წაშლა"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                {filteredItems.filter(item => selectedMemoryTab === 'facts' ? item.type === 'fact' : item.type === 'grammar').length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">
                      {selectedMemoryTab === 'facts' ? '🔍' : '✏️'}
                    </div>
                    <p className={`text-lg ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {memorySearchTerm 
                        ? "ძიების შედეგები ვერ მოიძებნა" 
                        : selectedMemoryTab === 'facts' 
                          ? "ფაქტები არ არის შენახული" 
                          : "გრამატიკული შესწორებები არ არის"
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex justify-between items-center">
            <div className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              AI მეხსიერების მენეჯერი v2.0 - Enhanced დახვეწა
            </div>
            <button
              onClick={() => {
                setShowMemoryModal(false);
                setMemorySearchTerm("");
                setSelectedMemoryTab('overview');
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
            >
              დახურვა
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const loadMemory = async () => {
    if (!user?.personalId) {
      console.log('🚫 No user personalId available for memory loading');
      return;
    }

    try {
      setMemoryLoading(true);
      setMemoryError(null);

      const response = await fetch(`/api/memory/view/${user.personalId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Memory loading failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🧠 Memory data loaded:', data);
      setMemoryData(data);

      // Load personal info if exists
      if (data.personalInfo) {
        setPersonalInfo({
          name: data.personalInfo.name || '',
          age: data.personalInfo.age || '',
          interests: data.personalInfo.interests || '',
          notes: data.personalInfo.notes || ''
        });
      }
    } catch (error) {
      console.error('❌ Memory loading error:', error);
      setMemoryError(error.message);
    } finally {
      setMemoryLoading(false);
    }
  };

  const savePersonalInfo = async () => {
    if (!user?.personalId) {
      console.log('🚫 No user personalId available for saving personal info');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/memory/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.personalId,
          personalInfo: personalInfo,
          type: 'personal_info_update'
        })
      });

      if (!response.ok) {
        throw new Error(`Personal info save failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Personal info saved:', result);

      // Reload memory to get updated data
      await loadMemory();
      setShowPersonalInfoEditor(false);

      // Show success message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ პირადი ინფორმაცია წარმატებით შეინახა!',
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error('❌ Personal info save error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ პირადი ინფორმაციის შენახვისას მოხდა შეცდომა. სცადეთ თავიდან.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div>
      {memoryModal}
      <div
        className={`fixed bottom-4 right-4 w-96 h-[600px] z-50 rounded-lg shadow-2xl border transition-all ${
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
      {/* Header */}
      <div
        className={`p-4 border-b rounded-t-lg flex justify-between items-center ${
          isDarkMode
            ? "bg-gray-700 border-gray-600"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full animate-pulse ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500"
            }`}
          ></div>
          <h3
            className={`font-medium flex items-center space-x-1 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <span>🤖</span>
            <span>ბახმარო AI Assistant</span>
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!showMemoryModal) {
                loadMemoryData().catch(console.error);
              }
            }}
            disabled={showMemoryModal}
            className={`p-2 rounded transition-colors text-blue-400 hover:bg-opacity-20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode ? "hover:bg-gray-600" : "hover:bg-gray-200"
            }`}
            title="🧠 მეხსიერების მონაცემები"
          >
            🔍
          </button>
          <button
            onClick={checkConnectionHealth}
            className={`p-2 rounded transition-colors ${
              connectionStatus === "connected"
                ? "text-green-500"
                : connectionStatus === "error"
                  ? "text-red-500"
                  : "text-yellow-500"
            } ${isDarkMode ? "hover:bg-gray-600" : "hover:bg-gray-200"}`}
            title="კავშირის შემოწმება"
          >
            🔄
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-2 rounded transition-colors ${
              isDarkMode
                ? "hover:bg-gray-600 text-gray-400"
                : "hover:bg-gray-200 text-gray-600"
            }`}
            title="შეამცირე"
          >
            −
          </button>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[400px]">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div
              className={`rounded-3xl border p-4 shadow-inner ${
                isDarkMode
                  ? "border-indigo-900/40 bg-slate-900/60"
                  : "border-indigo-100 bg-indigo-50"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2 text-left">
                  <p className="text-lg font-semibold text-indigo-500 dark:text-indigo-300">
                    👋 გამარჯობა!
                  </p>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDarkMode ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    გურულო FSQ მოდული მზად არის სწრაფად იპოვოს მნიშვნელოვანი ფაქტები და
                    პერსონალიზებული პასუხები მისცეს სტუმრების კითხვებს.
                  </p>
                  <ul
                    className={`grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 ${
                      isDarkMode ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    <li className="rounded-xl border border-transparent bg-white/10 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                      🔍 მოიძიე ნებისმიერი კოტეჯის ინფორმაცია
                    </li>
                    <li className="rounded-xl border border-transparent bg-white/10 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                      ⚡ მიიღე კონტექსტური რეკომენდაციები
                    </li>
                    <li className="rounded-xl border border-transparent bg-white/10 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                      🧠 განაახლე მეხსიერება ერთი კლიკით
                    </li>
                  </ul>
                </div>
                <div className="hidden w-40 shrink-0 sm:block">
                  <GuruloFsqIllustration dark={isDarkMode} />
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-3 text-center text-xs ${
                isDarkMode
                  ? "border-slate-700 bg-slate-800/70 text-slate-300"
                  : "border-indigo-100 bg-white text-slate-600"
              }`}
            >
              💡 მაგალითი: "რა ფუნქციებია BookingService-ში?" ან "როგორ მუშაობს ბრონირების სისტემა?"
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : isDarkMode
                    ? "bg-gray-700 text-gray-100"
                    : "bg-gray-100 text-gray-900"
              }`}
            >
              {/* Message header with prominent response time for assistant */}
              {message.role === 'assistant' && (
                <div className={`flex items-center justify-between mb-2 pb-2 border-b ${
                  isDarkMode ? "border-gray-600" : "border-gray-300"
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-medium opacity-80">AI Assistant</span>
                  </div>
                  {message.responseTime && (
                    <div 
                      className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                        isDarkMode 
                          ? "bg-blue-800/50 text-blue-200" 
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      <span>⏱️</span>
                      <span>{Math.round(message.responseTime / 1000)}წმ</span>
                    </div>
                  )}
                </div>
              )}

              <div className="whitespace-pre-wrap">{message.content}</div>
              {/* Metadata badges - excluding response time since it's now in header */}
              <div className="flex flex-wrap gap-2 mt-2">
                {message.memoryStored && (
                  <div
                    className={`text-xs px-2 py-1 rounded-full animate-pulse ${
                      isDarkMode
                        ? "bg-blue-800 text-blue-200"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    🧠 მახსოვს
                  </div>
                )}
                {message.model && (
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${
                      isDarkMode
                        ? "bg-green-800 text-green-200"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {message.model}
                  </div>
                )}
                {message.functionCalled && !message.memoryStored && (
                  <div className="text-xs opacity-70">
                    🔧 {message.functionCalled}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* Pending operation confirmation */}
        {pendingOperation && (
          <div
            className={`p-4 rounded-lg border ${
              isDarkMode
                ? "bg-yellow-900 border-yellow-700 text-yellow-100"
                : "bg-yellow-50 border-yellow-200 text-yellow-800"
            }`}
          >
            <p className="font-medium">⚠️ დადასტურება საჭიროა</p>
            <p className="text-sm mt-1">
              გსურთ ფაილის <strong>{pendingOperation.filePath}</strong>{" "}
              შეცვლა/შექმნა?
            </p>
            <div className="flex space-x-2 mt-3">
              <button
                onClick={() => executeOperation(true)}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                disabled={isLoading}
              >
                ✓ დიახ
              </button>
              <button
                onClick={() => executeOperation(false)}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                disabled={isLoading}
              >
                ✗ არა
              </button>
            </div>
          </div>
        )}
        {/* Loading indicator with real-time timer */}
        {isLoading && (
          <div className="flex justify-start">
            <div
              className={`p-3 rounded-lg ${
                isDarkMode ? "bg-gray-700" : "bg-gray-100"
              }`}
            >
              {/* Loading header with timer */}
              <div className={`flex items-center justify-between mb-2 pb-2 border-b ${
                isDarkMode ? "border-gray-600" : "border-gray-300"
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-sm font-medium opacity-80">ბახმარო AI</span>
                </div>
                <div 
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isDarkMode 
                      ? "bg-yellow-800/50 text-yellow-200" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  <span>⏳</span>
                  <span>მუშავდება...</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <span className="text-xs ml-2">🌊 AI სტრიმინგი...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div
        className={`p-4 border-t ${
          isDarkMode ? "border-gray-600" : "border-gray-200"
        }`}
      >
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              connectionStatus === "connected"
                ? "✨ Enhanced AI შეკითხვა ან დავალება..."
                : "⚠️ კავშირი გაწყდა - სცადეთ ხელახლა..."
            }
            className={`flex-1 p-2 rounded border resize-none transition-all ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            } ${connectionStatus === "error" ? "border-red-400" : ""}`}
            rows={2}
            disabled={isLoading || connectionStatus === "error"}
          />
          <button
            onClick={sendSmartMessage}
            disabled={
              isLoading || !inputMessage.trim() || connectionStatus === "error"
            }
            className={`px-4 py-2 rounded font-medium transition-colors ${
              isLoading || !inputMessage.trim() || connectionStatus === "error"
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
            title={shouldUseStreaming(inputMessage) ? "სტრიმინგ მოდი (რთული კითხვა)" : "სწრაფი მოდი (მარტივი კითხვა)"}
          >
            {isLoading ? "⏳" : shouldUseStreaming(inputMessage) ? "🌊" : "⚡"}
          </button>
        </div>
        {/* Connection Status */}
        <div className="flex justify-between items-center mt-2 text-xs">
          <span
            className={
              connectionStatus === "connected"
                ? "text-green-600"
                : connectionStatus === "error"
                  ? "text-red-600"
                  : "text-yellow-600"
            }
          >
            {connectionStatus === "connected"
              ? "🟢 კავშირი აქტიურია"
              : connectionStatus === "error"
                ? "🔴 კავშირი გაწყდა"
                : "🟡 შემოწმება..."}
          </span>
          <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
            Enhanced AI v2.0
          </span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default AIAssistantEnhanced;
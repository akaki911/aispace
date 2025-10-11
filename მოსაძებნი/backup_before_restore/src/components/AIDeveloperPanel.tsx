import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { systemCleanerService } from "../services/SystemCleanerService";
import ExplorerPanel from "./ExplorerPanel";
import AIMemoryManager from "./AIMemoryManager";
import {
  FolderOpen,
  MessageSquare,
  Terminal,
  Database,
  Settings,
  Sun,
  Moon,
  GitBranch,
} from "lucide-react";
// import ChatPanel from "./ChatPanel"; // Replaced with ReplitAssistantPanel
import ReplitAssistantPanel from "./ReplitAssistantPanel";
import { DevConsoleV2Container } from "../features/devconsole-v2/DevConsoleV2Container";
import { rateLimitManager } from "../utils/rateLimitHandler";
import { DevConsoleProvider } from "../context/DevConsoleContext";

// ===== INTERFACES (ONE COPY ONLY) =====
interface FileTreeItem {
  name: string;
  type: "file" | "directory";
  path: string;
  size: number;
  lastModified: string;
  extension?: string;
  children?: FileTreeItem[];
}

// SOL-203: Model Controls Interface
interface ModelControls {
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  model: 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile';
}

// SOL-203: Active Context Interface
interface ActiveContext {
  activeFile: {
    path: string;
    content: string;
    selection?: { start: number; end: number };
    language: string;
  } | null;
  lastEditedFiles: Array<{
    path: string;
    lastModified: string;
    preview: string;
  }>;
  consoleErrors: Array<{
    message: string;
    level: string;
    timestamp: string;
    source: string;
  }>;
  currentRoute: string;
}


interface LogEntry {
  id: string;
  type: "info" | "success" | "error" | "warning";
  source: "ai-service" | "backend" | "frontend" | "npm" | "system";
  message: string;
  timestamp: Date;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  port?: number;
  process?: string;
  hasUrl?: boolean;
  url?: string;
}


interface GitStatus {
  branch: string;
  lastCommit: string;
  hasChanges: boolean;
  changedFiles: number;
}

// ===== AI FETCH WRAPPER (ONE COPY ONLY) =====
const aiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = endpoint.startsWith('/') ? endpoint : `/api/ai/${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`AI Service Error (${url}):`, error);
    throw error;
  }
};


// ===== MAIN COMPONENT (ONE COPY ONLY) =====
const AIDeveloperPanel: React.FC = () => {
  const { user: authUser, isAuthenticated, authInitialized } = useAuth();

  // ===== INITIALIZATION STATE (FIXED) =====
  const [isInitializing, setIsInitializing] = useState(true);

  // Fix initialization bug: ensure isInitializing becomes false when auth is ready
  useEffect(() => {
    if (authInitialized) setIsInitializing(false);
  }, [authInitialized]);

  // ===== CORE STATE =====
  const [activeTab, setActiveTab] = useState<"explorer" | "chat" | "console" | "memory" | "settings" | "editor">("chat");
  const [userRole, setUserRole] = useState<string>("");

  // SOL-203: Model Controls State
  const [modelControls, setModelControls] = useState<ModelControls>({
    temperature: 0.2,
    maxTokens: 2200,
    topP: 0.9,
    presencePenalty: 0.0,
    model: 'llama-3.1-8b-instant'
  });

  // SOL-203: Active Context State
  const [activeContext, setActiveContext] = useState<ActiveContext>({
    activeFile: null,
    lastEditedFiles: [],
    consoleErrors: [],
    currentRoute: 'developer-panel'
  });

  // SOL-203: Telemetry State
  const [telemetryData, setTelemetryData] = useState({
    totalRequests: 0,
    averageLatency: 0,
    errorRate: 0,
    fallbackUsage: 0,
    lastUpdate: new Date().toISOString()
  });

  // Note: These states are now handled by ReplitAssistantPanel
  // const [assistantMode, setAssistantMode] = useState<'basic' | 'advanced'>('basic');
  // const [fileContext, setFileContext] = useState<string[]>([]);
  // const [showEditPreview, setShowEditPreview] = useState(false);
  // const [pendingEditRequest, setPendingEditRequest] = useState<any>(null);

  // ===== EXPLORER STATE (kept in parent for other tabs to access) =====
  const [tree, setTree] = useState<FileTreeItem[] | null>(null);

  // ===== FILE EXPLORER STATE =====
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    content: string;
    lastModified: string;
  } | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  // LSP Fix: removed unused treeErr state


  // ===== CONSOLE STATE =====
  const [, setConsoleLogs] = useState<LogEntry[]>([]);
  const [showOnlyLatest, setShowOnlyLatest] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // ===== MEMORY STATE =====
  // LSP Fix: removed unused memory state (managed in AIMemoryManager)

  // ===== SETTINGS STATE =====
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [cleanerEnabled, setCleanerEnabled] = useState(systemCleanerService.isCleaningEnabled());
  const [isCleaningNow, setIsCleaningNow] = useState(false);
  const [lastCleanup, setLastCleanup] = useState(systemCleanerService.getLastCleanupTime());

  // LSP Fix: removed unused refs (managed in child components)

  // ===== REQUEST INSPECTOR STATE (for ChatPanel) =====
  const [, setRequestInspector] = useState<any>(null);

  // ===== GIT STATUS =====
  const [gitStatus] = useState<GitStatus>({
    branch: "main",
    lastCommit: "a7b3c8d",
    hasChanges: true,
    changedFiles: 3,
  });

  // ===== ACCESS CHECK HYGIENE (no chat loading dependency) =====
  // Check if user should have access - enhanced logic
  const hasDevConsoleAccess = authUser && (
    authUser.personalId === "01019062020" || // Akaki Tsintsadze
    authUser.role === 'SUPER_ADMIN' ||
    authUser.id === "01019062020" || // Check user ID as well
    authUser.email === 'admin@bakhmaro.co' // Admin email fallback
  );

  // ===== AI SERVICE HEALTH =====
  const [aiServiceHealth, setAiServiceHealth] = useState<"ok" | "error" | "loading">("loading");

  const checkAiServiceHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/health");
      setAiServiceHealth(response.ok ? "ok" : "error");
    } catch (error) {
      setAiServiceHealth("error");
    }
  }, []);

  // ===== FILE OPERATIONS (wrappers for ExplorerPanel) =====
  const loadFile = useCallback(async (path: string) => {
    const response = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    if (data.success) {
      return { content: data.data.content };
    }
    throw new Error(data.error || "Failed to load file");
  }, []);

  const saveFile = useCallback(async (path: string, content: string) => {
    const response = await fetch(`/api/fs/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    return await response.json();
  }, []);

  const loadFileTree = useCallback(async () => {
    if (isTreeLoading) return;

    setIsTreeLoading(true);

    try {
      const response = await fetch("/api/fs/tree");
      const data = await response.json();

      if (data.success) {
        setTree(data.data || []);
      } else {
        console.error("Failed to load file tree:", data.error);
        setTree(null);
      }
    } catch (error: any) {
      console.error("File tree load error:", error.message);
      setTree(null);
    } finally {
      setIsTreeLoading(false);
    }
  }, []); // ✅ Removed isTreeLoading dependency to prevent infinite loop


  // ===== SETTINGS FUNCTIONS =====
  const handleManualCleanup = async () => {
    setIsCleaningNow(true);
    try {
      const stats = await systemCleanerService.performManualCleanup();
      setLastCleanup(new Date().toISOString());
      console.log("🧹 Manual cleanup completed:", stats);
      alert(`✅ გაწმენდა დასრულდა!\n${stats.cachesCleared} cache წაიშალა\n${stats.filesDeleted} ფაილი წაიშალა`);
    } catch (error) {
      console.error("🧹 Manual cleanup failed:", error);
      alert("❌ გაწმენდა ვერ მოხერხდა");
    } finally {
      setIsCleaningNow(false);
    }
  };

  const handleToggleCleaner = () => {
    const newState = !cleanerEnabled;
    setCleanerEnabled(newState);
    systemCleanerService.setCleaningEnabled(newState);
  };

  // ===== USER ROLE CHECK =====
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const result = await rateLimitManager.execute(
          "checkUserRole",
          async () => {
            const adminToken = localStorage.getItem("admin_token") || "admin_token_01019062020";

            const response = await fetch("/api/admin/auth/me", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
              },
              credentials: "include",
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response.json();
          },
          { maxRequests: 3, timeWindow: 60000 },
          300000,
        );

        setUserRole(result.role || "");
      } catch (error: any) {
        console.error("❌ Failed to check user role:", error.message);
        setUserRole("");
      }
    };

    checkUserRole();
  }, []);

  // ===== INITIALIZATION =====
  useEffect(() => {
    checkAiServiceHealth();
    loadFileTree();
  }, []); // ✅ Empty dependency array - run only once on mount

  // ===== SIDEBAR ITEMS =====
  const sidebarItems = [
    { key: "chat", icon: MessageSquare, label: "ჩატი", active: activeTab === "chat" },
    { key: "console", icon: Terminal, label: "კონსოლი", active: activeTab === "console" },
    { key: "explorer", icon: FolderOpen, label: "ფაილები", active: activeTab === "explorer" },
    { key: "memory", icon: Database, label: "მეხსიერება", active: activeTab === "memory" },
    { key: "settings", icon: Settings, label: "პარამეტრები", active: activeTab === "settings" },
  ];

  // ===== EARLY RETURNS FOR AUTH =====
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!hasDevConsoleAccess) {
    return (
      <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">🔒 წვდომა შეზღუდულია</h2>
          <p className="text-gray-400">ეს პანელი ხელმისაწვდომია მხოლოდ SUPER_ADMIN-ისთვის</p>
        </div>
      </div>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <DevConsoleProvider>
      <div className="h-screen w-full bg-[#0D1117] flex">
      {/* Sidebar */}
      <div className="w-16 bg-[#161B22] border-r border-gray-700 flex flex-col items-center py-4">
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key as any)}
            className={`p-3 rounded-lg mb-2 transition-colors ${
              item.active
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
            title={item.label}
          >
            <item.icon size={20} />
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#161B22] border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-white font-semibold">🤖 გურულო AI ასისტენტი</h1>
              <div className="flex items-center space-x-2 text-gray-400">
                <GitBranch className="w-4 h-4" />
                <span className="text-sm">{gitStatus.branch}</span>
                <span className="text-sm text-gray-500">#{gitStatus.lastCommit}</span>
                {gitStatus.hasChanges && (
                  <span className="text-sm text-orange-400">• {gitStatus.changedFiles} files</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${aiServiceHealth === "ok" ? "bg-green-500" : "bg-red-500"}`}></div>
              <span className="text-sm text-gray-400">
                AI Service {aiServiceHealth === "ok" ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {/* Chat Tab - Now using Replit-style Assistant */}
          {activeTab === "chat" && (
            <div className="h-full">
              <ReplitAssistantPanel
                currentFile={currentFile}
                aiFetch={aiFetch}
              />
            </div>
          )}

          {/* Console Tab */}
          {activeTab === "console" && (
            <div className="h-full">
              <DevConsoleV2Container />
            </div>
          )}

          {/* File Explorer Tab */}
          {activeTab === "explorer" && (
            <ExplorerPanel
              tree={tree ?? []}
              currentFile={currentFile}
              setCurrentFile={setCurrentFile}
              aiFetch={aiFetch}
              loadFile={loadFile}
              saveFile={saveFile}
            />
          )}

          {/* Memory Tab */}
          {activeTab === "memory" && (
            <div className="h-full">
              <AIMemoryManager />
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="h-full bg-[#0D1117] text-gray-300 p-4">
              <h3 className="text-white font-medium mb-4">პარამეტრები</h3>

              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">თემა</h4>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setIsDarkMode(true)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded ${
                        isDarkMode ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      <Moon size={16} />
                      <span>მუქი</span>
                    </button>
                    <button
                      onClick={() => setIsDarkMode(false)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded ${
                        !isDarkMode ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      <Sun size={16} />
                      <span>ღია</span>
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">კონსოლი</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                        className="rounded"
                      />
                      <span>ავტომატური სქროლი</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showOnlyLatest}
                        onChange={(e) => setShowOnlyLatest(e.target.checked)}
                        className="rounded"
                      />
                      <span>მხოლოდ უახლესი ლოგები</span>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">სისტემის გაწმენდა</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={cleanerEnabled}
                        onChange={handleToggleCleaner}
                        className="rounded"
                      />
                      <span>ავტომატური გაწმენდა</span>
                    </label>
                    <button
                      onClick={handleManualCleanup}
                      disabled={isCleaningNow}
                      className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded transition-colors"
                    >
                      {isCleaningNow ? "🧹 იწმინდება..." : "🧹 ხელით გაწმენდა"}
                    </button>
                    {lastCleanup && (
                      <p className="text-xs text-gray-400">
                        ბოლო გაწმენდა: {new Date(lastCleanup).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* SOL-203: Model Controls */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">🧠 AI Model პარამეტრები</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Temperature: {modelControls.temperature}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={modelControls.temperature}
                        onChange={(e) => setModelControls(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Max Tokens: {modelControls.maxTokens}</label>
                      <input
                        type="range"
                        min="2200"
                        max="4000"
                        step="100"
                        value={modelControls.maxTokens}
                        onChange={(e) => setModelControls(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Top P: {modelControls.topP}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={modelControls.topP}
                        onChange={(e) => setModelControls(prev => ({ ...prev, topP: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Model</label>
                      <select
                        value={modelControls.model}
                        onChange={(e) => setModelControls(prev => ({ ...prev, model: e.target.value as any }))}
                        className="w-full bg-gray-700 text-white rounded px-3 py-2"
                      >
                        <option value="llama-3.1-8b-instant">LLaMA 3.1 8B (Fast)</option>
                        <option value="llama-3.3-70b-versatile">LLaMA 3.3 70B (Powerful)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SOL-203: Telemetry Display */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">📊 Telemetry</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Requests:</span>
                      <span className="text-white">{telemetryData.totalRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Latency:</span>
                      <span className="text-white">{telemetryData.averageLatency}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Error Rate:</span>
                      <span className="text-white">{telemetryData.errorRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Fallback Usage:</span>
                      <span className="text-white">{telemetryData.fallbackUsage}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Last Update: {new Date(telemetryData.lastUpdate).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* SOL-203: Active Context Display */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">📝 Active Context</h4>
                  <div className="space-y-2 text-xs">
                    {activeContext.activeFile ? (
                      <div>
                        <span className="text-gray-400">Active File:</span>
                        <div className="text-white truncate">{activeContext.activeFile.path}</div>
                      </div>
                    ) : (
                      <div className="text-gray-500">No active file</div>
                    )}
                    <div>
                      <span className="text-gray-400">Recent Files:</span>
                      <div className="text-white">{activeContext.lastEditedFiles.length}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Console Errors:</span>
                      <div className="text-white">{activeContext.consoleErrors.length}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Current Route:</span>
                      <div className="text-white">{activeContext.currentRoute}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </DevConsoleProvider>
  );
};

export default AIDeveloperPanel;
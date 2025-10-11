// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { useUIErrorCapture } from "../../hooks/useUIErrorCapture";
import ActivityLog from "../ActivityLog";
import {
  Database,
  AlertCircle,
  TrendingUp,
  Activity,
  Eye,
  Brain,
  Code
} from "lucide-react";

// Import hooks
import { useMemorySync } from "../../hooks/memory/useMemorySync";
import { useErrorRegistry } from "../../hooks/memory/useErrorRegistry";
import { usePersonalInfo } from "../../hooks/memory/usePersonalInfo";
import { useStats } from "../../hooks/memory/useStats";

// Import components
import { PersonalInfoEditor } from "./PersonalInfoEditor";
import { StatsViewer } from "./StatsViewer";
import { ErrorRegistry } from "./ErrorRegistry";
import { RulesManager } from "./RulesManager";
import { ContextActions } from "./ContextActions";
import { CodePreferences } from "./CodePreferences";

// Compatible interfaces for the memory system
interface PersonalInfo {
  language: string;
  role: string;
  codeStyle: string;
  name?: string;
  age?: string;
  interests?: string;
  notes?: string;
  preferredLanguage?: "ka" | "en";
  programmingLanguages?: string[];
  currentProject?: string;
  openFiles?: string[];
}

interface MemoryData {
  personalInfo: PersonalInfo;
  savedRules: any[];
  errorLogs: any[];
  contextActions: any[];
  codePreferences: any[];
  stats: any;
}

// Original interfaces from AIMemoryManager.tsx
interface SavedRule {
  id: string;
  title: string;
  description: string;
  technicalTip: string;
  isActive: boolean;
  category: "coding" | "ui" | "performance" | "security" | "general";
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface ErrorLog {
  id: string;
  error: string;
  file: string;
  line?: number;
  timestamp: Date;
  resolved: boolean;
  solution?: string;
  stackTrace?: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface ContextAction {
  id: string;
  title: string;
  description: string;
  category: "file" | "rule" | "error" | "chat" | "system";
  action: string;
  timestamp: Date;
  isExecuted: boolean;
  result?: string;
}

interface CodePreference {
  id: string;
  name: string;
  type: "preferred" | "avoid";
  description: string;
  example?: string;
  category: "general" | "react" | "typescript" | "styling" | "performance";
  isActive: boolean;
}

const AIMemoryManager: React.FC = () => {
  const { user } = useAuth();
  const { captureError } = useUIErrorCapture();

  // Core hooks
  const { data: memoryData, setData: setMemoryData } = useMemorySync();
  const { registry: errorRegistry, remove: removeError, clearDupes } = useErrorRegistry();
  
  // Personal info with defaults
  const defaultPersonalInfo: PersonalInfo = {
    language: memoryData.personalInfo?.language || 'ka',
    role: memoryData.personalInfo?.role || 'developer',
    codeStyle: memoryData.personalInfo?.codeStyle || 'TypeScript',
    name: memoryData.personalInfo?.name || '',
    age: memoryData.personalInfo?.age || '',
    interests: memoryData.personalInfo?.interests || '',
    notes: memoryData.personalInfo?.notes || '',
    preferredLanguage: (memoryData.personalInfo?.preferredLanguage as "ka" | "en") || 'ka',
    programmingLanguages: memoryData.personalInfo?.programmingLanguages || [],
    currentProject: memoryData.personalInfo?.currentProject || '',
    openFiles: memoryData.personalInfo?.openFiles || []
  };

  const {
    personalInfo,
    editData: editPersonalData,
    isEditing: isEditingPersonal,
    setIsEditing: setIsEditingPersonal,
    setEditData: setEditPersonalData,
    savePersonalInfo
  } = usePersonalInfo(defaultPersonalInfo, (data) => {
    setMemoryData(prev => ({ ...prev, personalInfo: data }));
  });

  // Stats calculation
  const stats = {
    totalRules: (memoryData.savedRules || []).length,
    activeRules: (memoryData.savedRules || []).filter((r: any) => r.isActive).length,
    resolvedErrors: Array.from(errorRegistry.values()).filter((e: any) => e.resolved).length,
    totalActions: (memoryData.contextActions || []).length,
    accuracyRate: 85,
    memoryUsage: 2.4
  };

  // UI State - same as original
  const [activeTab, setActiveTab] = useState<
    "overview" | "rules" | "errors" | "actions" | "preferences" | "stats"
  >("overview");
  const [searchTerm] = useState('');
  const [selectedCategory] = useState<string>("all");
  const [selectedSeverity] = useState<string>('all');
  const [isLoading] = useState(false);

  // Rules state
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<SavedRule>>({
    title: "",
    description: "",
    technicalTip: "",
    category: "general",
  });

  // Preferences state
  const [showAddPreference, setShowAddPreference] = useState(false);
  const [newPreference, setNewPreference] = useState<Partial<CodePreference>>({
    name: "",
    type: "preferred",
    description: "",
    example: "",
    category: "general",
    isActive: true,
  });

  // Tab configuration - same as original
  const tabs = [
    { key: "overview", label: "მიმოხილვა", icon: Eye },
    { key: "rules", label: "წესები", icon: Brain },
    { key: "errors", label: "შეცდომები", icon: AlertCircle },
    { key: "actions", label: "მოქმედებები", icon: Activity },
    { key: "preferences", label: "პრეფერენსები", icon: Code },
    { key: "stats", label: "სტატისტიკა", icon: TrendingUp },
  ];

  // Placeholder handlers (same logic as original but simplified)
  const handleAddRule = () => {
    if (newRule.title && newRule.description) {
      const rule: SavedRule = {
        id: Date.now().toString(),
        title: newRule.title,
        description: newRule.description,
        technicalTip: newRule.technicalTip || "",
        isActive: true,
        category: newRule.category || "general",
        createdAt: new Date(),
        usageCount: 0,
      };
      setMemoryData(prev => ({
        ...prev,
        savedRules: [...prev.savedRules, rule]
      }));
      setNewRule({ title: "", description: "", technicalTip: "", category: "general" });
      setShowAddRule(false);
    }
  };

  const handleUpdateRule = (id: string, updates: Partial<SavedRule>) => {
    setMemoryData(prev => ({
      ...prev,
      savedRules: prev.savedRules.map(rule => 
        rule.id === id ? { ...rule, ...updates } : rule
      )
    }));
  };

  const handleDeleteRule = (id: string) => {
    setMemoryData(prev => ({
      ...prev,
      savedRules: prev.savedRules.filter(rule => rule.id !== id)
    }));
  };

  // Error handlers
  const handleUpdateError = (id: string, updates: Partial<ErrorLog>) => {
    setMemoryData(prev => ({
      ...prev,
      errorLogs: prev.errorLogs.map(error => 
        error.id === id ? { ...error, ...updates } : error
      )
    }));
  };

  const handleDeleteError = (id: string) => {
    removeError(id);
    setMemoryData(prev => ({
      ...prev,
      errorLogs: prev.errorLogs.filter(error => error.id !== id)
    }));
  };

  // Preference handlers
  const handleAddPreference = () => {
    if (newPreference.name && newPreference.description) {
      const preference: CodePreference = {
        id: Date.now().toString(),
        name: newPreference.name,
        type: newPreference.type || "preferred",
        description: newPreference.description,
        example: newPreference.example || "",
        category: newPreference.category || "general",
        isActive: newPreference.isActive ?? true,
      };
      setMemoryData(prev => ({
        ...prev,
        codePreferences: [...(Array.isArray(prev.codePreferences) ? prev.codePreferences : []), preference]
      }));
      setNewPreference({ name: "", type: "preferred", description: "", example: "", category: "general", isActive: true });
      setShowAddPreference(false);
    }
  };

  const handleUpdatePreference = (id: string, updates: Partial<CodePreference>) => {
    setMemoryData(prev => ({
      ...prev,
      codePreferences: (Array.isArray(prev.codePreferences) ? prev.codePreferences : []).map(pref => 
        pref.id === id ? { ...pref, ...updates } : pref
      )
    }));
  };

  const handleDeletePreference = (id: string) => {
    setMemoryData(prev => ({
      ...prev,
      codePreferences: (Array.isArray(prev.codePreferences) ? prev.codePreferences : []).filter(pref => pref.id !== id)
    }));
  };

  // Placeholder handlers for other operations
  const handleExportRules = () => {
    const blob = new Blob([JSON.stringify(memoryData.savedRules, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-memory-rules.json';
    a.click();
  };

  const handleImportRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setMemoryData(prev => ({ ...prev, savedRules: imported }));
        } catch (error) {
          captureError(error, 'handleImportRules');
        }
      };
      reader.readAsText(file);
    }
  };

  // Same exact UI structure as original AIMemoryManager.tsx
  return (
    <div className="h-full bg-[#0D1117] text-gray-300 overflow-auto">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-7xl mx-auto m-4">
        {/* Header - exact same as original */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="w-8 h-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">AI მეხსიერების მენეჯერი</h1>
                  <p className="text-blue-100">გახსოვილი ინფორმაციის მართვა</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-blue-100 text-sm">მომხმარებელი</p>
                  <p className="text-white font-medium">
                    {user?.displayName || user?.email || "Guest"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs - exact same as original */}
          <div className="border-b border-gray-700">
            <div className="flex space-x-1 p-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content - same structure, using new components */}
          <div className="p-4 space-y-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <PersonalInfoEditor
                  personalInfo={personalInfo}
                  editData={editPersonalData}
                  isEditing={isEditingPersonal}
                  setIsEditing={setIsEditingPersonal}
                  setEditData={setEditPersonalData}
                  onSave={savePersonalInfo}
                />
                <StatsViewer stats={stats} />
                <ActivityLog openFile={() => {}} />
              </div>
            )}

            {/* Rules Tab */}
            {activeTab === "rules" && (
              <RulesManager
                savedRules={memoryData.savedRules as SavedRule[]}
                searchTerm={searchTerm}
                selectedCategory={selectedCategory}
                showAddRule={showAddRule}
                newRule={newRule}
                isLoading={isLoading}
                onSetShowAddRule={setShowAddRule}
                onSetNewRule={setNewRule}
                onAddRule={handleAddRule}
                onUpdateRule={handleUpdateRule}
                onDeleteRule={handleDeleteRule}
                onExportRules={handleExportRules}
                onImportRules={handleImportRules}
              />
            )}

            {/* Errors Tab */}
            {activeTab === "errors" && (
              <ErrorRegistry
                errorLogs={Array.from(errorRegistry.values())}
                searchTerm={searchTerm}
                selectedSeverity={selectedSeverity}
                onUpdateError={handleUpdateError}
                onDeleteError={handleDeleteError}
                onClearDuplicates={clearDupes}
                onPurgeLogs={() => {
                  setMemoryData(prev => ({ ...prev, errorLogs: [] }));
                }}
              />
            )}

            {/* Actions Tab */}
            {activeTab === "actions" && (
              <ContextActions
                contextActions={memoryData.contextActions as ContextAction[]}
                onRunAction={(id) => console.log('Run action:', id)}
                onClearActions={() => {
                  setMemoryData(prev => ({ ...prev, contextActions: [] }));
                }}
              />
            )}

            {/* Preferences Tab */}
            {activeTab === "preferences" && (
              <CodePreferences
                codePreferences={Array.isArray(memoryData.codePreferences) ? memoryData.codePreferences : []}
                searchTerm={searchTerm}
                selectedCategory={selectedCategory}
                showAddPreference={showAddPreference}
                newPreference={newPreference}
                isLoading={isLoading}
                onSetShowAddPreference={setShowAddPreference}
                onSetNewPreference={setNewPreference}
                onAddPreference={handleAddPreference}
                onUpdatePreference={handleUpdatePreference}
                onDeletePreference={handleDeletePreference}
              />
            )}

            {/* Stats Tab */}
            {activeTab === "stats" && (
              <StatsViewer stats={stats} />
            )}
          </div>
        </div>
      </div>
    );
};

export default AIMemoryManager;
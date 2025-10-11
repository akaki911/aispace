import React, { useState, useRef } from 'react';
import {
  MessageSquare, Plus, Archive, Share2, Download, Copy,
  Search, MoreVertical, Trash2, Edit2, Users, 
  Code, BookOpen, Target, Heart, Upload, Settings, Info
} from 'lucide-react';

// ===== INTERFACES =====
export interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  formatted?: any;
  memoryIntegrated?: boolean;
  contextAware?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
  lastActivity: Date;
  messageCount: number;
  isArchived?: boolean;
  checkpoints?: any[];
  performance?: any;
  collaboration?: any;
  quality?: {
    avgResponseTime: number;
    accuracy: number;
    satisfaction: number;
    georgianSupport: number;
  };
  tags?: string[];
  favorite?: boolean;
}

export interface CodeSnippet {
  id: string;
  title: string;
  code: string;
  language: string;
  description: string;
  tags: string[];
  author: string;
  timestamp: Date;
  usage: number;
}

interface SessionSidebarProps {
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onCreateNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onDuplicateSession: (sessionId: string) => void;
  onExportSession: (sessionId: string) => void;
  onImportSessions: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onShareSession: (sessionId: string) => void;
  codeSnippets: CodeSnippet[];
  onExportCodeSnippet?: (code: string, language: string) => void;
  collaborationData?: {
    sessionSharing: {
      sharedSessions: string[];
      sharedWith: string[];
      accessLevel: 'read' | 'write' | 'admin';
    };
    teamMetrics: {
      sharedProblems: number;
      resolvedIssues: number;
      knowledgeContributions: number;
    };
  };
}

export default function SessionSidebar({
  chatSessions,
  currentSessionId,
  onSessionSelect,
  onCreateNewSession,
  onDeleteSession,
  onArchiveSession,
  onDuplicateSession,
  onExportSession,
  onImportSessions,
  onShareSession,
  codeSnippets,
  onExportCodeSnippet: _onExportCodeSnippet,
  collaborationData
}: SessionSidebarProps) {
  // ===== LOCAL STATE =====
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'message_count'>('recent');
  const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'shared'>('all');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'snippets' | 'collaboration'>('sessions');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== COMPUTED VALUES =====
  const filteredSessions = chatSessions
    .filter(session => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = session.title.toLowerCase().includes(query);
        const contentMatch = session.messages.some(msg => 
          msg.content.toLowerCase().includes(query)
        );
        if (!titleMatch && !contentMatch) return false;
      }
      
      // Archive filter
      if (!showArchived && session.isArchived) return false;
      if (showArchived && !session.isArchived) return false;
      
      // Category filter
      if (filterBy === 'favorites' && !session.favorite) return false;
      if (filterBy === 'shared' && !collaborationData?.sessionSharing.sharedSessions.includes(session.id)) return false;
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'message_count':
          return b.messageCount - a.messageCount;
        case 'recent':
        default:
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      }
    });

  const activeSessions = chatSessions.filter(s => !s.isArchived);
  const archivedSessions = chatSessions.filter(s => s.isArchived);
  const favoriteSessions = chatSessions.filter(s => s.favorite);

  // ===== HELPER FUNCTIONS =====
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return 'ახლახან';
    if (diffMinutes < 60) return `${diffMinutes} წუთის წინ`;
    if (diffHours < 24) return `${diffHours} საათის წინ`;
    if (diffDays < 7) return `${diffDays} დღის წინ`;
    
    return date.toLocaleDateString('ka-GE');
  };

  const getSessionQualityColor = (session: ChatSession): string => {
    if (!session.quality) return 'bg-gray-100';
    
    const avgQuality = (
      session.quality.accuracy + 
      session.quality.satisfaction + 
      session.quality.georgianSupport
    ) / 3;
    
    if (avgQuality >= 80) return 'bg-green-100 border-green-200';
    if (avgQuality >= 60) return 'bg-yellow-100 border-yellow-200';
    return 'bg-red-100 border-red-200';
  };

  const handleSessionTitleEdit = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const saveSessionTitle = () => {
    if (!editingSessionId || !editingTitle.trim()) return;
    
    // This would typically update the session in the parent component
    // For now, we'll just clear the editing state
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleBulkAction = (action: 'archive' | 'delete' | 'export') => {
    selectedSessions.forEach(sessionId => {
      switch (action) {
        case 'archive':
          onArchiveSession(sessionId);
          break;
        case 'delete':
          if (window.confirm('დარწმუნებული ხართ რომ გსურთ ამ სესიების წაშლა?')) {
            onDeleteSession(sessionId);
          }
          break;
        case 'export':
          onExportSession(sessionId);
          break;
      }
    });
    
    setSelectedSessions([]);
    setShowBulkActions(false);
  };

  // ===== RENDER HELPERS =====
  const SessionItem = ({ session }: { session: ChatSession }) => {
    const isSelected = selectedSessions.includes(session.id);
    const isActive = currentSessionId === session.id;
    const isShared = collaborationData?.sessionSharing.sharedSessions.includes(session.id);
    
    return (
      <div
        className={`
          relative p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer group
          ${isActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
          }
          ${isSelected ? 'ring-2 ring-purple-500' : ''}
          ${getSessionQualityColor(session)}
        `}
        onClick={() => showBulkActions ? toggleSessionSelection(session.id) : onSessionSelect(session.id)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            {showBulkActions && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSessionSelection(session.id)}
                className="rounded border-gray-300"
              />
            )}
            
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
            
            {editingSessionId === session.id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={saveSessionTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveSessionTitle()}
                className="flex-1 text-sm font-medium bg-transparent border-b border-blue-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {session.title}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {session.favorite && <Heart className="w-3 h-3 text-red-500 fill-current" />}
            {isShared && <Users className="w-3 h-3 text-blue-500" />}
            {session.isArchived && <Archive className="w-3 h-3 text-gray-400" />}
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Show context menu
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Meta Information */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {session.messageCount} messages
          </span>
          <span>{formatRelativeTime(session.lastActivity)}</span>
        </div>

        {/* Quality Indicators */}
        {session.quality && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-green-500"
                style={{
                  width: `${((session.quality.accuracy + session.quality.satisfaction) / 2)}%`
                }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {Math.round(session.quality.georgianSupport)}% 🇬🇪
            </span>
          </div>
        )}

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {session.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            {session.tags.length > 2 && (
              <span className="text-xs text-gray-400">
                +{session.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Context Menu Actions - Hidden by default */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 shadow-lg rounded-lg border p-1 z-10 hidden group-hover:block">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSessionTitleEdit(session.id, session.title);
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full text-left"
          >
            <Edit2 className="w-3 h-3" />
            გადარქმევა
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateSession(session.id);
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full text-left"
          >
            <Copy className="w-3 h-3" />
            კოპირება
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShareSession(session.id);
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full text-left"
          >
            <Share2 className="w-3 h-3" />
            გაზიარება
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExportSession(session.id);
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full text-left"
          >
            <Download className="w-3 h-3" />
            ექსპორტი
          </button>
          
          <hr className="my-1" />
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchiveSession(session.id);
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full text-left"
          >
            <Archive className="w-3 h-3" />
            {session.isArchived ? 'აღდგენა' : 'დაარქივება'}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('დარწმუნებული ხართ?')) {
                onDeleteSession(session.id);
              }
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-red-100 text-red-600 rounded w-full text-left"
          >
            <Trash2 className="w-3 h-3" />
            წაშლა
          </button>
        </div>
      </div>
    );
  };

  const CodeSnippetItem = ({ snippet }: { snippet: CodeSnippet }) => (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-sm">{snippet.title}</span>
        </div>
        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
          {snippet.language}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
        {snippet.description}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{snippet.usage} გამოყენება</span>
        <span>{formatRelativeTime(snippet.timestamp)}</span>
      </div>
      
      <div className="flex flex-wrap gap-1 mt-2">
        {snippet.tags.map(tag => (
          <span
            key={tag}
            className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 px-2 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Gurulo Sessions
          </h2>
          
          <div className="flex items-center gap-1">
            <button
              onClick={onCreateNewSession}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="ახალი სესია"
            >
              <Plus className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="სესიების იმპორტი"
            >
              <Upload className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className={`p-2 rounded-lg transition-colors ${
                showBulkActions 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="მასობრივი მოქმედებები"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['sessions', 'snippets', 'collaboration'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'sessions' && 'სესიები'}
              {tab === 'snippets' && 'კოდი'}
              {tab === 'collaboration' && 'გუნდი'}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      {activeTab === 'sessions' && (
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="სესიების ძებნა..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'alphabetical' | 'message_count')}
              className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-800"
            >
              <option value="recent">ბოლო აქტივობით</option>
              <option value="alphabetical">ანბანით</option>
              <option value="message_count">მესიჯების რაოდენობით</option>
            </select>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as 'all' | 'favorites' | 'shared')}
              className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-800"
            >
              <option value="all">ყველა</option>
              <option value="favorites">რჩეული</option>
              <option value="shared">გაზიარებული</option>
            </select>
            
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`p-1 rounded transition-colors ${
                showArchived 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={showArchived ? 'დაარქივებულის დამალვა' : 'დაარქივებულის ჩვენება'}
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
            <div className="text-center">
              <div className="font-bold text-blue-600">{activeSessions.length}</div>
              <div>აქტიური</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-600">{archivedSessions.length}</div>
              <div>დაარქივებული</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-red-600">{favoriteSessions.length}</div>
              <div>რჩეული</div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {showBulkActions && selectedSessions.length > 0 && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-700 dark:text-purple-300">
              არჩეულია: {selectedSessions.length}
            </span>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleBulkAction('archive')}
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                <Archive className="w-3 h-3" />
              </button>
              
              <button
                onClick={() => handleBulkAction('export')}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
              >
                <Download className="w-3 h-3" />
              </button>
              
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="p-4 space-y-3">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>სესიები ვერ მოიძებნა</p>
                <p className="text-xs">შექმენით ახალი სესია ან შეცვალეთ ფილტრები</p>
              </div>
            ) : (
              filteredSessions.map(session => (
                <SessionItem key={session.id} session={session} />
              ))
            )}
          </div>
        )}

        {/* Code Snippets Tab */}
        {activeTab === 'snippets' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">კოდის ნაწყვეტები</h3>
              <span className="text-xs text-gray-500">{codeSnippets.length} ნაწყვეტი</span>
            </div>
            
            {codeSnippets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>კოდის ნაწყვეტები არ არის</p>
                <p className="text-xs">ექსპორტირებული კოდი გამოჩნდება აქ</p>
              </div>
            ) : (
              codeSnippets.map(snippet => (
                <CodeSnippetItem key={snippet.id} snippet={snippet} />
              ))
            )}
          </div>
        )}

        {/* Collaboration Tab */}
        {activeTab === 'collaboration' && (
          <div className="p-4 space-y-4">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-2 text-blue-500" />
              <h3 className="font-medium mb-2">გუნდური თანამშრომლობა</h3>
            </div>
            
            {/* Team Metrics */}
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">გაზიარებული სესიები</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {collaborationData?.sessionSharing.sharedSessions.length || 0}
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">გადაწყვეტილი საკითხები</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {collaborationData?.teamMetrics.resolvedIssues || 0}
                </div>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">ცოდნის წვლილი</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {collaborationData?.teamMetrics.knowledgeContributions || 0}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>რჩევა:</strong> გაზიარეთ სესიები გუნდის წევრებთან ცოდნის გასაზიარებლად და 
                  კოლაბორაციისთვის.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={onImportSessions}
        className="hidden"
      />
    </div>
  );
}
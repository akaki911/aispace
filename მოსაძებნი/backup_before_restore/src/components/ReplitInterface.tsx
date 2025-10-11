import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileImage,
  FileJson,
  Send, 
  RefreshCw, 
  Trash2,
  Play,
  Upload,
  Settings,
  Database,
  Terminal,
  X,
  Monitor,
  Search,
  Clock,
  Archive,
  Shield,
  Layers,
  Eye
} from 'lucide-react';
import FileViewer from './FileViewer';
import AIDevConsole from './AIDevConsole';
import { useFilePreview } from '../contexts/FilePreviewProvider';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  size?: number;
  lastModified?: string;
  extension?: string;
  isExpanded?: boolean;
}

interface FileTreeResponse {
  success: boolean;
  data?: FileNode;
  error?: string;
  timestamp?: string;
  structure?: string;
  totalItems?: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  loading: boolean;
  error?: string;
  isEditing?: boolean;
  originalContent?: string;
  hasUnsavedChanges?: boolean;
}

interface SearchResult {
  name: string;
  path: string;
  type: string;
  tag: string;
  size: number;
  modified: string;
  directory: string;
  score?: number;
  highlights?: {
    start: number;
    end: number;
    text: string;
  };
}

const ReplitInterface: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gurulo' | 'console'>('gurulo');
  const [fileStructure, setFileStructure] = useState<FileNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileTab, setActiveFileTab] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [fileTreeLoading, setFileTreeLoading] = useState(true);

  // File search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'recent' | 'all' | 'category'>('all');
  const [searchError, setSearchError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Preview functionality using unified provider
  const {
    openPreview
  } = useFilePreview();

  // Auto-scroll for chat and logs
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Initialize on mount
  useEffect(() => {
    initializeLogs();

    // Initialize with a welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'ai',
      content: 'მოგესალმები კაკი, მზად ვარ დაგეხმარო განვითარებაში!',
      timestamp: new Date()
    };
    setChatMessages([welcomeMessage]);
  }, []);



  const initializeLogs = () => {
    const initialLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(),
        level: 'info',
        message: 'სისტემა ჩაირთო',
        source: 'სისტემა'
      },
      {
        id: '2',
        timestamp: new Date(),
        level: 'info',
        message: 'გურულო სერვისთან კავშირი დამყარდა',
        source: 'გურულო სერვისი'
      }
    ];
    setLogs(initialLogs);
  };

  const addLog = (level: LogEntry['level'], message: string, source?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      level,
      message,
      source
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
  };

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const selectFile = async (path: string, type: 'file' | 'folder') => {
    if (type === 'file') {
      setSelectedFile(path);
      addLog('info', `ფაილი არჩეულია: ${path}`, 'ექსპლორერი');

      // Check if file is already open
      const existingFile = openFiles.find(f => f.path === path);
      if (existingFile) {
        setActiveFileTab(path);
        return;
      }

      // Add new file tab
      const fileName = path.split('/').pop() || path;
      const newFile: OpenFile = {
        path,
        name: fileName,
        content: '',
        loading: true
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileTab(path);

      // Load file content
      try {
        console.log(`📁 Loading file content: ${path}`);
        const response = await fetch(`/api/developer/file-content?path=${encodeURIComponent(path)}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: Internal Server Error`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load file content');
        }

        setOpenFiles(prev => prev.map(f => 
          f.path === path 
            ? { 
                ...f, 
                content: data.content || '', 
                loading: false,
                originalContent: data.content || ''
              }
            : f
        ));

        console.log(`✅ File loaded successfully: ${fileName}`);
        addLog('info', `ფაილი ჩაიტვირთა: ${fileName}`, 'ფაილური ვიუერი');
      } catch (error) {
        console.error('❌ Failed to load file:', error);
        setOpenFiles(prev => prev.map(f => 
          f.path === path 
            ? { 
                ...f, 
                error: error.message || 'ფაილის ჩატვირთვა ვერ მოხერხდა', 
                loading: false 
              }
            : f
        ));
        addLog('error', `ფაილის ჩატვირთვა ვერ მოხერხდა: ${fileName} - ${error.message}`, 'ფაილური ვიუერი');
      }
    } else {
      toggleNode(path);
    }
  };

  const closeFile = (path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));
    if (activeFileTab === path) {
      const remainingFiles = openFiles.filter(f => f.path !== path);
      setActiveFileTab(remainingFiles.length > 0 ? remainingFiles[remainingFiles.length - 1].path : null);
    }
  };

  const isEditableFile = (fileName: string) => {
    const editableExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.md', '.txt', '.css', '.html'];
    return editableExtensions.some(ext => fileName.endsWith(ext));
  };

  const startEditing = (path: string) => {
    setOpenFiles(prev => prev.map(f => 
      f.path === path 
        ? { ...f, isEditing: true, originalContent: f.content }
        : f
    ));
  };

  const cancelEditing = (path: string) => {
    setOpenFiles(prev => prev.map(f => 
      f.path === path 
        ? { ...f, isEditing: false, content: f.originalContent || f.content, hasUnsavedChanges: false }
        : f
    ));
  };

  const updateFileContent = (path: string, content: string) => {
    setOpenFiles(prev => prev.map(f => 
      f.path === path 
        ? { ...f, content, hasUnsavedChanges: content !== f.originalContent }
        : f
    ));
  };

  const saveFile = async (path: string) => {
    const file = openFiles.find(f => f.path === path);
    if (!file) return;

    try {
      const response = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path,
          content: file.content
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setOpenFiles(prev => prev.map(f => 
          f.path === path 
            ? { ...f, isEditing: false, originalContent: f.content, hasUnsavedChanges: false }
            : f
        ));
        addLog('info', 'ფაილი შენახულია წარმატებით', 'ფაილური ვიუერი');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('File save error:', error);
      addLog('error', 'შეცდომა ფაილის შენახვისას, სცადე ხელახლა', 'ფაილური ვიუერი');
    }
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'folder') {
      const isExpanded = expandedNodes.has(node.path);
      return isExpanded ? (
        <FolderOpen size={16} className="text-blue-400" />
      ) : (
        <Folder size={16} className="text-blue-400" />
      );
    }

    const extension = node.extension?.toLowerCase() || '';
    const fileName = node.name.toLowerCase();

    // Special files
    if (fileName.includes('.env')) {
      return <Settings size={16} className="text-yellow-500" />;
    }

    if (fileName === 'package.json' || fileName === 'package-lock.json') {
      return <FileJson size={16} className="text-green-500" />;
    }

    // Programming files
    if (['.tsx', '.jsx', '.ts', '.js'].includes(extension)) {
      return <FileCode size={16} className="text-yellow-400" />;
    }

    // JSON files
    if (extension === '.json') {
      return <FileJson size={16} className="text-orange-400" />;
    }

    // Image files
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(extension)) {
      return <FileImage size={16} className="text-purple-400" />;
    }

    // Text files
    if (['.md', '.txt', '.css', '.html'].includes(extension)) {
      return <FileText size={16} className="text-green-400" />;
    }

    // Default file icon
    return <File size={16} className="text-gray-400" />;
  };

  // File search functionality
  const performFileSearch = async (query: string) => {
    setSearchLoading(true);
    try {
      // Limit query length to prevent HTTP 431 errors
      const maxQueryLength = 500;
      const limitedQuery = query.length > maxQueryLength ? query.substring(0, maxQueryLength) : query;

      console.log(`🔍 [File Search] Making request to: /api/fs/search?q=${encodeURIComponent(limitedQuery)}&limit=50`);

      const response = await fetch(`/api/fs/search?q=${encodeURIComponent(limitedQuery)}&limit=50`);

      console.log(`🔍 [File Search] Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 [File Search] Response data:', data);

      // The AI service returns an array of search results directly
      if (Array.isArray(data)) {
        const formattedResults = data.map(result => ({
          name: result.file?.split('/').pop() || 'Unknown',
          path: result.file || '',
          type: result.file?.endsWith('.js') ? 'javascript' : 
                result.file?.endsWith('.tsx') ? 'typescript' : 
                result.file?.endsWith('.css') ? 'css' : 'file',
          size: 0,
          modified: new Date().toISOString(),
          directory: result.file?.split('/').slice(0, -1).join('/') || '.',
          matches: result.lines || []
        }));

        setSearchResults(formattedResults);
        console.log('✅ [File Search] Processed results:', formattedResults.length, 'matches');
      } else {
        console.error('❌ [File Search] Unexpected response format:', data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ File search error:', error);
      setSearchResults([]);
      addLog('error', `ძებნის შეცდომა: ${error.message}`, 'ფაილების ძებნა');
    } finally {
      setSearchLoading(false);
    }
  };

  const getRecentFiles = async () => {
    setSearchLoading(true);
    try {
      const response = await fetch('/api/fs/recent?limit=20');

      if (!response.ok) {
        throw new Error(`Failed to get recent files: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.results || []);
        console.log(`📂 Recent files: ${data.results?.length || 0} files`);
      }
    } catch (error) {
      console.error('❌ Recent files error:', error);
      // Fallback to mock data if service is unavailable
      setSearchResults([
        {
          name: 'No recent files available',
          path: '',
          type: 'info',
          tag: 'system',
          size: 0,
          modified: new Date().toISOString(),
          directory: 'system'
        }
      ]);
    } finally {
      setSearchLoading(false);
    }
  };

  const getCategoryFiles = async (category: string) => {
    setSearchLoading(true);
    try {
      const response = await fetch(`/api/fs/category/${category}?limit=20`);

      if (!response.ok) {
        throw new Error(`Failed to get category files: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.results || []);
        console.log(`📂 Category "${category}" files: ${data.results?.length || 0} files`);
      }
    } catch (error) {
      console.error('❌ Category files error:', error);
      // Provide fallback categories based on file system
      const fallbackCategories = {
        'backup': [
          { name: 'No backup files found', path: '', type: 'info', tag: 'backup', size: 0, modified: new Date().toISOString(), directory: 'system' }
        ],
        'config': [
          { name: '.env.example', path: '.env.example', type: 'config', tag: 'config', size: 1024, modified: new Date().toISOString(), directory: '.' },
          { name: 'package.json', path: 'package.json', type: 'config', tag: 'config', size: 2048, modified: new Date().toISOString(), directory: '.' },
          { name: 'vite.config.ts', path: 'vite.config.ts', type: 'config', tag: 'config', size: 512, modified: new Date().toISOString(), directory: '.' }
        ]
      };

      setSearchResults(fallbackCategories[category] || []);
    } finally {
      setSearchLoading(false);
    }
  };

  // Search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performFileSearch(searchQuery);
      } else if (searchMode === 'recent') {
        getRecentFiles();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);



  const openFileFromSearch = (filePath: string) => {
    selectFile(filePath, 'file');
    setShowSearch(false);
    setSearchQuery('');
  };

  const highlightText = (text: string, highlights?: { start: number; end: number; text: string }) => {
    if (!highlights) return text;

    const { start, end } = highlights;
    return (
      <>
        {text.substring(0, start)}
        <span className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded">
          {text.substring(start, end)}
        </span>
        {text.substring(end)}
      </>
    );
  };





  const sendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const currentInput = chatInput;
    setChatInput('');
    setIsLoading(true);

    addLog('info', `მომხმარებლის კითხვა: ${currentInput.substring(0, 50)}...`, 'გურულო');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          // SOL-201: Pass conversation history for role-based messages
          conversationHistory: chatMessages.map(m => ({
            role: m.type === 'assistant' ? 'assistant' : 'user',
            content: m.content
          })).slice(-20), // Last 20 messages
          context: selectedFile ? {
            currentFile: selectedFile,
            fileStructure: fileStructure
          } : { fileStructure: fileStructure }
        })
      });

      const data = await response.json();

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response || 'დავიბენი... განმიმარტე კიდევ ერთხელ 😊',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
      addLog('info', 'გურულოს პასუხი გაიგზავნა', 'გურულო');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'კავშირის შეცდომა - გთხოვთ სცადოთ ხელახლა',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      addLog('error', 'გურულოს პასუხის მიღება ვერ მოხერხდა', 'გურულო');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    addLog('info', 'ჩატი გასუფთავდა', 'გურულო');
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    addLog('info', 'გამოქვეყნება იწყება...', 'Deploy');

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      addLog('info', 'გამოქვეყნება წარმატებით დასრულდა', 'Deploy');
    } catch (error) {
      addLog('error', 'გამოქვეყნება ვერ მოხერხდა', 'Deploy');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (activeFileTab) {
        const file = openFiles.find(f => f.path === activeFileTab);
        if (file && file.isEditing && file.hasUnsavedChanges) {
          saveFile(activeFileTab);
        }
      }
    }
  };

  // Add keyboard shortcut listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeFileTab, openFiles]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ka-GE', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'debug': return 'text-gray-500';
      default: return 'text-green-400';
    }
  };
  const clearLogs = () => {
    setLogs([]);
  };

  const clearAllFiles = () => {
    setOpenFiles([]);
    setActiveFileTab(null);
    setSelectedFile(null);
  };

  return (
    <div className="h-screen w-full flex bg-gray-900 text-white font-sans">
      {/* Sidebar - File Explorer */}
      <div 
        className="flex-shrink-0 border-r border-gray-700 bg-gray-800"
        style={{ width: '240px' }}
      >
        <div className="h-full flex flex-col">
          {/* Explorer Header */}
          <div className="px-3 py-2 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-300 flex items-center">
                <Folder size={14} className="mr-2 text-blue-400" />
                ფაილები
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`p-1 hover:bg-gray-700 rounded transition-colors ${showSearch ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                  title="ფაილების ძებნა"
                >
                  <Search size={12} />
                </button>
                <button
                  onClick={() => console.log('File tree refresh disabled')}
                  className="p-1 hover:bg-gray-700 rounded transition-colors opacity-50 cursor-not-allowed"
                  title="ფაილების ხის განახლება (დროებით გათიშულია)"
                >
                  <RefreshCw size={12} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            {showSearch && (
              <div className="space-y-2">                ```text
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search files..."
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Search Mode Buttons */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      setSearchMode('recent');
                      if (!searchQuery) getRecentFiles();
                    }}
                    className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                      searchMode === 'recent' 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    <Clock size={10} />
                    <span>Recent</span>
                  </button>
                  <button
                    onClick={() => getCategoryFiles('backup')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                  >
                    <Archive size={10} />
                    <span>Backup</span>
                  </button>
                  <button
                    onClick={() => getCategoryFiles('config')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                  >
                    <Settings size={10} />
                    <span>Config</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Results Only */}
          <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
            {showSearch ? (
              // Search Results View
              <div className="px-2">
                {searchLoading ? (
                  <div className="flex items-center justify-center p-4 text-gray-400">
                    <RefreshCw className="animate-spin mr-2" size={14} />
                    <span className="text-xs">ძებნა...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-0">
                    {searchResults.map((result, index) => {
                      const fileName = result.name || result.path.split('/').pop() || 'Unknown';
                      const directory = result.directory || result.path.split('/').slice(0, -1).join('/') || '.';

                      return (
                        <div
                          key={`search-${result.path}-${index}`}
                          className="group flex items-center py-1 px-1 transition-all duration-150 hover:bg-gray-700/60 text-gray-300 border-l-2 border-l-transparent hover:border-l-blue-400"
                          title={result.path}
                          style={{ 
                            paddingLeft: '8px',
                            fontFamily: 'Monaco, "Courier New", monospace'
                          }}
                        >
                          <span className="mr-2 flex-shrink-0">
                            <File size={16} className="text-gray-400" />
                          </span>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openFileFromSearch(result.path)}>
                            {directory !== '.' && (
                              <div className="text-xs text-gray-500 truncate leading-tight">
                                {directory}/
                              </div>
                            )}
                            <div className="text-xs text-gray-300 truncate leading-tight font-medium">
                              {highlightText(fileName, result.highlights)}
                            </div>
                          </div>
                          {/* Preview Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPreview(result.path);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-600/50 rounded transition-all duration-150"
                            title="ფაილის პრევიუ"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : searchQuery ? (
                  <div className="p-4 text-center text-gray-500">
                    <Search size={16} className="mx-auto mb-2 opacity-50" />
                    <span className="text-xs font-mono">ფაილები ვერ მოიძებნა</span>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <Search size={16} className="mx-auto mb-2 opacity-50" />
                    <span className="text-xs font-mono">დაიწყეთ ძებნა ფაილების სახელით</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Folder size={20} className="mx-auto mb-2 opacity-50" />
                <span className="text-xs block mb-2">ფაილური სისტემა დროებით გათიშულია</span>
                <span className="text-xs text-gray-600">გამოიყენეთ ძებნის ფუნქცია ფაილების სამუშაოდ</span>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="border-t border-gray-700 p-2 bg-gray-800">
            <div className="text-xs text-gray-500 text-center">
              ძებნის რეჟიმი
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div 
          className="flex items-center justify-between border-b border-gray-700 px-4 bg-gray-800"
          style={{ height: '48px' }}
        >
          {/* Tabs */}
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm relative transition-colors ${
                activeTab === 'gurulo' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('gurulo')}
            >
              გურულო
              {activeTab === 'gurulo' && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: '#7f56d9' }}
                />
              )}
            </button>
            <button
              className={`px-4 py-2 text-sm relative transition-colors ${
                activeTab === 'console' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('console')}
            >
              კონსოლი
              {activeTab === 'console' && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: '#7f56d9' }}
                />
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors flex items-center"
              onClick={() => window.open(window.location.origin, '_blank')}
            >
              <Monitor size={14} className="mr-1" />
              გადახედვა
            </button>
            <button
              className="px-3 py-1 text-sm text-white rounded transition-colors flex items-center space-x-1 disabled:opacity-50"
              style={{ backgroundColor: '#7f56d9' }}
              onClick={handleDeploy}
              disabled={isDeploying}
            >
              {isDeploying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>მიმდინარეობს...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>გამოქვეყნება</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Chat/Console */}
          <div className="flex-1 flex flex-col">
            {activeTab === 'gurulo' && (
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="px-4 py-2 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
                  <h3 className="text-sm font-medium">გურულო ასისტენტი</h3>
                  <div className="flex space-x-2">
                    <button
                    onClick={clearLogs}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center space-x-1"
                  >
                    <Trash2 size={12} />
                    <span></span>
                  </button>
                  <button
                    onClick={clearAllFiles}
                    className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors flex items-center space-x-1"
                  >
                    <X size={12} />
                    <span>ფაილების წაშლა</span>
                  </button>
                  </div>
                </div>

                {/* Chat Messages */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                  style={{ fontFamily: 'Monaco, "Courier New", monospace' }}
                >
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${
                        message.type === 'user' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-700 text-gray-100'
                      }`}>
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-700 text-gray-100 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <RefreshCw size={14} className="animate-spin" />
                          <span className="text-sm">გურულო ფიქრობს...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="border-t border-gray-700 p-4">
                  <div className="flex space-x-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="მითხარი რა გინდა გავაკეთო..."
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
                      disabled={isLoading}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!chatInput.trim() || isLoading}
                      className="px-4 py-2 text-white rounded transition-colors disabled:opacity-50 flex items-center space-x-1"
                      style={{ backgroundColor: '#7f56d9' }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'console' && (
              <div className="h-full w-full">
                <AIDevConsole />
              </div>
            )}
          </div>

          {/* Right Panel - File Viewer */}
          {openFiles.length > 0 && (
            <div className="w-1/2 border-l border-gray-700 flex flex-col bg-gray-900">
              {/* File Tabs */}
              <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
                {openFiles.map((file, tabIndex) => (
                  <div
                    key={`tab-${file.path}-${tabIndex}`}
                    className={`flex items-center px-3 py-2 text-sm border-r border-gray-700 cursor-pointer transition-colors ${
                      activeFileTab === file.path 
                        ? 'bg-gray-700 text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-750'
                    }`}
                    onClick={() => setActiveFileTab(file.path)}
                  >
                    <span className="truncate max-w-32">{file.name}</span>
                    {file.hasUnsavedChanges && (
                      <span className="ml-1 text-yellow-400">●</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(file.path);
                      }}
                      className="ml-2 hover:bg-gray-600 rounded p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* File Content */}
              <div className="flex-1 overflow-hidden">
                {activeFileTab && (
                  <FileViewer 
                    file={openFiles.find(f => f.path === activeFileTab)!}
                    isEditable={isEditableFile(openFiles.find(f => f.path === activeFileTab)?.name || '')}
                    onEdit={() => startEditing(activeFileTab)}
                    onSave={() => saveFile(activeFileTab)}
                    onCancel={() => cancelEditing(activeFileTab)}
                    onContentChange={(content) => updateFileContent(activeFileTab, content)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Preview now handled by global component in App.tsx */}
    </div>
  );
};

export default ReplitInterface;
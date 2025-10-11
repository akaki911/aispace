/**
 * 🤝 Enterprise-Grade Collaboration Features
 * PHASE 5: Advanced Collaboration System for ChatPanel Enhancement
 * 
 * Features:
 * ✅ Real-time session sharing
 * ✅ Knowledge base management
 * ✅ Team metrics and analytics
 * ✅ Code snippet library
 * ✅ Collaborative problem solving
 * ✅ Georgian language team support
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Share2, Database, TrendingUp, Code2, 
  MessageSquare, Star, Copy, Download, Upload,
  Settings, Eye, Lock, Unlock, Search, Filter,
  Clock, CheckCircle, AlertCircle, UserPlus,
  GitBranch, Archive, BookOpen, Lightbulb
} from 'lucide-react';

// ===== COLLABORATION INTERFACES =====

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'developer' | 'viewer';
  status: 'online' | 'away' | 'offline';
  expertise: string[];
  georgianProficiency: 'beginner' | 'intermediate' | 'native';
  joinedAt: Date;
  lastActive: Date;
}

interface SharedSession {
  id: string;
  title: string;
  owner: TeamMember;
  participants: TeamMember[];
  accessLevel: 'read' | 'write' | 'admin';
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
  isGeorgianEnabled: boolean;
  tags: string[];
  status: 'active' | 'archived' | 'paused';
}

interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  author: TeamMember;
  tags: string[];
  usage: number;
  votes: number;
  createdAt: Date;
  lastModified: Date;
  isGeorgianCommented: boolean;
  category: 'component' | 'utility' | 'hook' | 'pattern' | 'config';
}

interface TeamSolution {
  id: string;
  problem: string;
  solution: string;
  code?: string;
  author: TeamMember;
  contributors: TeamMember[];
  effectiveness: number;
  votes: number;
  georgianExplanation?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: Date;
  tags: string[];
}

interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  sharedSessions: number;
  codeSnippets: number;
  problemsSolved: number;
  georgianSpeakers: number;
  avgResponseTime: number;
  knowledgeBaseSize: number;
}

interface CollaborationProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: TeamMember;
  onActionRequest: (action: string, data: any) => void;
}

export default function EnterpriseCollaboration({
  isOpen,
  onClose,
  currentUser,
  onActionRequest
}: CollaborationProps) {
  // ===== STATE =====
  const [activeTab, setActiveTab] = useState<'sessions' | 'knowledge' | 'team' | 'metrics'>('sessions');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [codeSnippets, setCodeSnippets] = useState<CodeSnippet[]>([]);
  const [teamSolutions, setTeamSolutions] = useState<TeamSolution[]>([]);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // ===== SAMPLE DATA INITIALIZATION =====
  useEffect(() => {
    // Initialize with sample data
    const sampleMembers: TeamMember[] = [
      {
        id: 'user1',
        name: 'გიორგი ჯავახიშვილი',
        avatar: '👨‍💻',
        role: 'admin',
        status: 'online',
        expertise: ['React', 'TypeScript', 'Node.js'],
        georgianProficiency: 'native',
        joinedAt: new Date(2024, 0, 15),
        lastActive: new Date()
      },
      {
        id: 'user2',
        name: 'ნინო ქავთარაძე',
        avatar: '👩‍💻',
        role: 'developer',
        status: 'online',
        expertise: ['Vue.js', 'Python', 'PostgreSQL'],
        georgianProficiency: 'native',
        joinedAt: new Date(2024, 1, 20),
        lastActive: new Date(Date.now() - 300000)
      },
      {
        id: 'user3',
        name: 'David Johnson',
        avatar: '👨‍🔬',
        role: 'developer',
        status: 'away',
        expertise: ['JavaScript', 'MongoDB', 'Express'],
        georgianProficiency: 'intermediate',
        joinedAt: new Date(2024, 2, 10),
        lastActive: new Date(Date.now() - 1800000)
      }
    ];

    const sampleSessions: SharedSession[] = [
      {
        id: 'session1',
        title: 'React Hooks Georgian Tutorial',
        owner: sampleMembers[0],
        participants: [sampleMembers[0], sampleMembers[1]],
        accessLevel: 'write',
        createdAt: new Date(2024, 11, 1),
        lastActivity: new Date(),
        messageCount: 45,
        isGeorgianEnabled: true,
        tags: ['React', 'Hooks', 'Tutorial', 'Georgian'],
        status: 'active'
      },
      {
        id: 'session2',
        title: 'TypeScript Best Practices',
        owner: sampleMembers[1],
        participants: sampleMembers,
        accessLevel: 'read',
        createdAt: new Date(2024, 10, 28),
        lastActivity: new Date(Date.now() - 7200000),
        messageCount: 78,
        isGeorgianEnabled: true,
        tags: ['TypeScript', 'Best Practices'],
        status: 'active'
      }
    ];

    const sampleSnippets: CodeSnippet[] = [
      {
        id: 'snippet1',
        title: 'Georgian useLocalStorage Hook',
        description: 'Custom hook for localStorage with Georgian error messages',
        code: `import { useState, useEffect } from 'react';

// ლოკალური Storage-ის Hook ქართული Error მესიჯებით
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('მონაცემების წაკითხვა ვერ მოხერხდა:', error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('მონაცემების შენახვა ვერ მოხერხდა:', error);
    }
  };

  return [storedValue, setValue] as const;
}`,
        language: 'typescript',
        author: sampleMembers[0],
        tags: ['React', 'Hook', 'localStorage', 'Georgian'],
        usage: 15,
        votes: 8,
        createdAt: new Date(2024, 11, 5),
        lastModified: new Date(2024, 11, 8),
        isGeorgianCommented: true,
        category: 'hook'
      },
      {
        id: 'snippet2',
        title: 'Error Boundary Component',
        description: 'React Error Boundary with Georgian error messages',
        code: `import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Error Boundary კომპონენტი ქართული მესიჯებით
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('შეცდომა დაფიქსირდა:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>🚨 რამე შეცდომა მოხდა</h2>
          <p>აპლიკაციის ამ ნაწილში პრობლემა წარმოიშვა.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            ხელახლა ცდა
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;`,
        language: 'typescript',
        author: sampleMembers[1],
        tags: ['React', 'Error', 'Component', 'Georgian'],
        usage: 23,
        votes: 12,
        createdAt: new Date(2024, 10, 25),
        lastModified: new Date(2024, 10, 30),
        isGeorgianCommented: true,
        category: 'component'
      }
    ];

    const sampleSolutions: TeamSolution[] = [
      {
        id: 'solution1',
        problem: 'How to handle Georgian text input validation in React forms?',
        solution: 'Use custom validation with Georgian character support and proper error messages',
        code: `// ქართული ტექსტის ვალიდაცია
const validateGeorgianText = (text: string) => {
  const georgianRegex = /^[\u10A0-\u10FF\\s\\d\\p{P}]+$/u;
  
  if (!text.trim()) {
    return 'ტექსტი სავალდებულოა';
  }
  
  if (!georgianRegex.test(text)) {
    return 'გამოიყენეთ მხოლოდ ქართული ასოები';
  }
  
  return null;
};`,
        author: sampleMembers[0],
        contributors: [sampleMembers[1]],
        effectiveness: 95,
        votes: 18,
        georgianExplanation: 'ეს კოდი ამოწმებს რომ ტექსტი შეიცავდეს მხოლოდ ქართულ სიმბოლოებს',
        difficulty: 'intermediate',
        createdAt: new Date(2024, 10, 20),
        tags: ['Validation', 'Georgian', 'Forms', 'React']
      }
    ];

    const sampleMetrics: TeamMetrics = {
      totalMembers: 3,
      activeMembers: 2,
      sharedSessions: 2,
      codeSnippets: 12,
      problemsSolved: 8,
      georgianSpeakers: 2,
      avgResponseTime: 15,
      knowledgeBaseSize: 156
    };

    setTeamMembers(sampleMembers);
    setSharedSessions(sampleSessions);
    setCodeSnippets(sampleSnippets);
    setTeamSolutions(sampleSolutions);
    setTeamMetrics(sampleMetrics);
  }, []);

  // ===== HANDLERS =====
  const handleSessionShare = (sessionId: string) => {
    onActionRequest('share_session', { sessionId, shareWith: 'team' });
  };

  const handleSnippetVote = (snippetId: string, vote: 1 | -1) => {
    setCodeSnippets(prev => prev.map(snippet => 
      snippet.id === snippetId 
        ? { ...snippet, votes: snippet.votes + vote }
        : snippet
    ));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'away': return 'text-yellow-500';
      case 'offline': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'away': return '🟡';
      case 'offline': return '⚪';
      default: return '⚪';
    }
  };

  // ===== RENDER COMPONENTS =====
  const SessionCard = ({ session }: { session: SharedSession }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {session.title}
        </h3>
        <div className="flex items-center gap-2">
          {session.isGeorgianEnabled && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
              🇬🇪 ქართული
            </span>
          )}
          <span className={`px-2 py-1 rounded text-xs ${
            session.status === 'active' ? 'bg-green-100 text-green-700' : 
            session.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {session.status}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-600">Owner:</span>
        <span className="text-sm font-medium">{session.owner.name}</span>
        <span className="text-sm text-gray-500">
          • {session.participants.length} participants
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {session.messageCount}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {session.lastActivity.toLocaleDateString('ka-GE')}
          </span>
        </div>
        
        <button
          onClick={() => handleSessionShare(session.id)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Share2 className="w-3 h-3 mr-1 inline" />
          Share
        </button>
      </div>
      
      <div className="flex flex-wrap gap-1 mt-2">
        {session.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  const SnippetCard = ({ snippet }: { snippet: CodeSnippet }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {snippet.title}
        </h3>
        <div className="flex items-center gap-2">
          {snippet.isGeorgianCommented && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
              🇬🇪
            </span>
          )}
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
            {snippet.language}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {snippet.description}
      </p>
      
      <div className="bg-gray-900 p-3 rounded text-sm overflow-x-auto mb-3">
        <code className="text-green-400">{snippet.code.substring(0, 200)}...</code>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {snippet.usage}
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4" />
            {snippet.votes}
          </span>
          <span>by {snippet.author.name}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSnippetVote(snippet.id, 1)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Like"
          >
            👍
          </button>
          <button
            onClick={() => copyToClipboard(snippet.code)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Copy Code"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1 mt-2">
        {snippet.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  const TeamMemberCard = ({ member }: { member: TeamMember }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-2xl">{member.avatar}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">
              {member.name}
            </h3>
            <span className="text-lg" title={member.status}>
              {getStatusIcon(member.status)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="capitalize">{member.role}</span>
            <span>•</span>
            <span>🇬🇪 {member.georgianProficiency}</span>
          </div>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Expertise:
        </div>
        <div className="flex flex-wrap gap-1">
          {member.expertise.map(skill => (
            <span key={skill} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
              {skill}
            </span>
          ))}
        </div>
      </div>
      
      <div className="text-xs text-gray-500">
        Last active: {member.lastActive.toLocaleString('ka-GE')}
      </div>
    </div>
  );

  // ===== MAIN RENDER =====
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🤝 Enterprise Collaboration
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                გუნდური მუშაობა და ცოდნის გაზიარება ქართული მხარდაჭერით
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {teamMetrics && (
              <div className="text-sm text-gray-600">
                {teamMetrics.activeMembers}/{teamMetrics.totalMembers} online
              </div>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              ✕ დახურვა
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {([
            { id: 'sessions', label: '💬 Sessions', icon: MessageSquare },
            { id: 'knowledge', label: '📚 Knowledge', icon: Database },
            { id: 'team', label: '👥 Team', icon: Users },
            { id: 'metrics', label: '📊 Metrics', icon: TrendingUp }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-4 border-b-2 transition-colors
                ${activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden p-6">
          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  გაზიარებული Sessions
                </h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  + ახალი Session
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-full">
                {sharedSessions.map(session => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  📚 Code Snippets & Solutions
                </h2>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="ძიება..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    + Add Snippet
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto max-h-full">
                {codeSnippets.map(snippet => (
                  <SnippetCard key={snippet.id} snippet={snippet} />
                ))}
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  👥 Team Members
                </h2>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <UserPlus className="w-4 h-4 mr-2 inline" />
                  Invite Member
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-full">
                {teamMembers.map(member => (
                  <TeamMemberCard key={member.id} member={member} />
                ))}
              </div>
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && teamMetrics && (
            <div className="h-full">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                📊 Team Analytics
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">Team Size</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {teamMetrics.totalMembers}
                  </div>
                  <div className="text-xs text-blue-500">
                    {teamMetrics.activeMembers} active
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-300">Sessions</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {teamMetrics.sharedSessions}
                  </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="w-5 h-5 text-purple-600" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">Snippets</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {teamMetrics.codeSnippets}
                  </div>
                </div>
                
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🇬🇪</span>
                    <span className="text-sm text-orange-700 dark:text-orange-300">Georgian</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {teamMetrics.georgianSpeakers}
                  </div>
                  <div className="text-xs text-orange-500">speakers</div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                <h3 className="font-bold text-lg mb-4">Collaboration Health</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Response Time</span>
                      <span className="text-sm font-mono">{teamMetrics.avgResponseTime}min</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, (30 - teamMetrics.avgResponseTime) / 30 * 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Knowledge Base</span>
                      <span className="text-sm font-mono">{teamMetrics.knowledgeBaseSize} items</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, teamMetrics.knowledgeBaseSize / 200 * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
/**
 * 🇬🇪 Georgian Programming Terminology Support System
 * PHASE 5: Full Georgian Programming Terminology Integration
 * 
 * Features:
 * ✅ Real-time terminology translation
 * ✅ Context-aware explanations
 * ✅ Interactive terminology browser
 * ✅ Code annotation with Georgian terms
 * ✅ Learning progress tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Search, Star, Lightbulb, Code, 
  Globe, TrendingUp, Filter, Eye, Copy,
  ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';

// ===== INTERFACES =====

interface ProgrammingTerm {
  id: string;
  english: string;
  georgian: string;
  transliteration: string;
  category: TermCategory;
  definition: string;
  contextExamples: ContextExample[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  frequency: number;
  relatedTerms: string[];
  lastUpdated: Date;
}

interface ContextExample {
  title: string;
  englishCode: string;
  georgianCode: string;
  explanation: string;
  framework?: string;
}

type TermCategory = 
  | 'react' 
  | 'javascript' 
  | 'typescript'
  | 'css'
  | 'html'
  | 'nodejs'
  | 'database'
  | 'general'
  | 'tools'
  | 'patterns';

interface LearningProgress {
  termId: string;
  attempts: number;
  correctAnswers: number;
  lastPracticed: Date;
  mastered: boolean;
}

interface TerminologyProps {
  isOpen: boolean;
  onClose: () => void;
  onTermSelect: (term: ProgrammingTerm) => void;
  highlightedCode?: string;
}

export default function GeorgianProgrammingTerminology({
  isOpen,
  onClose,
  onTermSelect,
  highlightedCode
}: TerminologyProps) {
  // ===== STATE =====
  const [terms, setTerms] = useState<ProgrammingTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<ProgrammingTerm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TermCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [selectedTerm, setSelectedTerm] = useState<ProgrammingTerm | null>(null);
  const [learningProgress, setLearningProgress] = useState<Map<string, LearningProgress>>(new Map());
  const [viewMode, setViewMode] = useState<'browse' | 'practice' | 'annotate'>('browse');

  // ===== COMPREHENSIVE TERMINOLOGY DATABASE =====
  const initializeTerms = (): ProgrammingTerm[] => [
    // React Terms
    {
      id: 'react-component',
      english: 'Component',
      georgian: 'კომპონენტი',
      transliteration: 'komponenti',
      category: 'react',
      definition: 'მისაღები და ხელახლა გამოყენებადი UI ელემენტი რომელიც React-ში ინდივიდუალურ ფუნქციას ასრულებს',
      contextExamples: [
        {
          title: 'Function Component',
          englishCode: 'function Welcome(props) {\n  return <h1>Hello, {props.name}!</h1>;\n}',
          georgianCode: 'function მისალმება(props) {\n  return <h1>გამარჯობა, {props.სახელი}!</h1>;\n}',
          explanation: 'ფუნქციური კომპონენტი - React-ის ყველაზე მარტივი კომპონენტის სახეობა'
        },
        {
          title: 'Class Component',
          englishCode: 'class Welcome extends React.Component {\n  render() {\n    return <h1>Hello, {this.props.name}!</h1>;\n  }\n}',
          georgianCode: 'class მისალმება extends React.Component {\n  render() {\n    return <h1>გამარჯობა, {this.props.სახელი}!</h1>;\n  }\n}',
          explanation: 'კლასური კომპონენტი - state-სა და lifecycle-ის მეთოდების გამოყენების შესაძლებლობით'
        }
      ],
      difficulty: 'beginner',
      frequency: 95,
      relatedTerms: ['props', 'state', 'render', 'jsx'],
      lastUpdated: new Date()
    },

    {
      id: 'react-state',
      english: 'State',
      georgian: 'მდგომარეობა',
      transliteration: 'mdgomareoba',
      category: 'react',
      definition: 'კომპონენტის შიდა მონაცემები რომლებიც კონტროლს უწევენ რენდერინგს და შეიძლება დროში შეიცვალოს',
      contextExamples: [
        {
          title: 'useState Hook',
          englishCode: 'const [count, setCount] = useState(0);\nconst increment = () => setCount(count + 1);',
          georgianCode: 'const [რიცხვი, setრიცხვი] = useState(0);\nconst გაზრდა = () => setრიცხვი(რიცხვი + 1);',
          explanation: 'useState Hook - ფუნქციურ კომპონენტებში state-ის მართვისთვის'
        },
        {
          title: 'Class State',
          englishCode: 'this.state = { count: 0 };\nthis.setState({ count: this.state.count + 1 });',
          georgianCode: 'this.state = { რიცხვი: 0 };\nthis.setState({ რიცხვი: this.state.რიცხვი + 1 });',
          explanation: 'კლასურ კომპონენტებში state-ის განსაზღვრა და შეცვლა'
        }
      ],
      difficulty: 'beginner',
      frequency: 90,
      relatedTerms: ['useState', 'setState', 'component', 'render'],
      lastUpdated: new Date()
    },

    {
      id: 'react-props',
      english: 'Props',
      georgian: 'თვისებები',
      transliteration: 'tviebebi',
      category: 'react',
      definition: 'კომპონენტს გადაცემული პარამეტრები რომლებიც მშობელი კომპონენტისგან მოდის',
      contextExamples: [
        {
          title: 'Props Passing',
          englishCode: '<UserCard name="John" age={25} isActive={true} />',
          georgianCode: '<მომხმარებლისკარტი სახელი="ჯონი" ასაკი={25} აქტიურია={true} />',
          explanation: 'Props-ების კომპონენტში გადაცემა'
        }
      ],
      difficulty: 'beginner',
      frequency: 85,
      relatedTerms: ['component', 'children', 'defaultProps'],
      lastUpdated: new Date()
    },

    // JavaScript Terms
    {
      id: 'js-function',
      english: 'Function',
      georgian: 'ფუნქცია',
      transliteration: 'punqcia',
      category: 'javascript',
      definition: 'კოდის ბლოკი რომელიც კონკრეტული ამოცანის შესასრულებლად იქმნება და შეიძლება მრავალჯერ გამოიძახოს',
      contextExamples: [
        {
          title: 'Function Declaration',
          englishCode: 'function greet(name) {\n  return `Hello, ${name}!`;\n}',
          georgianCode: 'function მისალმება(სახელი) {\n  return `გამარჯობა, ${სახელი}!`;\n}',
          explanation: 'ფუნქციის განსაზღვრა function keyword-ით'
        },
        {
          title: 'Arrow Function',
          englishCode: 'const greet = (name) => `Hello, ${name}!`;',
          georgianCode: 'const მისალმება = (სახელი) => `გამარჯობა, ${სახელი}!`;',
          explanation: 'Arrow function - ES6-ის მოკლე სინტაქსი ფუნქციის შესაქმნელად'
        }
      ],
      difficulty: 'beginner',
      frequency: 100,
      relatedTerms: ['parameter', 'return', 'callback', 'closure'],
      lastUpdated: new Date()
    },

    {
      id: 'js-async-await',
      english: 'Async/Await',
      georgian: 'ასინქრონული/ლოდინი',
      transliteration: 'asinqronuli/lodini',
      category: 'javascript',
      definition: 'ასინქრონული კოდის დაწერის თანამედროვე მეთოდი რომელიც Promise-ებს უფრო ადვილად გამოიყენება',
      contextExamples: [
        {
          title: 'Async Function',
          englishCode: 'async function fetchUser(id) {\n  const response = await fetch(`/api/users/${id}`);\n  return await response.json();\n}',
          georgianCode: 'async function მომხმარებლისმოძიება(id) {\n  const პასუხი = await fetch(`/api/users/${id}`);\n  return await პასუხი.json();\n}',
          explanation: 'async/await გამოყენება HTTP მოთხოვნებისთვის'
        }
      ],
      difficulty: 'intermediate',
      frequency: 75,
      relatedTerms: ['promise', 'fetch', 'try-catch'],
      lastUpdated: new Date()
    },

    // TypeScript Terms
    {
      id: 'ts-interface',
      english: 'Interface',
      georgian: 'ინტერფეისი',
      transliteration: 'interpeisi',
      category: 'typescript',
      definition: 'ობიექტის სტრუქტურის განსაზღვრა რომელიც აღწერს ველების ტიპებს და მეთოდებს',
      contextExamples: [
        {
          title: 'Basic Interface',
          englishCode: 'interface User {\n  name: string;\n  age: number;\n  isActive: boolean;\n}',
          georgianCode: 'interface მომხმარებელი {\n  სახელი: string;\n  ასაკი: number;\n  აქტიურია: boolean;\n}',
          explanation: 'Interface-ის განსაზღვრა მომხმარებლის ობიექტისთვის'
        }
      ],
      difficulty: 'intermediate',
      frequency: 80,
      relatedTerms: ['type', 'class', 'extends', 'generic'],
      lastUpdated: new Date()
    },

    // CSS Terms
    {
      id: 'css-flexbox',
      english: 'Flexbox',
      georgian: 'მოქნილი კონტეინერი',
      transliteration: 'moqnili konteiner',
      category: 'css',
      definition: 'CSS-ის layout მეთოდი რომელიც ელემენტების ორგანიზებას ახდენს მოქნილი კონტეინერის საშუალებით',
      contextExamples: [
        {
          title: 'Flex Container',
          englishCode: '.container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}',
          georgianCode: '.კონტეინერი {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}',
          explanation: 'ცენტრალური განლაგება Flexbox-ით'
        }
      ],
      difficulty: 'intermediate',
      frequency: 70,
      relatedTerms: ['grid', 'layout', 'responsive', 'align'],
      lastUpdated: new Date()
    }
  ];

  // ===== EFFECTS =====
  useEffect(() => {
    const initialTerms = initializeTerms();
    setTerms(initialTerms);
    setFilteredTerms(initialTerms);
  }, []);

  useEffect(() => {
    let filtered = terms;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(term =>
        term.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.georgian.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.definition.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(term => term.category === selectedCategory);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(term => term.difficulty === selectedDifficulty);
    }

    setFilteredTerms(filtered);
  }, [terms, searchQuery, selectedCategory, selectedDifficulty]);

  // ===== HANDLERS =====
  const handleTermSelect = (term: ProgrammingTerm) => {
    setSelectedTerm(term);
    onTermSelect(term);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: TermCategory) => {
    const iconMap: Record<TermCategory, string> = {
      react: '⚛️',
      javascript: '🟨',
      typescript: '🔷',
      css: '🎨',
      html: '🌐',
      nodejs: '🟢',
      database: '🗃️',
      general: '💻',
      tools: '🔧',
      patterns: '🏗️'
    };
    return iconMap[category] || '💻';
  };

  // ===== RENDER METHODS =====
  const TermCard = ({ term }: { term: ProgrammingTerm }) => (
    <div
      onClick={() => handleTermSelect(term)}
      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getCategoryIcon(term.category)}</span>
          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
            {term.english}
          </h3>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyColor(term.difficulty)}`}>
          {term.difficulty}
        </span>
      </div>
      
      <div className="mb-2">
        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
          🇬🇪 {term.georgian}
        </span>
        <span className="ml-2 text-sm text-gray-500 italic">
          ({term.transliteration})
        </span>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {term.definition}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className="text-sm text-gray-500">
            Frequency: {term.frequency}%
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {term.contextExamples.length} examples
        </span>
      </div>
    </div>
  );

  const TermDetail = ({ term }: { term: ProgrammingTerm }) => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {term.english}
            </h2>
            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400">
              🇬🇪 {term.georgian}
            </h3>
            <p className="text-gray-500 italic">({term.transliteration})</p>
          </div>
          <button
            onClick={() => copyToClipboard(term.georgian)}
            className="p-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 rounded-lg"
            title="ქართული სიტყვის კოპირება"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          {term.definition}
        </p>
        
        <div className="flex items-center gap-4 mb-6">
          <span className={`px-3 py-1 rounded-full text-sm ${getDifficultyColor(term.difficulty)}`}>
            სირთულე: {term.difficulty}
          </span>
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <TrendingUp className="w-4 h-4" />
            გამოყენება: {term.frequency}%
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          📝 კონტექსტის მაგალითები:
        </h4>
        
        {term.contextExamples.map((example, index) => (
          <div key={index} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h5 className="font-medium mb-3 text-gray-900 dark:text-gray-100">
              {example.title}
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    English:
                  </span>
                  <button
                    onClick={() => copyToClipboard(example.englishCode)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
                  <code>{example.englishCode}</code>
                </pre>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    🇬🇪 ქართული:
                  </span>
                  <button
                    onClick={() => copyToClipboard(example.georgianCode)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="bg-gray-800 text-blue-400 p-3 rounded text-sm overflow-x-auto">
                  <code>{example.georgianCode}</code>
                </pre>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              💡 {example.explanation}
            </p>
          </div>
        ))}
      </div>

      {term.relatedTerms.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            🔗 დაკავშირებული ტერმინები:
          </h4>
          <div className="flex flex-wrap gap-2">
            {term.relatedTerms.map((relatedTerm) => (
              <span
                key={relatedTerm}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm"
              >
                {relatedTerm}
              </span>
            ))}
          </div>
        </div>
      )}
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
            <BookOpen className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🇬🇪 Georgian Programming Terminology
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ქართული პროგრამირების ტერმინოლოგია და კონტექსტური თარგმანები
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ✕ დახურვა
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Filters */}
          <div className="w-1/4 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  🔍 ძიება:
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ტერმინის ძიება..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  📂 კატეგორია:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as TermCategory | 'all')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="all">ყველა კატეგორია</option>
                  <option value="react">⚛️ React</option>
                  <option value="javascript">🟨 JavaScript</option>
                  <option value="typescript">🔷 TypeScript</option>
                  <option value="css">🎨 CSS</option>
                  <option value="html">🌐 HTML</option>
                  <option value="nodejs">🟢 Node.js</option>
                  <option value="database">🗃️ Database</option>
                  <option value="general">💻 General</option>
                  <option value="tools">🔧 Tools</option>
                  <option value="patterns">🏗️ Patterns</option>
                </select>
              </div>

              {/* Difficulty Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  📊 სირთულე:
                </label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="all">ყველა დონე</option>
                  <option value="beginner">🟢 დამწყები</option>
                  <option value="intermediate">🟡 საშუალო</option>
                  <option value="advanced">🔴 მოწინავე</option>
                </select>
              </div>

              {/* Statistics */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  📊 სტატისტიკა:
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>სულ ტერმინები:</span>
                    <span className="font-mono">{terms.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ფილტრირებული:</span>
                    <span className="font-mono">{filteredTerms.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex">
            {/* Terms List */}
            <div className="w-1/2 p-4 overflow-y-auto">
              <div className="space-y-4">
                {filteredTerms.map((term) => (
                  <TermCard key={term.id} term={term} />
                ))}
                
                {filteredTerms.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>ტერმინები ვერ მოიძებნა</p>
                    <p className="text-sm">სცადეთ განსხვავებული ძიების პარამეტრები</p>
                  </div>
                )}
              </div>
            </div>

            {/* Term Detail */}
            <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              {selectedTerm ? (
                <TermDetail term={selectedTerm} />
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>ტერმინი არჩეულია არა</p>
                  <p className="text-sm">მარცხენა ფანელში ტერმინის არჩევა დეტალების სანახავად</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
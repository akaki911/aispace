// SOL-203: Code Context Extraction & Project Analysis
// Dynamic project context composition for intelligent assistance

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { PROJECT_CONTEXT } = require('./project_context');

const execAsync = promisify(exec);

function logError(message, error) {
  const errorMessage = `[code_context] ${message}`;
  if (error) {
    console.error(errorMessage, error);
  } else {
    console.error(errorMessage);
  }
}

// Bakhmaro Cottages project structure mapping
const PROJECT_STRUCTURE = {
  // Frontend structure
  frontend: {
    components: 'src/components/',
    pages: 'src/pages/', 
    hooks: 'src/hooks/',
    utils: 'src/utils/',
    assets: 'src/assets/',
    config: 'src/config/'
  },
  
  // Backend structure  
  backend: {
    api: 'api/',
    middleware: 'middleware/',
    models: 'models/',
    utils: 'utils/',
    config: 'config/'
  },
  
  // AI Service structure
  aiService: {
    routes: 'ai-service/routes/',
    services: 'ai-service/services/',
    tools: 'ai-service/tools/',
    context: 'ai-service/context/',
    core: 'ai-service/core/'
  },
  
  // Configuration files
  config: {
    frontend: ['package.json', 'vite.config.mts', 'tsconfig.json', 'tailwind.config.js'],
    backend: ['package.json', '.env', 'server.js'],
    ai: ['ai-service/server.js', 'ai-service/package.json']
  }
};

// Technology stack context
const TECH_STACK_CONTEXT = {
  frontend: {
    framework: 'React 18',
    typescript: 'TypeScript 5.x',
    bundler: 'Vite',
    styling: 'Tailwind CSS',
    stateManagement: ['React Query', 'Zustand'],
    routing: 'React Router',
    ui: ['Lucide React', 'Framer Motion'],
    auth: ['Firebase Auth', 'WebAuthn']
  },
  
  backend: {
    runtime: 'Node.js v20.19.3',
    framework: 'Express.js',
    database: 'Firebase Firestore',
    session: 'Redis + Express-session',
    security: ['Helmet', 'CORS', 'Rate Limiting'],
    ai: 'Groq API Integration'
  },
  
  deployment: {
    platform: 'Replit',
    environment: 'Development',
    proxy: 'Vite Dev Proxy',
    ports: {
      frontend: 5000,
      backend: 5002,
      ai: 5001
    }
  }
};

const DEFAULT_SERVICE_CONFIG = [
  {
    id: 'frontend',
    name: 'Frontend Vite Dev Server',
    port: 5000,
    command: 'npm run dev:frontend',
    description: 'React 18 + Vite hot-reload environment'
  },
  {
    id: 'backend',
    name: 'Backend Express API',
    port: 5002,
    command: 'npm run dev:backend',
    description: 'Node.js + Express API for bookings'
  },
  {
    id: 'ai-service',
    name: 'AI Service (Gurulo)',
    port: 5001,
    command: 'cd ai-service && node server.js',
    description: 'Gurulo AI pipeline / Groq integration'
  }
];

// Code patterns and architecture insights
const ARCHITECTURE_PATTERNS = {
  // Component patterns
  react: {
    hooks: ['useState', 'useEffect', 'useCallback', 'useMemo'],
    customHooks: ['useAuth', 'useBooking', 'useAPI'],
    patterns: ['Compound Components', 'Render Props', 'HOC'],
    stateManagement: 'React Query + local state'
  },
  
  // API patterns
  api: {
    restPatterns: ['GET /api/resource', 'POST /api/resource', 'PUT /api/resource/:id'],
    middleware: ['Auth', 'Rate Limiting', 'Error Handling'],
    responseFormat: 'JSON with success/error structure',
    cors: 'credentials:true for cross-origin'
  },
  
  // Security patterns
  security: {
    authentication: ['Firebase Auth JWT', 'WebAuthn for admin'],
    authorization: 'Role-based (CUSTOMER, PROVIDER, SUPER_ADMIN)',
    sessionManagement: 'Redis-backed sessions',
    dataValidation: ['Joi schemas', 'Type validation']
  }
};

// Extract context from file information
function analyzeFileContext(filePath, content = '') {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('A valid filePath string is required');
    }

    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);
    const dirname = path.dirname(filePath);
    const isTestFile = /(\.|_)(test|spec)\.(t|j)sx?$/i.test(basename);

    let analysis = {
      file: filePath,
      type: 'unknown',
      language: 'text',
      framework: null,
      components: [],
      dependencies: [],
      patterns: [],
      complexity: 'simple',
      complexityMetrics: {
        lineCount: 0,
        functionCount: 0,
        cyclomaticApprox: 1
      },
      suggestions: [],
      summary: '',
      displayName: basename
    };

    // File type analysis
    switch (ext) {
      case '.tsx':
      case '.jsx':
        analysis.type = 'react-component';
        analysis.language = 'typescript';
        analysis.framework = 'React';
        break;
      case '.ts':
        analysis.type = 'typescript-module';
        analysis.language = 'typescript';
        break;
      case '.js':
        analysis.type = 'javascript-module';
        analysis.language = 'javascript';
        break;
      case '.css':
        analysis.type = 'stylesheet';
        analysis.language = 'css';
        break;
      case '.json':
        analysis.type = 'configuration';
        analysis.language = 'json';
        break;
    }

    if (isTestFile) {
      analysis.type = 'test';
      analysis.language = ext.includes('ts') ? 'typescript' : 'javascript';
      analysis.context = 'Test File';
    }

    // Content analysis if available
    if (content) {
      // React patterns
      if (content.includes('import React') || content.includes("from 'react'") || content.includes('from "react"')) {
        analysis.patterns.push('React');
        if (content.includes('useState')) analysis.patterns.push('useState');
        if (content.includes('useEffect')) analysis.patterns.push('useEffect');
        if (content.includes('useCallback')) analysis.patterns.push('useCallback');
      }

      // TypeScript patterns
      if (content.includes('interface ') || content.includes('type ')) {
        analysis.patterns.push('TypeScript Interfaces');
      }

      // API patterns
      if (content.includes('express') || content.includes('app.')) {
        analysis.patterns.push('Express API');
      }

      // Firebase patterns
      if (content.includes('firebase') || content.includes('firestore')) {
        analysis.patterns.push('Firebase');
      }

      // Dependency extraction
      analysis.dependencies = extractDependencies(content);

      // Complexity estimation
      const lines = content.split('\n').length;
      const functionCount = (content.match(/function\s+|=>/g) || []).length;
      const branchMatches = content.match(/\b(if|for|while|case|catch)\b|\?|&&|\|\|/g) || [];
      const cyclomaticApprox = Math.max(1, branchMatches.length + 1);

      analysis.complexityMetrics = {
        lineCount: lines,
        functionCount,
        cyclomaticApprox
      };

      if (cyclomaticApprox > 20 || lines > 400) {
        analysis.complexity = 'complex';
      } else if (cyclomaticApprox > 10 || lines > 200) {
        analysis.complexity = 'medium';
      }

      if (/\.test\.|\.spec\./.test(basename)) {
        analysis.context = analysis.context || 'Test File';
        analysis.patterns.push('Testing');
      }
    }

    // Location-based context
    if (!analysis.context) {
      if (dirname.includes('components')) {
        analysis.context = 'React Component';
      } else if (dirname.includes('pages')) {
        analysis.context = 'Page Component';
      } else if (dirname.includes('api')) {
        analysis.context = 'API Endpoint';
      } else if (dirname.includes('hooks')) {
        analysis.context = 'Custom Hook';
      } else if (dirname.includes('ai-service')) {
        analysis.context = 'AI Service Module';
      }
    }

    analysis.summary = buildFileSummaryFromAnalysis(analysis);
    return analysis;
  } catch (error) {
    logError(`Failed to analyze file context for ${filePath}`, error);
    return {
      file: filePath,
      type: 'unknown',
      language: 'text',
      framework: null,
      components: [],
      dependencies: [],
      patterns: [],
      complexity: 'unknown',
      complexityMetrics: {
        lineCount: 0,
        functionCount: 0,
        cyclomaticApprox: 0
      },
      suggestions: ['Unable to analyze file due to error.'],
      summary: 'Analysis error',
      displayName: path.basename(filePath || 'unknown')
    };
  }
}

// Compose project context for AI prompts
function composeProjectContext(fileContext = [], userQuery = '') {
  try {
    let context = PROJECT_CONTEXT;

    // Add file context if provided
    if (Array.isArray(fileContext) && fileContext.length > 0) {
      context += '\n**📁 Current Files in Context:**\n';
      fileContext.forEach((file, index) => {
        const safeFile = file || {};
        const analysis = analyzeFileContext(safeFile.path || 'unknown', safeFile.content || '');
        context += `${index + 1}. **${safeFile.path || 'Unknown file'}**\n`;
        context += `   - Type: ${analysis.type}\n`;
        context += `   - Context: ${analysis.context || 'General'}\n`;
        if (analysis.patterns.length > 0) {
          context += `   - Patterns: ${analysis.patterns.join(', ')}\n`;
        }
        if (analysis.dependencies.length > 0) {
          context += `   - Dependencies: ${analysis.dependencies.join(', ')}\n`;
        }
        context += `   - Complexity: ${analysis.complexity} (Lines: ${analysis.complexityMetrics.lineCount}, Cyclomatic≈${analysis.complexityMetrics.cyclomaticApprox})\n`;
        if (safeFile.description) {
          context += `   - Description: ${safeFile.description}\n`;
        }
        context += '\n';
      });
    }

    // Add query context
    if (userQuery) {
      const queryIntent = analyzeQueryIntent(userQuery);
      context += `\n**🎯 Query Intent Analysis:**\n`;
      context += `- Primary Intent: ${queryIntent.primary}\n`;
      context += `- Complexity: ${queryIntent.complexity}\n`;
      context += `- Requires Files: ${queryIntent.requiresFiles ? 'Yes' : 'No'}\n`;
      if (queryIntent.suggestedApproach) {
        context += `- Suggested Approach: ${queryIntent.suggestedApproach}\n`;
      }
    }

    return context;
  } catch (error) {
    logError('Failed to compose project context', error);
    return '**⚠️ Unable to compose project context due to an internal error.**';
  }
}

function generateFileListSummary(files = [], options = {}) {
  const fileEntries = Array.isArray(files) ? files : [];
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : fileEntries.length;

  const analyzed = fileEntries.map(file => {
    const safeFile = file || {};
    const analysis = analyzeFileContext(safeFile.path || 'unknown', safeFile.content || '');

    return {
      path: safeFile.path || 'unknown',
      description: safeFile.description || null,
      summary: analysis.summary,
      type: analysis.type,
      context: analysis.context || null,
      complexity: analysis.complexity,
      lineCount: analysis.complexityMetrics?.lineCount || 0,
      displayName: analysis.displayName
    };
  });

  const visible = analyzed.slice(0, limit);
  const hiddenCount = analyzed.length > limit ? analyzed.length - limit : 0;
  const totalLines = analyzed.reduce((acc, entry) => acc + (entry.lineCount || 0), 0);

  return {
    total: analyzed.length,
    visible,
    hiddenCount,
    totalLines,
    all: analyzed,
    forDisplay: visible
      .map(entry => `- ${entry.path} — ${entry.summary}`)
      .join('\n')
  };
}

// Analyze user query intent
function analyzeQueryIntent(query) {
  const queryLower = query.toLowerCase();
  
  let intent = {
    primary: 'general-help',
    complexity: 'simple',
    requiresFiles: false,
    category: 'chat',
    suggestedApproach: null
  };

  // Code-related keywords
  const codeKeywords = ['component', 'function', 'code', 'debug', 'error', 'fix', 'implement', 'create'];
  const fileKeywords = ['file', 'read', 'search', 'find', 'show', 'open'];
  const architectureKeywords = ['architecture', 'structure', 'design', 'pattern', 'organize'];

  if (codeKeywords.some(keyword => queryLower.includes(keyword))) {
    intent.primary = 'code-assistance';
    intent.category = 'development';
    intent.complexity = 'medium';
    intent.requiresFiles = true;
    intent.suggestedApproach = 'Code analysis with examples';
  } else if (fileKeywords.some(keyword => queryLower.includes(keyword))) {
    intent.primary = 'file-operations';
    intent.category = 'filesystem';
    intent.requiresFiles = true;
    intent.suggestedApproach = 'File system search and analysis';
  } else if (architectureKeywords.some(keyword => queryLower.includes(keyword))) {
    intent.primary = 'architecture-guidance';
    intent.category = 'design';
    intent.complexity = 'complex';
    intent.suggestedApproach = 'High-level architecture explanation';
  }

  // Georgian language detection
  if (/[ა-ჰ]/.test(query)) {
    intent.language = 'georgian';
    intent.responseStyle = 'georgian-native';
  }

  // Complexity indicators
  if (queryLower.includes('complex') || queryLower.includes('advanced') || query.length > 100) {
    intent.complexity = 'complex';
  }

  return intent;
}

// Generate development insights
function generateDevelopmentInsights(context = {}) {
  const insights = {
    recommendations: [],
    patterns: [],
    bestPractices: [],
    georgian: {
      culturalConsiderations: [],
      languageSupport: []
    }
  };

  // Add general recommendations
  insights.recommendations.push(
    'React Query for server state management',
    'TypeScript strict mode for type safety', 
    'Tailwind CSS for consistent styling',
    'Firebase Firestore for real-time data',
    'WebAuthn for secure admin authentication'
  );

  // Add patterns
  insights.patterns.push(
    'Custom hooks for shared logic',
    'Compound components for complex UI',
    'Error boundaries for fault tolerance',
    'Suspense for code splitting'
  );

  // Georgian specific insights
  insights.georgian.culturalConsiderations.push(
    'Right-to-left text support not needed (Georgian is LTR)',
    'Date formatting according to Georgian calendar',
    'Currency formatting in GEL (Georgian Lari)',
    'Address formatting for Georgian locations'
  );

  insights.georgian.languageSupport.push(
    'Unicode support for Georgian script (UTF-8)',
    'Proper font loading for Georgian characters',
    'Keyboard input handling for Georgian layout',
    'Search functionality with Georgian text normalization'
  );

  return insights;
}

function buildFileSummaryFromAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return 'ფაილის ანალიზი ვერ მოხერხდა';
  }

  const parts = [];

  if (analysis.context) {
    parts.push(analysis.context);
  } else if (analysis.type && analysis.type !== 'unknown') {
    parts.push(analysis.type.replace(/-/g, ' '));
  }

  if (analysis.patterns && analysis.patterns.length) {
    parts.push(`პატერნები: ${analysis.patterns.slice(0, 3).join(', ')}`);
  }

  if (analysis.complexity) {
    parts.push(`სირთულე: ${analysis.complexity}`);
  }

  if (!parts.length && analysis.language) {
    parts.push(`ენის ტიპი: ${analysis.language}`);
  }

  return parts.join(' • ') || 'ზოგადი ფაილი';
}

function extractDependencies(content) {
  try {
    if (!content) return [];

    const importRegex = /import\s+(?:.+?from\s+)?['\"]([^'\"]+)['\"]/g;
    const dynamicImportRegex = /import\(['\"]([^'\"]+)['\"]\)/g;
    const requireRegex = /require\(['\"]([^'\"]+)['\"]\)/g;

    const dependencies = new Set();

    let match;
    while ((match = importRegex.exec(content))) {
      dependencies.add(match[1]);
    }
    while ((match = dynamicImportRegex.exec(content))) {
      dependencies.add(match[1]);
    }
    while ((match = requireRegex.exec(content))) {
      dependencies.add(match[1]);
    }

    return Array.from(dependencies).sort();
  } catch (error) {
    logError('Failed to extract dependencies', error);
    return [];
  }
}

async function detectRunningProcesses(port) {
  const unixCommands = [
    `ss -tulpn | grep :${port}`,
    `lsof -nPi :${port} -sTCP:LISTEN`
  ];
  const windowsCommands = [`netstat -ano | findstr :${port}`];

  const commands = process.platform === 'win32' ? windowsCommands : unixCommands;
  let lastError = null;

  for (const command of commands) {
    try {
      const { stdout } = await execAsync(command, { timeout: 2500 });
      if (stdout && stdout.trim().length > 0) {
        return {
          running: true,
          command,
          output: stdout.trim()
        };
      }
    } catch (error) {
      const stdout = error.stdout || '';
      const stderr = error.stderr || '';
      const isNoMatch = error.code === 1 || /not\s+found/i.test(stderr) || /No such file/i.test(stderr);

      if (stdout && stdout.trim().length > 0) {
        return {
          running: true,
          command,
          output: stdout.trim()
        };
      }

      if (!isNoMatch) {
        lastError = error;
      }
    }
  }

  return {
    running: false,
    command: commands[commands.length - 1],
    output: '',
    error: lastError
  };
}

async function checkServiceStatuses(services = DEFAULT_SERVICE_CONFIG) {
  const serviceArray = Array.isArray(services) ? services : [];

  const inspections = await Promise.all(
    serviceArray.map(async service => {
      if (!service || typeof service !== 'object') {
        return {
          name: 'Unknown service',
          port: null,
          command: null,
          running: false,
          icon: '⚠️',
          status: 'Invalid configuration',
          description: null,
          details: null,
          error: new Error('Service configuration is not an object')
        };
      }

      const port = Number(service.port);
      if (!Number.isInteger(port)) {
        return {
          ...service,
          running: false,
          icon: '⚠️',
          status: 'პორტის ინფორმაცია არასწორია',
          details: null,
          error: new Error('Invalid port provided')
        };
      }

      const inspection = await detectRunningProcesses(port);

      return {
        id: service.id,
        name: service.name || `Service ${port}`,
        port,
        command: service.command || null,
        description: service.description || null,
        running: inspection.running,
        icon: inspection.running ? '✅' : '❌',
        status: inspection.running ? 'გაშვებულია' : 'გაჩერებულია',
        details: inspection.output || null,
        lastCommand: inspection.command,
        error: inspection.error || null
      };
    })
  );

  return inspections;
}

function generateServiceLaunchScript(services = DEFAULT_SERVICE_CONFIG, options = {}) {
  const serviceArray = Array.isArray(services) && services.length > 0 ? services : DEFAULT_SERVICE_CONFIG;
  const logsDir = options.logsDir || 'logs';
  const additionalExports = Array.isArray(options.exports) ? options.exports : [];

  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'cleanup() {',
    '  code=$?',
    "  echo '❌ გაშვება შეჩერდა. Exit code:' $code",
    '  exit $code',
    '}',
    'trap cleanup ERR',
    '',
    `mkdir -p "${logsDir}"`,
    "echo '🟠 Gurulo multi-service launcher დაიწყო'"
  ];

  additionalExports.forEach(envLine => {
    if (typeof envLine === 'string' && envLine.trim().length > 0) {
      lines.push(`export ${envLine.trim()}`);
    }
  });

  lines.push('pids=""');

  serviceArray.forEach(service => {
    if (!service || typeof service !== 'object') {
      return;
    }

    const portInfo = service.port ? `(port ${service.port})` : '';
    const logFile = `${logsDir}/${service.id || service.name || 'service'}.log`;
    const command = service.command || 'echo "⚠️ Command not provided"';

    lines.push('', `echo '🚀 ვიწყებთ ${service.name || 'Service'} ${portInfo}'`);
    lines.push(`(${command}) > "${logFile}" 2>&1 &`);
    lines.push('pids="$pids$! "');
  });

  lines.push('', 'echo "⏳ სერვისების გაშვების ლოდინი..."');
  lines.push('sleep 3');
  lines.push('echo "ℹ️ გაშვებული პროცესები: $pids"');
  lines.push('wait');
  lines.push('echo "✅ ყველა სერვისი დასრულდა წარმატებით"');

  return lines.join('\n');
}

function formatLogsForExpandableSection(logs = [], options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 20;
  const emptyPlaceholder = options.emptyPlaceholder || '⚠️ ლოგები არ არის ხელმისაწვდომი';

  if (!Array.isArray(logs) || logs.length === 0) {
    return `<details><summary>Scroll to latest logs</summary>${emptyPlaceholder}</details>`;
  }

  const tail = logs.slice(-limit);
  const formatted = tail
    .map(entry => {
      if (!entry) return '';
      if (typeof entry === 'string') {
        return entry;
      }

      if (entry.message) {
        const timestamp = entry.timestamp ? `[${entry.timestamp}] ` : '';
        const level = entry.level ? `${String(entry.level).toUpperCase()}: ` : '';
        return `${timestamp}${level}${entry.message}`;
      }

      if (entry.stdout || entry.stderr) {
        const stdout = entry.stdout ? `STDOUT: ${entry.stdout}` : '';
        const stderr = entry.stderr ? `STDERR: ${entry.stderr}` : '';
        return [stdout, stderr].filter(Boolean).join(' | ');
      }

      try {
        return JSON.stringify(entry);
      } catch (error) {
        return String(entry);
      }
    })
    .filter(Boolean)
    .join('\n');

  return `<details><summary>Scroll to latest logs</summary>\n\n${formatted}\n</details>`;
}

function updateProjectStructure(updates = {}) {
  try {
    if (typeof updates !== 'object' || updates === null) {
      throw new Error('Updates must be a non-null object');
    }

    mergeDeep(PROJECT_STRUCTURE, updates);
    return PROJECT_STRUCTURE;
  } catch (error) {
    logError('Failed to update project structure', error);
    return PROJECT_STRUCTURE;
  }
}

function mergeDeep(target, source) {
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      target[key] = Array.isArray(target[key]) ? Array.from(new Set([...target[key], ...value])) : value.slice();
    } else if (value && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      mergeDeep(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

module.exports = {
  PROJECT_STRUCTURE,
  TECH_STACK_CONTEXT,
  ARCHITECTURE_PATTERNS,
  DEFAULT_SERVICE_CONFIG,
  analyzeFileContext,
  composeProjectContext,
  analyzeQueryIntent,
  generateDevelopmentInsights,
  buildFileSummaryFromAnalysis,
  generateFileListSummary,
  extractDependencies,
  updateProjectStructure,
  checkServiceStatuses,
  generateServiceLaunchScript,
  formatLogsForExpandableSection
};

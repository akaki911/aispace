// SOL-203: Code Context Extraction & Project Analysis
// Dynamic project context composition for intelligent assistance

const path = require('path');

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
    frontend: ['package.json', 'vite.config.ts', 'tsconfig.json', 'tailwind.config.js'],
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
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);
  
  let analysis = {
    file: filePath,
    type: 'unknown',
    language: 'text',
    framework: null,
    components: [],
    dependencies: [],
    patterns: [],
    complexity: 'simple',
    suggestions: []
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
  
  // Content analysis if available
  if (content) {
    // React patterns
    if (content.includes('import React') || content.includes('from \'react\'')) {
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
    
    // Complexity estimation
    const lines = content.split('\n').length;
    if (lines > 200) analysis.complexity = 'complex';
    else if (lines > 50) analysis.complexity = 'medium';
  }
  
  // Location-based context
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
  
  return analysis;
}

// Compose project context for AI prompts
function composeProjectContext(fileContext = [], userQuery = '') {
  let context = `**🏗️ Project Context - Bakhmaro Cottages Platform**

**Current Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + Firebase Firestore
- AI: Groq API + Custom AI Service (Port 5001)
- Environment: Replit Development Platform

**Architecture Overview:**
- Microservices: Frontend (5000) ↔ Backend (5002) ↔ AI Service (5001)
- Authentication: Firebase Auth + WebAuthn for admins
- State: React Query for server state, Zustand for client state
- Styling: Tailwind CSS + Framer Motion animations
`;

  // Add file context if provided
  if (fileContext && fileContext.length > 0) {
    context += '\n**📁 Current Files in Context:**\n';
    fileContext.forEach((file, index) => {
      const analysis = analyzeFileContext(file.path, file.content);
      context += `${index + 1}. **${file.path}**\n`;
      context += `   - Type: ${analysis.type}\n`;
      context += `   - Context: ${analysis.context || 'General'}\n`;
      if (analysis.patterns.length > 0) {
        context += `   - Patterns: ${analysis.patterns.join(', ')}\n`;
      }
      if (file.description) {
        context += `   - Description: ${file.description}\n`;
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

module.exports = {
  PROJECT_STRUCTURE,
  TECH_STACK_CONTEXT,
  ARCHITECTURE_PATTERNS,
  analyzeFileContext,
  composeProjectContext,
  analyzeQueryIntent,
  generateDevelopmentInsights
};
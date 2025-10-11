const fs = require('fs').promises;
const path = require('path');
const groqService = require('./groq_service');

class CodeAnalyzer {
  constructor() {
    this.codebaseCache = new Map();
    this.lastScanTime = null;
    this.scanCooldown = 5 * 60 * 1000; // 5 minutes
  }

  async analyzeForQuery(query, conversationHistory = []) {
    try {
      console.log('🔍 [RAG] Starting comprehensive code analysis for query:', query);

      // Enhanced query understanding with RAG classification
      const queryType = classifyQuery(query);
      console.log('📊 [RAG] Query classified as:', queryType);

      // Check if this is a thematic analysis request
      if (this.isThematicAnalysisRequest(query)) {
        console.log('🎯 [RAG] Thematic analysis detected - using specialized flow');
        return await this.performThematicAnalysis(query, conversationHistory);
      }

      // RAG Step 1: Retrieve relevant information
      const retrievedData = await performRAGRetrieval(query, queryType);

      if (!retrievedData || retrievedData.isEmpty) {
        console.log('⚠️ [RAG] No relevant data retrieved');
        return null;
      }

      // RAG Step 2: Augment with context
      const augmentedContext = await augmentWithMemoryAndStructure(retrievedData, query);

      // RAG Step 3: Generate response using comprehensive context
      const response = await generateRAGResponse(query, augmentedContext, conversationHistory);

      console.log('✅ [RAG] Analysis completed successfully');
      return response;

    } catch (error) {
      console.error('❌ [RAG] Code analysis failed:', error);
      return null;
    }
  }

  isThematicAnalysisRequest(query) {
    const thematicKeywords = [
      'საიტის აღწერა', 'საიტზე ინფორმაცია', 'სრული ინფორმაცია',
      'დეტალური აღწერა', 'მთელი პლატფორმა', 'სისტემის აღწერა',
      'ყველაფერი', 'მუშაობს', 'შედგება', 'არქიტექტურა'
    ];

    return thematicKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  async performThematicAnalysis(query, conversationHistory) {
    try {
      console.log('🎯 [Thematic] Starting thematic analysis...');

      // Step 1: Find core module files
      const moduleFiles = await this.findThematicModules();
      console.log(`📁 [Thematic] Found ${moduleFiles.length} core modules`);

      // Step 2: Extract essential information from each module
      const moduleAnalysis = await this.analyzeModuleEssentials(moduleFiles);

      // Step 3: Create structured summary
      const structuredSummary = await this.createThematicSummary(moduleAnalysis);

      // Step 4: Generate final response with Groq
      const response = await this.generateThematicResponse(query, structuredSummary, conversationHistory);

      console.log('✅ [Thematic] Analysis completed successfully');
      return response;

    } catch (error) {
      console.error('❌ [Thematic] Analysis failed:', error);
      return null;
    }
  }

  async findThematicModules() {
    const targetModules = [
      // Core booking modules
      'BookingForm.tsx', 'BookingModal.tsx', 'HotelBookingForm.tsx', 'VehicleBookingForm.tsx',
      // Admin modules
      'AdminCottages.tsx', 'AdminHotels.tsx', 'AdminVehicles.tsx', 'AdminUsers.tsx',
      // Main pages
      'MainPage.tsx', 'MainDashboard.tsx', 'UserDashboard.tsx',
      // Core components
      'CottagePage.tsx', 'HotelPage.tsx', 'VehiclePage.tsx',
      // Lists
      'CottagesList.tsx', 'HotelsList.tsx', 'VehiclesList.tsx',
      // Services
      'bookingService.ts', 'customerService.ts', 'priceCodeService.ts',
      // Backend
      'ai_controller.js', 'index.js'
    ];

    const foundModules = [];
    const allFiles = await this.scanCodebase();

    targetModules.forEach(targetModule => {
      const found = allFiles.find(file => file.path.includes(targetModule));
      if (found) {
        foundModules.push(found);
      }
    });

    return foundModules;
  }

  async analyzeModuleEssentials(moduleFiles) {
    const moduleAnalysis = [];

    for (const moduleFile of moduleFiles) {
      try {
        const essentials = await this.extractModuleEssentials(moduleFile);
        if (essentials && essentials.hasContent) {
          moduleAnalysis.push(essentials);
        }
      } catch (error) {
        console.log(`⚠️ [Thematic] Failed to analyze ${moduleFile.path}:`, error.message);
      }
    }

    return moduleAnalysis;
  }

  async extractModuleEssentials(moduleFile) {
    const content = moduleFile.content;
    const lines = content.split('\n');
    const fileName = path.basename(moduleFile.path);
    
    // Extract first 100 lines or until first major function/component
    const limitedLines = lines.slice(0, 100);
    
    const essentials = {
      fileName,
      path: moduleFile.path,
      type: this.determineModuleType(fileName, content),
      description: this.extractModuleDescription(limitedLines),
      keyFeatures: this.extractKeyFeatures(limitedLines),
      interfaces: this.extractTypeDefinitions(limitedLines),
      exports: this.extractExports(limitedLines),
      hasContent: false
    };

    // Check if we found meaningful content
    essentials.hasContent = essentials.description || 
                          essentials.keyFeatures.length > 0 || 
                          essentials.exports.length > 0;

    return essentials;
  }

  determineModuleType(fileName, content) {
    if (fileName.includes('Admin')) return 'Admin Interface';
    if (fileName.includes('Booking')) return 'Booking System';
    if (fileName.includes('Form')) return 'Form Component';
    if (fileName.includes('Page')) return 'Page Component';
    if (fileName.includes('List')) return 'List Component';
    if (fileName.includes('Service')) return 'Service Layer';
    if (fileName.includes('Dashboard')) return 'Dashboard';
    if (fileName.endsWith('.js') && content.includes('express')) return 'Backend API';
    if (fileName.endsWith('.ts') && content.includes('interface')) return 'Type Definitions';
    return 'Core Component';
  }

  extractModuleDescription(lines) {
    // Look for comments, JSDoc, or obvious descriptions
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      
      // JSDoc comments
      if (line.startsWith('/**') || line.startsWith('*')) {
        const description = line.replace(/\/\*\*|\*\/|\*/g, '').trim();
        if (description.length > 10) return description;
      }
      
      // Single line comments with meaningful content
      if (line.startsWith('//') && line.length > 15) {
        const description = line.replace('//', '').trim();
        if (description.length > 10) return description;
      }
    }
    
    return null;
  }

  extractKeyFeatures(lines) {
    const features = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // React hooks indicate functionality
      if (trimmed.includes('useState') || trimmed.includes('useEffect')) {
        features.push('React State Management');
      }
      
      // Firebase operations
      if (trimmed.includes('collection(') || trimmed.includes('doc(')) {
        features.push('Firebase Integration');
      }
      
      // API calls
      if (trimmed.includes('fetch(') || trimmed.includes('axios')) {
        features.push('API Communication');
      }
      
      // Form handling
      if (trimmed.includes('onSubmit') || trimmed.includes('handleSubmit')) {
        features.push('Form Processing');
      }
      
      // Routing
      if (trimmed.includes('navigate(') || trimmed.includes('useNavigate')) {
        features.push('Navigation');
      }
    }
    
    return [...new Set(features)]; // Remove duplicates
  }

  extractTypeDefinitions(lines) {
    const interfaces = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('interface ') || trimmed.startsWith('export interface ')) {
        const interfaceName = trimmed.match(/interface\s+(\w+)/)?.[1];
        if (interfaceName) interfaces.push(interfaceName);
      }
      
      if (trimmed.startsWith('type ') || trimmed.startsWith('export type ')) {
        const typeName = trimmed.match(/type\s+(\w+)/)?.[1];
        if (typeName) interfaces.push(typeName);
      }
    }
    
    return interfaces;
  }

  extractExports(lines) {
    const exports = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Default exports
      if (trimmed.startsWith('export default ')) {
        const exportName = trimmed.replace('export default ', '').split(/[^a-zA-Z0-9]/)[0];
        if (exportName) exports.push(`default: ${exportName}`);
      }
      
      // Named exports
      if (trimmed.startsWith('export ') && !trimmed.includes('default')) {
        const match = trimmed.match(/export\s+(const|function|class)\s+(\w+)/);
        if (match) exports.push(`${match[1]}: ${match[2]}`);
      }
    }
    
    return exports;
  }

  async createThematicSummary(moduleAnalysis) {
    let summary = "🏗️ ბახმაროს ბუკინგ პლატფორმის თემატური ანალიზი:\n\n";

    // Group by module type
    const grouped = {};
    moduleAnalysis.forEach(module => {
      if (!grouped[module.type]) grouped[module.type] = [];
      grouped[module.type].push(module);
    });

    Object.keys(grouped).forEach(type => {
      summary += `## ${type}\n`;
      grouped[type].forEach(module => {
        summary += `### ${module.fileName}\n`;
        summary += `📁 მდებარეობა: ${module.path}\n`;
        
        if (module.description) {
          summary += `📝 აღწერა: ${module.description}\n`;
        }
        
        if (module.keyFeatures.length > 0) {
          summary += `🔧 ფუნქციები: ${module.keyFeatures.join(', ')}\n`;
        }
        
        if (module.interfaces.length > 0) {
          summary += `🏷️ ტიპები: ${module.interfaces.join(', ')}\n`;
        }
        
        if (module.exports.length > 0) {
          summary += `📤 ექსპორტები: ${module.exports.join(', ')}\n`;
        }
        
        summary += `\n`;
      });
      summary += `\n`;
    });

    return summary;
  }

  async generateThematicResponse(query, structuredSummary, conversationHistory) {
    const systemPrompt = `თქვენ ხართ ბახმაროს ბუკინგ პლატფორმის ექსპერტი. 

მოწოდებული თემატური ანალიზის საფუძველზე მიაწოდეთ სრული, სტრუქტურული და გასაგები ახსნა პლატფორმის შესახებ.

**ინსტრუქციები:**
1. გამოიყენეთ მხოლოდ მოწოდებული ინფორმაცია
2. ორგანიზება გაუკეთეთ ლოგიკური თემების მიხედვით
3. ახსენით როგორ მუშაობს თითოეული მოდული
4. მიუთითეთ მოდულების ურთიერთკავშირი
5. გამოიყენეთ მხოლოდ ქართული ენა

**კონტექსტი:**
${structuredSummary}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-1).map(h => ({ 
        role: h.role, 
        content: h.content.substring(0, 100) 
      })),
      { role: 'user', content: query }
    ];

    try {
      const { askGroq } = require('./groq_service');
      const response = await askGroq(messages);
      return response.choices[0].message.content;
    } catch (error) {
      console.error('❌ [Thematic] Groq generation failed:', error);
      return this.generateFallbackThematicResponse(structuredSummary);
    }
  }

  generateFallbackThematicResponse(structuredSummary) {
    return `🏗️ ბახმაროს ბუკინგ პლატფორმის თემატური შეჯამება:

${structuredSummary}

⚠️ სრული ანალიზისთვის Groq API საჭიროა.

🔧 **ძირითადი კომპონენტები:**
• Frontend: React + TypeScript + Vite
• Backend: Node.js + Express
• მონაცემთა ბაზა: Firebase Firestore
• AI ასისტენტი: Groq API (Llama models)
• განლაგება: Replit

📊 **ფუნქციონალი:**
• კოტეჯების, სასტუმროების, ავტომობილების ბრონირება
• ადმინისტრაციული პანელი
• მომხმარებელთა მართვა
• ფასების კალკულაცია
• AI მხარდაჭერა`;
  }

  async findRelevantCodeFiles(query) {
    const keywords = this.extractKeywords(query);
    const allFiles = await this.scanCodebase();

    return allFiles.filter(file => {
      const content = file.content.toLowerCase();
      const filename = file.path.toLowerCase();

      // Check if file contains relevant keywords or patterns
      return keywords.some(keyword => 
        content.includes(keyword) || 
        filename.includes(keyword) ||
        this.isRelevantByContext(file, query)
      );
    });
  }

  extractKeywords(query) {
    const georgianToEnglish = {
      'ფას': ['price', 'pricing', 'cost'],
      'ღირებულებ': ['value', 'worth', 'price'],
      'ფორმულ': ['formula', 'calculation'],
      'ღამე': ['night', 'nightly'],
      'კოტეჯ': ['cottage'],
      'სასტუმრო': ['hotel'],
      'ავტომობილ': ['vehicle', 'car'],
      'ჯავშან': ['booking', 'reservation'],
      'კალენდარ': ['calendar'],
      'გადახდ': ['payment', 'deposit'],
      'შეკვეთ': ['order', 'booking'],
      'ფანჯარ': ['modal', 'window', 'form'],
      'ბაზ': ['database', 'data'],
      'მომხმარებლ': ['user', 'customer'],
      'ადმინ': ['admin'],
      'დეშბორდ': ['dashboard'],
      'სტრუქტურ': ['structure', 'architecture'],
      'სისტემ': ['system', 'service'],
      'სრული': ['full', 'complete', 'entire'],
      'ინფორმაცი': ['info', 'information', 'data'],
      'პლატფორმ': ['platform', 'app', 'application'],
      'მუშაობ': ['work', 'function', 'operate'],
      'მოწყობ': ['setup', 'structure', 'organization'],
      'არქიტექტურ': ['architecture', 'structure', 'design']
    };

    let keywords = [];

    // Extract Georgian keywords and their English equivalents
    Object.keys(georgianToEnglish).forEach(georgian => {
      if (query.includes(georgian)) {
        keywords.push(georgian);
        keywords.push(...georgianToEnglish[georgian]);
      }
    });

    // Add direct English keywords
    const englishWords = query.match(/[a-zA-Z]+/g) || [];
    keywords.push(...englishWords.map(w => w.toLowerCase()));

    return [...new Set(keywords)];
  }

  isRelevantByContext(file, query) {
    // Key files that are almost always relevant
    const alwaysRelevant = [
      'pricing.ts', 'vehiclePricing.ts', 'seasonalPricing.ts',
      'BookingForm.tsx', 'BookingModal.tsx', 'CottageForm.tsx',
      'AdminCottages.tsx', 'MainPage.tsx', 'ai_controller.js'
    ];

    const filename = path.basename(file.path);
    return alwaysRelevant.includes(filename);
  }

  async scanCodebase() {
    if (this.codebaseCache.size > 0 && this.lastScanTime && 
        Date.now() - this.lastScanTime < this.scanCooldown) {
      return Array.from(this.codebaseCache.values());
    }

    console.log('📂 Scanning codebase for relevant files...');
    const files = [];

    const directories = [
      'src/utils',
      'src/components', 
      'src/services',
      'src',
      'backend/services',
      'backend'
    ];

    for (const dir of directories) {
      try {
        await this.scanDirectory(dir, files);
      } catch (error) {
        // Directory might not exist, continue
      }
    }

    // Cache results
    this.codebaseCache.clear();
    files.forEach(file => this.codebaseCache.set(file.path, file));
    this.lastScanTime = Date.now();

    return files;
  }

  async scanDirectory(dirPath, files, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.scanDirectory(fullPath, files, maxDepth, currentDepth + 1);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            files.push({
              path: fullPath,
              content: content,
              size: content.length
            });
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  isCodeFile(filename) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  async buildCodeContext(relevantFiles, query) {
    // Limit to most relevant files to avoid token limits
    const topFiles = relevantFiles
      .sort((a, b) => this.calculateRelevanceScore(b, query) - this.calculateRelevanceScore(a, query))
      .slice(0, 8);

    let context = "📁 შესაბამისი კოდის ფაილები:\n\n";

    for (const file of topFiles) {
      const relativePath = file.path.replace(process.cwd() + '/', '');
      context += `**${relativePath}**\n\`\`\`${this.getFileExtension(file.path)}\n`;
      context += this.extractRelevantCodeSections(file.content, query);
      context += "\n```\n\n";
    }

    return context;
  }

  calculateRelevanceScore(file, query) {
    const keywords = this.extractKeywords(query);
    let score = 0;

    keywords.forEach(keyword => {
      const keywordRegex = new RegExp(keyword, 'gi');
      const matches = (file.content.match(keywordRegex) || []).length;
      score += matches;
    });

    // Boost score for important files
    const filename = path.basename(file.path);
    if (filename.includes('pricing') || filename.includes('Pricing')) score += 10;
    if (filename.includes('booking') || filename.includes('Booking')) score += 8;
    if (filename.includes('cottage') || filename.includes('Cottage')) score += 6;

    return score;
  }

  extractRelevantCodeSections(content, query) {
    const lines = content.split('\n');
    const keywords = this.extractKeywords(query);
    const relevantSections = [];

    // Find functions, classes, and key sections
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      // Check if line contains keywords or is a function/class definition
      if (keywords.some(keyword => lowerLine.includes(keyword)) || 
          this.isFunctionOrClassDefinition(line)) {

        // Extract surrounding context
        const start = Math.max(0, i - 5);
        const end = Math.min(lines.length, i + 15);
        relevantSections.push(lines.slice(start, end).join('\n'));
      }
    }

    // If no specific sections found, return first part of file
    if (relevantSections.length === 0) {
      return lines.slice(0, 50).join('\n');
    }

    return relevantSections.join('\n\n// ... \n\n');
  }

  isFunctionOrClassDefinition(line) {
    const functionPatterns = [
      /export\s+(const|function|class)/,
      /^export\s+default/,
      /^const\s+\w+\s*=/,
      /^function\s+\w+/,
      /^class\s+\w+/,
      /^\s*\w+\s*\([^)]*\)\s*{/,
      /calculate\w*/i,
      /get\w*/i
    ];

    return functionPatterns.some(pattern => pattern.test(line));
  }

  getFileExtension(filepath) {
    const ext = path.extname(filepath);
    return ext === '.tsx' ? 'typescript' : 
           ext === '.ts' ? 'typescript' : 
           ext === '.jsx' ? 'javascript' : 'javascript';
  }

  async generateCodeExplanation(query, codeContext, conversationHistory) {
    const systemPrompt = `თქვენ ხართ გამოცდილი დეველოპერი და კოდის ექსპერტი ბახმაროს ბუკინგ პლატფორმისთვის. 

მიღებული კოდის ნაწილების საფუძველზე:
1. უპასუხეთ მომხმარებლის კითხვას დეტალურად და ბუნებრივად
2. ახსენით როგორ მუშაობს შესაბამისი ლოგიკა
3. მიეცით კონკრეტული მაგალითები და კოდის ნაწყვეტები
4. გამოიყენეთ მხოლოდ ქართული ენა
5. იყავით სრული და გასაგები

🔧 **ფოკუსირება:**
- React კომპონენტების სტრუქტურა
- TypeScript სერვისების ლოგიკა  
- Firebase ინტეგრაცია
- ბრონირების სისტემის მუშაობა
- ფასების კალკულაცია

პასუხი უნდა იყოს ისეთი, როგორც რეალური სენიორ დეველოპერი უპასუხებდა.`;

    const userPrompt = `მომხმარებლის შეკითხვა: "${query}"

${codeContext}

გთხოვთ, მისცეთ დეტალური და სრული ახსნა ამ შეკითხვაზე, კოდის ანალიზის საფუძველზე.`;

    try {
      const response = await groqService.generateResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      return response;
    } catch (error) {
      console.error('❌ Groq API error in code explanation:', error);
      throw error;
    }
  }
}

// Query classification for RAG routing
function classifyQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Thematic analysis patterns
  const thematicPatterns = [
    'საიტის აღწერა', 'საიტზე ინფორმაცია', 'სრული ინფორმაცია',
    'დეტალური აღწერა', 'მთელი პლატფორმა', 'სისტემის აღწერა',
    'ყველაფერი', 'არქიტექტურა', 'სტრუქტურა'
  ];
  
  // Technical query patterns
  const technicalPatterns = [
    'კოდი', 'ფუნქცია', 'კომპონენტი', 'სერვისი', 'api',
    'ერორი', 'პრობლემა', 'ბაგი', 'დებაგი'
  ];
  
  // Greeting patterns
  const greetingPatterns = [
    'გამარჯობა', 'მოვალხინო', 'hello', 'hi', 'შეკითხვა'
  ];
  
  // Pricing patterns
  const pricingPatterns = [
    'ფასი', 'ღირებულება', 'ღამე', 'კალკულაცია', 'price'
  ];
  
  if (thematicPatterns.some(pattern => lowerQuery.includes(pattern))) {
    return 'thematic_analysis';
  }
  
  if (technicalPatterns.some(pattern => lowerQuery.includes(pattern))) {
    return 'technical_query';
  }
  
  if (greetingPatterns.some(pattern => lowerQuery.includes(pattern))) {
    return 'greeting';
  }
  
  if (pricingPatterns.some(pattern => lowerQuery.includes(pattern))) {
    return 'pricing_query';
  }
  
  return 'general_query';
}

// RAG Step 1: Comprehensive information retrieval
async function performRAGRetrieval(query, queryType) {
  try {
    console.log('🔍 [RAG Retrieval] Starting information gathering...');

    const retrievedData = {
      projectStructure: null,
      relevantFiles: [],
      memoryContext: null,
      searchResults: [],
      isEmpty: true
    };

    // Get project structure for comprehensive queries
    if (queryType === 'project_structure' || queryType === 'full_info') {
      console.log('🏗️ [RAG] Retrieving project structure...');
      retrievedData.projectStructure = await fileService.getProjectStructure();
    }

    // Search for relevant files based on query terms
    console.log('🔍 [RAG] Searching for relevant files...');
    retrievedData.searchResults = await fileService.searchInFiles(query);

    // Get content from top relevant files
    if (retrievedData.searchResults.length > 0) {
      console.log(`📁 [RAG] Found ${retrievedData.searchResults.length} relevant files`);

      const topFiles = retrievedData.searchResults
        .slice(0, 5) // Top 5 most relevant files
        .map(result => result.file);

      for (const filePath of topFiles) {
        const fileContext = await fileService.getFileContext(filePath);
        if (fileContext && !fileContext.error) {
          retrievedData.relevantFiles.push(fileContext);
        }
      }
    }

    // Get memory context from Firebase/local storage
    console.log('🧠 [RAG] Retrieving memory context...');
    try {
      const { getMemory } = require('../memory_controller');
      retrievedData.memoryContext = await getMemory('01019062020');
    } catch (memoryError) {
      console.log('⚠️ [RAG] Memory retrieval failed, continuing without it');
    }

    // Check if we have any data
    retrievedData.isEmpty = !retrievedData.projectStructure && 
                           retrievedData.relevantFiles.length === 0 && 
                           !retrievedData.memoryContext && 
                           retrievedData.searchResults.length === 0;

    console.log('📊 [RAG Retrieval] Summary:', {
      hasProjectStructure: !!retrievedData.projectStructure,
      relevantFilesCount: retrievedData.relevantFiles.length,
      hasMemoryContext: !!retrievedData.memoryContext,
      searchResultsCount: retrievedData.searchResults.length,
      isEmpty: retrievedData.isEmpty
    });

    return retrievedData;

  } catch (error) {
    console.error('❌ [RAG Retrieval] Failed:', error);
    return { isEmpty: true };
  }
}

// RAG Step 2: Context augmentation
async function augmentWithMemoryAndStructure(retrievedData, query) {
  try {
    console.log('🔧 [RAG Augmentation] Building comprehensive context...');

    let augmentedContext = `🏗️ ბახმაროს ბუკინგ პლატფორმის სრული ანალიზი:\n\n`;

    // Add project structure if available
    if (retrievedData.projectStructure) {
      augmentedContext += `📁 **პროექტის სტრუქტურა:**\n`;
      augmentedContext += formatProjectStructure(retrievedData.projectStructure);
      augmentedContext += `\n\n`;
    }

    // Add relevant file contents
    if (retrievedData.relevantFiles.length > 0) {
      augmentedContext += `📄 **შესაბამისი ფაილები:**\n\n`;

      retrievedData.relevantFiles.forEach((file, index) => {
        augmentedContext += `**${index + 1}. ${file.path}** (${file.type})\n`;
        if (file.content) {
          // Truncate very long files but keep important parts
          const content = file.content.length > 3000 
            ? file.content.substring(0, 1500) + '\n\n[...ფაილი შეკვეცილია...]\n\n' + file.content.substring(file.content.length - 1500)
            : file.content;
          augmentedContext += `\`\`\`${getFileLanguage(file.path)}\n${content}\n\`\`\`\n\n`;
        }
      });
    }

    // Add search context
    if (retrievedData.searchResults.length > 0) {
      augmentedContext += `🔍 **ძიების შედეგები:**\n`;
      retrievedData.searchResults.slice(0, 10).forEach(result => {
        augmentedContext += `• ${result.file}:${result.line} - ${result.content.substring(0, 100)}...\n`;
      });
      augmentedContext += `\n`;
    }

    // Add memory context
    if (retrievedData.memoryContext && retrievedData.memoryContext.data) {
      augmentedContext += `🧠 **მეხსიერების კონტექსტი:**\n`;
      augmentedContext += retrievedData.memoryContext.data.substring(0, 500);
      augmentedContext += `\n\n`;
    }

    // Add technical specifications
    augmentedContext += `🔧 **ტექნიკური დეტალები:**\n`;
    augmentedContext += `• Frontend: React + TypeScript + Vite\n`;
    augmentedContext += `• Backend: Node.js + Express\n`;
    augmentedContext += `• Database: Firebase Firestore\n`;
    augmentedContext += `• AI: Groq API (Llama models)\n`;
    augmentedContext += `• Deployment: Replit\n\n`;

    console.log(`📊 [RAG Augmentation] Context built: ${augmentedContext.length} characters`);
    return augmentedContext;

  } catch (error) {
    console.error('❌ [RAG Augmentation] Failed:', error);
    return 'კონტექსტის შექმნა ვერ მოხერხდა.';
  }
}

// RAG Step 3: Generate comprehensive response
async function generateRAGResponse(query, augmentedContext, conversationHistory) {
  try {
    console.log('🤖 [RAG Generation] Generating response with Groq...');

    const { askGroq } = require('./groq_service');

    const systemPrompt = `თქვენ ხართ ბახმაროს ბუკინგ პლატფორმის AI ექსპერტი. 

მიღებული ინფორმაციის საფუძველზე მომაწოდეთ სრული, დეტალური და სტრუქტურული პასუხი ქართულად.

**ინსტრუქციები:**
1. გამოიყენეთ მხოლოდ მოწოდებული ინფორმაცია
2. პასუხი იყოს სტრუქტურული და გასაგები
3. ჩართეთ კონკრეტული მაგალითები კოდიდან
4. ახსენით როგორ მუშაობს თითოეული კომპონენტი
5. მიუთითეთ ფაილების მდებარეობა და მიზნობრიობა

**კონტექსტი:**
${augmentedContext}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-2).map(h => ({ 
        role: h.role, 
        content: h.content.substring(0, 200) 
      })),
      { role: 'user', content: query }
    ];

    const response = await askGroq(messages);
    const generatedResponse = response.choices[0].message.content;

    console.log('✅ [RAG Generation] Response generated successfully');
    return generatedResponse;

  } catch (error) {
    console.error('❌ [RAG Generation] Failed:', error);
    return generateFallbackRAGResponse(query, augmentedContext);
  }
}

// Helper functions
function formatProjectStructure(structure) {
  let formatted = '';

  Object.keys(structure).forEach(path => {
    const item = structure[path];
    const indent = '  '.repeat((path.split('/').length - 1));

    if (item.type === 'directory') {
      formatted += `${indent}📁 ${path}/\n`;
    } else {
      const icon = getFileIcon(item.extension);
      formatted += `${indent}${icon} ${path}\n`;
    }
  });

  return formatted;
}

function getFileIcon(extension) {
  const icons = {
    '.tsx': '⚛️',
    '.ts': '🔷',
    '.js': '📜',
    '.jsx': '⚛️',
    '.json': '📋',
    '.css': '🎨',
    '.md': '📝'
  };
  return icons[extension] || '📄';
}

function getFileLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const langMap = {
    'tsx': 'typescript',
    'ts': 'typescript', 
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'css': 'css',
    'md': 'markdown'
  };
  return langMap[ext] || 'text';
}

function generateFallbackRAGResponse(query, context) {
  return `🤖 RAG სისტემის fallback პასუხი:

📋 **მოთხოვნა:** ${query}

🏗️ **ძირითადი ინფორმაცია:**
${context.substring(0, 1000)}...

⚠️ სრული ანალიზისთვის Groq API საჭიროა.

🔧 **ხელმისაწვდომი მოდულები:**
• Frontend კომპონენტები (src/components/)
• Backend სერვისები (backend/services/)  
• მონაცემთა მართვა (Firebase)
• AI ასისტენტი (AI Controller)`;
}

module.exports = new CodeAnalyzer();
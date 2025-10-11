'use strict';

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
// Georgian Chat Formatter - Fallback implementation for Node.js
// Since main formatter is TypeScript, using simple Georgian-aware formatter
const georgianChatFormatter = {
  formatTip: (text) => `💡 ${text}`,
  formatWarning: (text) => `⚠️ ${text}`,
  formatError: (text) => `❌ ${text}`,
  formatHighlight: (text) => `🎆 ${text}`,
  formatCheckpoint: (text) => `✅ ${text}`,
  formatHeader: (text) => `🎯 ${text}`,
  formatList: (items) => items.map(item => `• ${item}`).join('\n')
};

/**
 * Enhanced File System Monitor Service
 * 
 * Real-time file monitoring with Georgian AI intelligence for developer insights.
 * Extends the base FileSystemMonitorService with intelligent analysis capabilities.
 * 
 * Phase 2.1: Files & Settings Enhancement - Georgian AI Developer Panel
 */
class EnhancedFileMonitorService {
  constructor(options = {}) {
    this.isInitialized = false;
    this.watcher = null;
    this.projectTree = new Map();
    this.recentChanges = [];
    this.analysisQueue = [];
    this.maxRecentChanges = 25;
    this.projectRoot = process.cwd();
    
    // Georgian AI Intelligence Integration
    this.intelligentAnsweringEngine = options.intelligentAnsweringEngine || null;
    this.memoryService = options.memoryService || null;
    this.webSocketManager = options.webSocketManager || null;
    
    // Enhanced ignore patterns with Georgian text files
    this.ignoredPaths = [
      'node_modules/**',
      '.git/**',
      '.replit/**',
      'build/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      '.nyc_output/**',
      'tmp/**',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '.env*',
      'memory_data/**',
      'memory_facts/**',
      'attached_assets/**',
      '**/*.png',
      '**/*.jpg', 
      '**/*.jpeg',
      '**/*.gif',
      '**/*.svg',
      '**/*.webp',
      '**/*.pdf',
      '**/*.zip'
    ];
    
    // File analysis patterns
    this.patterns = {
      security: {
        danger: [/api.key/i, /password/i, /secret/i, /token/i, /auth/i],
        suspicious: [/eval\(/i, /innerHTML/i, /dangerouslySetInnerHTML/i],
        pii: [/\b\d{11}\b/, /email.*@/, /phone.*\d{10}/]
      },
      quality: {
        performance: [/console\.log/i, /debugger/i, /setTimeout.*0/],
        patterns: [/TODO/i, /FIXME/i, /HACK/i, /XXX/i],
        georgian: [/ქართული/i, /გამარჯობა/i, /დამატება/i]
      },
      architecture: {
        imports: [/import.*from/i, /require\(/i],
        exports: [/export.*{/i, /module\.exports/i],
        async: [/async.*function/i, /await /i, /\.then\(/i]
      }
    };
    
    console.log('👁️ [ENHANCED MONITOR] EnhancedFileMonitorService created');
  }

  /**
   * Initialize enhanced file system monitoring
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ [ENHANCED MONITOR] Already initialized');
      return;
    }

    try {
      console.log('🔍 [ENHANCED MONITOR] Initializing enhanced file system monitoring...');
      console.log(`📂 [ENHANCED MONITOR] Project root: ${this.projectRoot}`);

      // Perform initial scan with analysis
      await this.performEnhancedInitialScan();

      // Initialize chokidar watcher
      this.watcher = chokidar.watch('.', {
        ignored: this.ignoredPaths,
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 12,
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 75
        }
      });

      // Set up enhanced event listeners
      this.setupEnhancedEventListeners();
      
      // Start analysis queue processor
      this.startAnalysisProcessor();

      this.isInitialized = true;
      console.log(`✅ [ENHANCED MONITOR] Initialized successfully. Monitoring ${this.projectTree.size} files with AI intelligence`);
      
      // Notify WebSocket clients
      this.notifyClients('monitor:initialized', {
        fileCount: this.projectTree.size,
        features: ['real-time-analysis', 'georgian-ai', 'pattern-detection', 'security-alerts']
      });
      
    } catch (error) {
      console.error('❌ [ENHANCED MONITOR] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced initial scan with AI analysis
   */
  async performEnhancedInitialScan() {
    console.log('🧠 [ENHANCED MONITOR] Performing enhanced initial project scan...');
    
    try {
      await this.scanDirectoryWithAnalysis('.');
      console.log(`🧠 [ENHANCED MONITOR] Enhanced scan complete: ${this.projectTree.size} files analyzed`);
      
      // Generate initial project insights
      await this.generateProjectInsights();
      
    } catch (error) {
      console.error('❌ [ENHANCED MONITOR] Enhanced scan failed:', error);
      throw error;
    }
  }

  /**
   * Recursively scan directory with AI analysis
   */
  async scanDirectoryWithAnalysis(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.projectRoot, path.resolve(fullPath));
        
        if (this.shouldIgnorePath(relativePath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await this.scanDirectoryWithAnalysis(fullPath);
        } else if (entry.isFile()) {
          await this.addFileWithAnalysis(relativePath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [ENHANCED MONITOR] Scan warning for ${dirPath}:`, error.message);
    }
  }

  /**
   * Add file to tree with intelligent analysis
   */
  async addFileWithAnalysis(relativePath) {
    try {
      const fullPath = path.resolve(this.projectRoot, relativePath);
      const stats = await fs.stat(fullPath);
      
      const fileInfo = {
        path: relativePath,
        fullPath,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        extension: path.extname(relativePath).toLowerCase(),
        category: this.categorizeFile(relativePath),
        lastAnalyzed: null,
        insights: [],
        patterns: [],
        security: { level: 'safe', issues: [] },
        complexity: 0
      };

      this.projectTree.set(relativePath, fileInfo);
      
      // Queue for analysis if it's a code file
      if (this.shouldAnalyzeFile(fileInfo)) {
        this.queueForAnalysis(relativePath, 'initial');
      }
      
    } catch (error) {
      console.warn(`⚠️ [ENHANCED MONITOR] Failed to add file ${relativePath}:`, error.message);
    }
  }

  /**
   * Enhanced event listeners with Georgian AI intelligence
   */
  setupEnhancedEventListeners() {
    this.watcher.on('add', async (filePath) => {
      const relativePath = path.relative(this.projectRoot, filePath);
      console.log(`➕ [ENHANCED MONITOR] File added: ${relativePath}`);
      
      await this.addFileWithAnalysis(relativePath);
      await this.recordFileChange('add', relativePath);
      
      // Generate Georgian AI insight for new files
      const insight = await this.generateFileInsight(relativePath, 'added');
      if (insight) {
        this.notifyClients('file:insight', { 
          path: relativePath, 
          insight: georgianChatFormatter.formatTip(insight),
          type: 'file_added'
        });
      }
    });

    this.watcher.on('change', async (filePath) => {
      const relativePath = path.relative(this.projectRoot, filePath);
      console.log(`📝 [ENHANCED MONITOR] File changed: ${relativePath}`);
      
      await this.updateFileWithAnalysis(relativePath);
      await this.recordFileChange('change', relativePath);
      
      // Queue for analysis
      this.queueForAnalysis(relativePath, 'change');
    });

    this.watcher.on('unlink', async (filePath) => {
      const relativePath = path.relative(this.projectRoot, filePath);
      console.log(`❌ [ENHANCED MONITOR] File removed: ${relativePath}`);
      
      this.projectTree.delete(relativePath);
      await this.recordFileChange('unlink', relativePath);
      
      this.notifyClients('file:removed', { 
        path: relativePath,
        message: georgianChatFormatter.formatWarning(`File წაიშალა: ${relativePath}`)
      });
    });

    this.watcher.on('error', (error) => {
      console.error('❌ [ENHANCED MONITOR] Watcher error:', error);
      this.notifyClients('monitor:error', { 
        error: error.message,
        message: georgianChatFormatter.formatError('File monitoring შეცდომა მოხდა')
      });
    });
  }

  /**
   * Queue file for AI analysis
   */
  queueForAnalysis(filePath, trigger) {
    const analysisJob = {
      filePath,
      trigger,
      timestamp: Date.now(),
      priority: trigger === 'change' ? 'high' : 'normal'
    };
    
    // Remove existing job for same file
    this.analysisQueue = this.analysisQueue.filter(job => job.filePath !== filePath);
    
    // Add new job
    if (analysisJob.priority === 'high') {
      this.analysisQueue.unshift(analysisJob);
    } else {
      this.analysisQueue.push(analysisJob);
    }
    
    console.log(`📊 [ENHANCED MONITOR] Queued ${filePath} for analysis (${trigger})`);
  }

  /**
   * Start analysis queue processor
   */
  startAnalysisProcessor() {
    setInterval(async () => {
      if (this.analysisQueue.length > 0) {
        const job = this.analysisQueue.shift();
        try {
          await this.analyzeFile(job.filePath, job.trigger);
        } catch (error) {
          console.error(`❌ [ENHANCED MONITOR] Analysis failed for ${job.filePath}:`, error);
        }
      }
    }, 2000); // Process every 2 seconds
  }

  /**
   * AI-powered file analysis
   */
  async analyzeFile(filePath, trigger) {
    try {
      const fileInfo = this.projectTree.get(filePath);
      if (!fileInfo) return;

      console.log(`🔍 [ENHANCED MONITOR] Analyzing ${filePath}...`);

      // Read file content
      let content = '';
      try {
        content = await fs.readFile(fileInfo.fullPath, 'utf8');
      } catch (error) {
        console.warn(`⚠️ [ENHANCED MONITOR] Could not read ${filePath}: ${error.message}`);
        return;
      }

      // Pattern analysis
      const patterns = this.detectPatterns(content, fileInfo.extension);
      
      // Security analysis
      const security = this.analyzeSecurity(content, filePath);
      
      // Complexity analysis
      const complexity = this.calculateComplexity(content, fileInfo.extension);

      // Update file info
      fileInfo.lastAnalyzed = new Date();
      fileInfo.patterns = patterns;
      fileInfo.security = security;
      fileInfo.complexity = complexity;

      // Generate Georgian AI insights
      const insights = await this.generateAIInsights(filePath, content, patterns, security, complexity);
      fileInfo.insights = insights;

      this.projectTree.set(filePath, fileInfo);

      // Notify clients with Georgian formatting
      this.notifyClients('file:analyzed', {
        path: filePath,
        trigger,
        analysis: {
          patterns: patterns.length,
          security: security.level,
          complexity,
          insights: insights.map(insight => georgianChatFormatter.formatHighlight(insight))
        },
        timestamp: Date.now()
      });

      // Store insights in memory if available
      if (this.memoryService && insights.length > 0) {
        await this.memoryService.rememberFact(
          'file_analysis',
          `${filePath}: ${insights.join(', ')}`,
          0.8,
          'enhanced_monitor'
        );
      }

    } catch (error) {
      console.error(`❌ [ENHANCED MONITOR] Analysis error for ${filePath}:`, error);
    }
  }

  /**
   * Detect code and content patterns
   */
  detectPatterns(content, extension) {
    const detected = [];
    const lines = content.split('\n');

    // Security patterns
    for (const [category, regexList] of Object.entries(this.patterns.security)) {
      for (const regex of regexList) {
        if (regex.test(content)) {
          detected.push({
            type: 'security',
            category,
            pattern: regex.source,
            severity: category === 'danger' ? 'high' : 'medium'
          });
        }
      }
    }

    // Quality patterns
    for (const [category, regexList] of Object.entries(this.patterns.quality)) {
      for (const regex of regexList) {
        const matches = content.match(new RegExp(regex.source, 'gi'));
        if (matches) {
          detected.push({
            type: 'quality',
            category,
            count: matches.length,
            severity: matches.length > 5 ? 'medium' : 'low'
          });
        }
      }
    }

    // Architecture patterns
    for (const [category, regexList] of Object.entries(this.patterns.architecture)) {
      for (const regex of regexList) {
        const matches = content.match(new RegExp(regex.source, 'gi'));
        if (matches) {
          detected.push({
            type: 'architecture',
            category,
            count: matches.length
          });
        }
      }
    }

    // Georgian language detection
    const georgianChars = (content.match(/[ა-ჰ]/g) || []).length;
    if (georgianChars > 10) {
      detected.push({
        type: 'language',
        category: 'georgian',
        characters: georgianChars,
        percentage: Math.round((georgianChars / content.length) * 100)
      });
    }

    return detected;
  }

  /**
   * Security analysis
   */
  analyzeSecurity(content, filePath) {
    const issues = [];
    let level = 'safe';

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"]\w+/i, message: 'Hardcoded API key detected' },
      { pattern: /password\s*[:=]\s*['"]\w+/i, message: 'Hardcoded password detected' },
      { pattern: /secret\s*[:=]\s*['"]\w+/i, message: 'Hardcoded secret detected' },
      { pattern: /\b\d{11}\b/, message: 'Personal ID number detected' }
    ];

    for (const { pattern, message } of secretPatterns) {
      if (pattern.test(content)) {
        issues.push({ type: 'secret', message, severity: 'high' });
        level = 'danger';
      }
    }

    // Check for security vulnerabilities
    const vulnPatterns = [
      { pattern: /eval\s*\(/i, message: 'Dangerous eval() usage' },
      { pattern: /innerHTML\s*=/i, message: 'Potential XSS risk with innerHTML' },
      { pattern: /document\.write/i, message: 'Dangerous document.write usage' }
    ];

    for (const { pattern, message } of vulnPatterns) {
      if (pattern.test(content)) {
        issues.push({ type: 'vulnerability', message, severity: 'medium' });
        if (level === 'safe') level = 'warning';
      }
    }

    return { level, issues };
  }

  /**
   * Calculate code complexity
   */
  calculateComplexity(content, extension) {
    if (!['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp'].includes(extension)) {
      return 0;
    }

    let complexity = 0;
    const lines = content.split('\n');

    // Count control structures
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /&&|\|\|/g,
      /\?.*:/g // Ternary operators
    ];

    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      complexity += matches ? matches.length : 0;
    }

    // Factor in nesting level
    const nestingComplexity = this.calculateNestingComplexity(lines);
    complexity += nestingComplexity;

    return Math.min(complexity, 100); // Cap at 100
  }

  /**
   * Calculate nesting complexity
   */
  calculateNestingComplexity(lines) {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const line of lines) {
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      currentNesting += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, currentNesting);
    }

    return maxNesting * 2; // Weight nesting complexity
  }

  /**
   * Generate AI-powered insights
   */
  async generateAIInsights(filePath, content, patterns, security, complexity) {
    const insights = [];

    // Security insights
    if (security.level !== 'safe') {
      insights.push(`🔐 Security ${security.level}: ${security.issues.length} საკითხი ნაპოვნია`);
    }

    // Complexity insights
    if (complexity > 20) {
      insights.push(`🧮 კოდის სირთულე მაღალია (${complexity}): რეფაქტორინგი შეიძლება საჭირო იყოს`);
    } else if (complexity > 10) {
      insights.push(`📊 კოდის სირთულე ზომიერია (${complexity}): კარგი ბალანსი`);
    }

    // Pattern insights
    const securityPatterns = patterns.filter(p => p.type === 'security');
    if (securityPatterns.length > 0) {
      insights.push(`⚠️ ${securityPatterns.length} უსაფრთხოების pattern ნაპოვნია`);
    }

    const georgianPattern = patterns.find(p => p.category === 'georgian');
    if (georgianPattern) {
      insights.push(`🇬🇪 ქართული ტექსტი: ${georgianPattern.percentage}% (${georgianPattern.characters} სიმბოლო)`);
    }

    // File type specific insights
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.js' || ext === '.jsx') {
      const consolePatterns = patterns.filter(p => p.category === 'performance');
      if (consolePatterns.some(p => p.count > 3)) {
        insights.push(`🖥️ ბევრი console.log ნაპოვნია - production-ისთვის წაშლა განიხილეთ`);
      }
    }

    return insights;
  }

  /**
   * Generate project-level insights
   */
  async generateProjectInsights() {
    const totalFiles = this.projectTree.size;
    const filesByType = new Map();
    const securityIssues = [];
    let totalComplexity = 0;
    let georgianFileCount = 0;

    // Analyze project structure
    for (const [filePath, fileInfo] of this.projectTree) {
      const ext = fileInfo.extension;
      filesByType.set(ext, (filesByType.get(ext) || 0) + 1);
      
      if (fileInfo.security?.issues.length > 0) {
        securityIssues.push(...fileInfo.security.issues);
      }
      
      totalComplexity += fileInfo.complexity || 0;
      
      if (fileInfo.patterns?.some(p => p.category === 'georgian')) {
        georgianFileCount++;
      }
    }

    const projectInsights = {
      totalFiles,
      fileTypes: Array.from(filesByType.entries()).sort((a, b) => b[1] - a[1]),
      securityIssues: securityIssues.length,
      averageComplexity: totalFiles > 0 ? Math.round(totalComplexity / totalFiles) : 0,
      georgianSupport: georgianFileCount > 0,
      georgianFiles: georgianFileCount,
      timestamp: new Date().toISOString()
    };

    // Store in memory
    if (this.memoryService) {
      await this.memoryService.rememberFact(
        'project_analysis',
        JSON.stringify(projectInsights),
        0.9,
        'enhanced_monitor'
      );
    }

    // Notify clients
    this.notifyClients('project:insights', {
      insights: projectInsights,
      summary: georgianChatFormatter.formatCheckpoint(
        `📊 Project Analysis: ${totalFiles} files, ${securityIssues.length} security issues, ${georgianFileCount} Georgian files`
      )
    });

    return projectInsights;
  }

  /**
   * Utility methods
   */
  shouldIgnorePath(relativePath) {
    return this.ignoredPaths.some(pattern => {
      if (pattern.includes('**')) {
        const regex = new RegExp(pattern.replace('**', '.*').replace('*', '[^/]*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern.replace('*', ''));
    });
  }

  shouldAnalyzeFile(fileInfo) {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go'];
    const configExtensions = ['.json', '.yml', '.yaml', '.xml'];
    const docExtensions = ['.md', '.txt'];
    
    return codeExtensions.includes(fileInfo.extension) ||
           configExtensions.includes(fileInfo.extension) ||
           docExtensions.includes(fileInfo.extension) ||
           fileInfo.size < 100000; // Analyze small files
  }

  categorizeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath).toLowerCase();
    
    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) return 'javascript';
    if (['.py'].includes(ext)) return 'python';
    if (['.java', '.cpp', '.c', '.cs'].includes(ext)) return 'compiled';
    if (['.json', '.yml', '.yaml'].includes(ext)) return 'config';
    if (['.md', '.txt'].includes(ext)) return 'documentation';
    if (name.includes('package')) return 'package';
    return 'other';
  }

  async recordFileChange(type, filePath) {
    const change = {
      type,
      path: filePath,
      timestamp: new Date().toISOString(),
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.recentChanges.unshift(change);
    if (this.recentChanges.length > this.maxRecentChanges) {
      this.recentChanges = this.recentChanges.slice(0, this.maxRecentChanges);
    }
  }

  async updateFileWithAnalysis(filePath) {
    const fileInfo = this.projectTree.get(filePath);
    if (!fileInfo) {
      await this.addFileWithAnalysis(filePath);
      return;
    }

    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const stats = await fs.stat(fullPath);
      
      fileInfo.size = stats.size;
      fileInfo.mtime = stats.mtime;
      
      this.projectTree.set(filePath, fileInfo);
    } catch (error) {
      console.warn(`⚠️ [ENHANCED MONITOR] Failed to update ${filePath}:`, error.message);
    }
  }

  async generateFileInsight(filePath, action) {
    const fileInfo = this.projectTree.get(filePath);
    if (!fileInfo) return null;

    const ext = fileInfo.extension;
    const category = fileInfo.category;

    // Generate contextual Georgian insights
    if (action === 'added') {
      if (category === 'javascript') {
        return `ახალი JavaScript ფაილი დაემატა: ${filePath} - კოდის ხარისხის შემოწმება მიმდინარეობს`;
      } else if (category === 'config') {
        return `კონფიგურაციის ფაილი განახლდა: ${filePath} - პროექტის პარამეტრები შეიცვალა`;
      } else if (category === 'documentation') {
        return `დოკუმენტაცია განახლდა: ${filePath} - ინფორმაცია დამუშავდა`;
      }
    }

    return `ფაილი ${action}: ${filePath} - ${category} კატეგორია`;
  }

  notifyClients(event, data) {
    if (this.webSocketManager) {
      this.webSocketManager.broadcast({
        type: event,
        data,
        service: 'enhanced_file_monitor',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get current state for API
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      totalFiles: this.projectTree.size,
      recentChanges: this.recentChanges.slice(0, 10),
      analysisQueueSize: this.analysisQueue.length,
      monitoredExtensions: Array.from(new Set(
        Array.from(this.projectTree.values()).map(f => f.extension)
      )).filter(Boolean),
      categories: Array.from(new Set(
        Array.from(this.projectTree.values()).map(f => f.category)
      ))
    };
  }

  /**
   * Get file analysis
   */
  getFileAnalysis(filePath) {
    const fileInfo = this.projectTree.get(filePath);
    if (!fileInfo) return null;

    return {
      path: filePath,
      category: fileInfo.category,
      size: fileInfo.size,
      lastAnalyzed: fileInfo.lastAnalyzed,
      insights: fileInfo.insights || [],
      patterns: fileInfo.patterns || [],
      security: fileInfo.security || { level: 'unknown', issues: [] },
      complexity: fileInfo.complexity || 0
    };
  }

  /**
   * Cleanup
   */
  async destroy() {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.projectTree.clear();
    this.recentChanges = [];
    this.analysisQueue = [];
    this.isInitialized = false;
    console.log('🗑️ [ENHANCED MONITOR] Service destroyed');
  }
}

module.exports = EnhancedFileMonitorService;
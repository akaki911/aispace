'use strict';

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
// Using fetch for making HTTP requests
const fetch = require('node-fetch');
// Mock EventEmitter for demonstration purposes if not already available
const EventEmitter = require('events');
const { getInternalToken } = require('../../shared/serviceToken');
const { INTERNAL_HEADER } = require('../../shared/config/envValidator');

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
class EnhancedFileMonitorService extends EventEmitter { // Inherit from EventEmitter
  constructor(options = {}) {
    super(); // Call EventEmitter constructor
    this.isInitialized = false;
    this.watcher = null;
    this.projectTree = new Map();
    this.recentChanges = [];
    this.analysisQueue = [];
    this.maxRecentChanges = 25;
    this.projectRoot = process.cwd();
    this.watcherActive = false;
    this.watcherDisabledReason = null;

    // AI Service specific properties
    this.isRunning = false;
    this.analysisResults = [];
    this.lastBroadcastSignature = null;
    this.lastBroadcastTimestamp = 0;

    // Georgian AI Intelligence Integration
    this.intelligentAnsweringEngine = options.intelligentAnsweringEngine || null;
    this.memoryService = options.memoryService || null;
    this.webSocketManager = options.webSocketManager || null;

    // Enhanced ignore patterns with Georgian text files
    this.ignoredPaths = [
      'node_modules/**',
      '**/node_modules/**',
      '.git/**',
      '**/.git/**',
      '.replit/**',
      '**/.replit/**',
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
    this.ignoredMatchers = this.ignoredPaths
      .map(pattern => this.createIgnoreMatcher(pattern))
      .filter(Boolean);

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

      const disableWatchers =
        process.env.DISABLE_FILE_WATCHERS === 'true' ||
        process.env.NODE_ENV === 'test';

      if (disableWatchers) {
        console.warn('⚠️ [ENHANCED MONITOR] File watchers disabled via configuration or test environment.');
        this.watcherDisabledReason = this.watcherDisabledReason || 'config';
      } else {
        const shouldIgnore = candidatePath => {
          if (!candidatePath) {
            return false;
          }

          const absoluteCandidate = path.isAbsolute(candidatePath)
            ? candidatePath
            : path.resolve(this.projectRoot, candidatePath);
          const relativeCandidate = path.relative(this.projectRoot, absoluteCandidate);
          return this.shouldIgnorePath(relativeCandidate);
        };

        this.watcher = chokidar.watch('.', {
          ignored: shouldIgnore,
          persistent: true,
          ignoreInitial: true,
          followSymlinks: false,
          depth: 12,
          ignorePermissionErrors: true,
          awaitWriteFinish: {
            stabilityThreshold: 150,
            pollInterval: 75
          }
        });

        this.watcherDisabledReason = null;
        this.watcherActive = true;

        // Set up enhanced event listeners
        this.setupEnhancedEventListeners();
      }

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

      if (error?.code === 'ENOSPC') {
        console.warn('⚠️ [ENHANCED MONITOR] System file watcher limit reached. Disabling real-time monitoring to protect the host environment.');
        this.disableWatcher('system_limit');
      }

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
      if (this.analysisQueue.length > 0 && !this.isRunning) {
        this.isRunning = true;
        const job = this.analysisQueue.shift();
        try {
          await this.analyzeFile(job.filePath, job.trigger);
        } catch (error) {
          console.error(`❌ [ENHANCED MONITOR] Analysis failed for ${job.filePath}:`, error);
        } finally {
          this.isRunning = false;
        }
      }
    }, 60000); // Process every 60 seconds - reduced frequency to prevent rate limiting
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

      // Store results for proposal generation - More inclusive logic
      this.analysisResults = this.analysisResults.filter(r => r.file !== filePath); // Clear previous results for the same file

      // Determine if improvement is needed based on various factors
      const hasSecurityIssues = security.level !== 'safe';
      const hasHighComplexity = complexity > 15; // Lower threshold
      const hasPatterns = patterns.length > 0;
      const hasInsights = insights.length > 0;

      // More inclusive criteria for improvement proposals
      const needsImprovement = hasSecurityIssues || hasHighComplexity || 
                              patterns.some(p => p.severity === 'high' || p.severity === 'medium') ||
                              insights.some(i => i.includes('🔐') || i.includes('🧮') || i.includes('⚠️') || i.includes('🖥️'));

      // Generate proposals even for minor improvements to increase activity
      const shouldGenerateProposal = needsImprovement || 
                                   hasInsights || 
                                   patterns.length > 0 || 
                                   complexity > 5 || 
                                   content.includes('TODO') || 
                                   content.includes('FIXME') ||
                                   content.includes('console.log');

      if (shouldGenerateProposal) {
          const improvementType = hasSecurityIssues ? 'Security Enhancement' :
                                 hasHighComplexity ? 'Code Complexity Reduction' :
                                 hasPatterns ? 'Code Quality Improvement' :
                                 'General Code Enhancement';

          this.analysisResults.push({
              file: filePath,
              improvementType,
              suggestion: insights.length > 0 ? insights.join('; ') : `${improvementType} recommended for ${filePath}`,
              needsImprovement: needsImprovement,
              priority: security.level === 'danger' ? 'high' : 
                       (hasHighComplexity || security.level === 'warning') ? 'medium' : 'low',
              riskLevel: security.level,
              category: fileInfo.category,
              evidence: {
                  securityIssues: security.issues.length,
                  complexity: complexity,
                  patterns: patterns.length,
                  insights: insights.length
              }
          });

          console.log(`📊 [ENHANCED MONITOR] Added improvement proposal for ${filePath}: ${improvementType}`);
      }


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
        timestamp: new Date().toISOString()
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

      // Check if this analysis cycle completed successfully and trigger proposals
      console.log('✅ [ENHANCED MONITOR] Analysis cycle completed successfully');
      this.isRunning = false;

      // Connect to ActionExecutorService for real execution
      try {
        const { actionExecutorService } = require('./action_executor_service');

        // Initialize ActionExecutor if needed
        if (!actionExecutorService.isInitialized) {
          await actionExecutorService.initialize();
        }

        // Log analysis completion to ActionExecutor
        await actionExecutorService.logExecution(
          'fileAnalysis', 
          { 
            filePath, 
            trigger,
            analysisResults: insights.length,
            requestId: `monitor_${Date.now()}`
          }, 
          true, 
          `File analysis completed: ${insights.length} insights generated`, 
          Date.now() - new Date(fileInfo.lastAnalyzed).getTime()
        );

      } catch (executorError) {
        console.error('⚠️ [ENHANCED MONITOR] ActionExecutor logging failed:', executorError);
      }

      // Generate and submit proposals first
      await this.generateAndSubmitProposals();

      // Emit cycle completion event with updated proposal count
      const proposalsGenerated = this.analysisResults.filter(r => r.needsImprovement).length;
      const broadcastSignature = `${filePath}:${proposalsGenerated}`;
      const now = Date.now();
      const shouldBroadcast =
        this.lastBroadcastSignature !== broadcastSignature ||
        now - this.lastBroadcastTimestamp > 30000;

      if (shouldBroadcast) {
        this.emit('cycle:success', {
          timestamp: new Date().toISOString(),
          analysisResults: this.analysisResults,
          proposalsGenerated,
          filePath: filePath,
          trigger: trigger
        });

        if (this.webSocketManager) {
          this.webSocketManager.broadcast({
            type: 'improvement:cycle:complete',
            data: {
              file: filePath,
              proposalsGenerated,
              timestamp: new Date().toISOString()
            },
            service: 'enhanced_file_monitor'
          });
        }

        this.lastBroadcastSignature = broadcastSignature;
        this.lastBroadcastTimestamp = now;
      } else {
        console.log('🛑 [ENHANCED MONITOR] Duplicate cycle broadcast suppressed to avoid log noise.');
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        analysisResults: this.analysisResults
      };
    } catch (error) {
      console.error(`❌ [ENHANCED MONITOR] Analysis error for ${filePath}:`, error);
      this.isRunning = false; // Ensure isRunning is reset on error
      return { success: false, error: error.message };
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
   * Generate and submit proposals from analysis results
   */
  async generateAndSubmitProposals() {
    try {
      const improvementItems = this.analysisResults.filter(r => r.needsImprovement);

      if (improvementItems.length === 0) {
        console.log('📝 [PROPOSALS] No improvements needed, skipping proposal generation');
        return;
      }

      for (const item of improvementItems) {
        const proposal = {
          title: `AI-Generated: ${item.improvementType || 'Code Optimization'} for ${item.file}`,
          description: item.suggestion || 'AI-detected improvement opportunity',
          summary: `${item.improvementType === 'performance' ? 'პერფორმანსის გაუმჯობესება' : 
                     item.improvementType === 'security' ? 'უსაფრთხოების გაძლიერება' : 
                     'კოდის ხარისხის გაუმჯობესება'} - ${item.suggestion}`,
          files: [{
            path: item.file,
            action: 'modify',
            content: item.suggestedFix || '// AI suggested improvement'
          }],
          priority: item.priority || 'medium',
          evidence: [{
            file: item.file,
            line: item.line || 1,
            rule: item.rule || 'ai-enhancement',
            note: item.suggestion || 'AI detected enhancement opportunity'
          }],
          risk: item.riskLevel || 'low',
          scope: ['ai-generated', item.category || 'optimization']
        };

        await this.submitProposal(proposal);
      }
    } catch (error) {
      console.error('❌ [PROPOSALS] Failed to generate proposals:', error);
    }
  }

  /**
   * Submit proposal to backend
   */
  async submitProposal(proposal) {
    try {
      console.log(`📤 [PROPOSALS] Submitting proposal: ${proposal.title}`);

      // Use absolute URL for inter-service communication
      const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
      const fullUrl = `${backendUrl}/api/ai/autoimprove/proposals`;

      const internalToken = getInternalToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(internalToken ? { [INTERNAL_HEADER]: internalToken } : {}),
      };

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(proposal)
      });

      const rawBody = await response.text();
      let parsedBody = null;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (parseError) {
          console.warn('⚠️ [PROPOSALS] Non-JSON response from backend proposals endpoint', {
            status: response.status,
            statusText: response.statusText,
            parseError: parseError.message,
          });
        }
      }

      if (response.ok) {
        const result = parsedBody || {};
        console.log(`✅ [PROPOSALS] Proposal submitted successfully: ${result.data?.id}`);

        // Emit proposal created event for WebSocket
        this.emit('proposal:created', {
          proposalId: result.data?.id,
          title: proposal.title,
          timestamp: new Date().toISOString()
        });

        // Broadcast real-time event
        if (this.webSocketManager) {
          this.webSocketManager.broadcast({
            type: 'proposal:created',
            data: {
              id: result.data?.id,
              title: proposal.title,
              severity: proposal.priority,
              file: proposal.files?.[0]?.path
            },
            service: 'enhanced_file_monitor'
          });
        }

        return { success: true, proposalId: result.data?.id };
      }

      const allowedReasons = new Set(['token_missing', 'token_mismatch', 'token_expired']);
      let rejectionReason = parsedBody?.reason && allowedReasons.has(parsedBody.reason)
        ? parsedBody.reason
        : null;

      if (!rejectionReason) {
        if (response.status === 401) {
          rejectionReason = 'token_missing';
        } else if (response.status === 403) {
          rejectionReason = 'token_mismatch';
        } else if (response.status === 503) {
          rejectionReason = 'token_expired';
        } else {
          rejectionReason = 'network_error';
        }
      }

      console.warn('🚫 [PROPOSALS] Backend rejected proposal submission', {
        status: response.status,
        statusText: response.statusText,
        reason: rejectionReason,
        endpoint: fullUrl,
        error: parsedBody?.error,
      });

      return { success: false, error: rejectionReason, status: response.status };
    } catch (error) {
      console.error(`❌ [PROPOSALS] Failed to submit proposal "${proposal.title}":`, {
        message: error.message,
        reason: 'network_error',
      });
      return { success: false, error: 'network_error' };
    }
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
  createIgnoreMatcher(pattern) {
    if (pattern instanceof RegExp) {
      return candidatePath => pattern.test(candidatePath);
    }

    if (typeof pattern === 'string' && pattern.trim().length > 0) {
      const normalisedPattern = pattern.replace(/\\/g, '/');
      const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escaped = escapeRegex(normalisedPattern)
        .replace(/\\\*\\\*/g, '.*')
        .replace(/\\\*/g, '[^/]*');
      const regex = new RegExp(`^${escaped}$`, 'i');
      return candidatePath => regex.test(candidatePath.replace(/\\/g, '/'));
    }

    return null;
  }

  shouldIgnorePath(relativePath) {
    if (!relativePath) {
      return false;
    }

    const normalisedPath = relativePath.replace(/\\/g, '/');
    return this.ignoredMatchers.some(matcher => matcher && matcher(normalisedPath));
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

  disableWatcher(reason = 'manual') {
    if (!this.watcherActive && !this.watcher) {
      this.watcherDisabledReason = this.watcherDisabledReason || reason;
      return;
    }

    const watcherInstance = this.watcher;
    this.watcher = null;
    this.watcherActive = false;
    this.watcherDisabledReason = reason;

    if (watcherInstance && typeof watcherInstance.close === 'function') {
      watcherInstance.close().catch((closeError) => {
        console.warn('⚠️ [ENHANCED MONITOR] Failed to close watcher cleanly:', closeError.message);
      });
    }

    console.warn(`⚠️ [ENHANCED MONITOR] File watchers disabled (${reason}).`);
    this.notifyClients('monitor:watcher-disabled', {
      reason,
      message: georgianChatFormatter.formatWarning('ფაილების მონიტორინგი დროებით გათიშულია')
    });
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
   * Get current monitoring status
   */
  getStatus() {
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
      )),
      watcher: {
        active: this.watcherActive,
        disabledReason: this.watcherDisabledReason,
      }
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
   * Get analysis results for proposal generation
   */
  getAnalysisResults() {
    return this.analysisResults || [];
  }

  /**
   * Get current state for API endpoints
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      totalFiles: this.projectTree.size,
      recentChanges: this.recentChanges.slice(0, 10),
      analysisQueueSize: this.analysisQueue.length,
      analysisResultsCount: this.analysisResults.length,
      proposalsReady: this.analysisResults.filter(r => r.needsImprovement).length,
      monitoredExtensions: Array.from(new Set(
        Array.from(this.projectTree.values()).map(f => f.extension)
      )).filter(Boolean),
      categories: Array.from(new Set(
        Array.from(this.projectTree.values()).map(f => f.category)
      ))
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
// Simple embedding function using text statistics - same as in build script
function generateSimpleEmbedding(text, dimensions = 384) {
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};

  // Count word frequencies
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Count character frequencies
  const charFreq = {};
  for (const char of text.toLowerCase()) {
    if (char.match(/[ა-ჰ]/) || char.match(/[a-z]/)) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }
  }

  // Create embedding vector
  const embedding = new Array(dimensions).fill(0);

  // Fill with statistical features
  const textLen = text.length;
  const wordCount = words.length;
  const uniqueWords = Object.keys(wordFreq).length;
  const avgWordLen = words.reduce((sum, word) => sum + word.length, 0) / wordCount;

  // Distribute features across dimensions
  embedding[0] = textLen / 1000; // Normalized text length
  embedding[1] = wordCount / 100; // Normalized word count
  embedding[2] = uniqueWords / wordCount; // Lexical diversity
  embedding[3] = avgWordLen / 10; // Average word length

  // Use hash-based features for remaining dimensions
  for (let i = 4; i < dimensions; i++) {
    let hash = 0;
    const str = text + i.toString();
    for (let j = 0; j < str.length; j++) {
      const char = str.charCodeAt(j);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    embedding[i] = (hash % 2000 - 1000) / 1000; // Normalize to [-1, 1]
  }

  // Normalize the embedding vector
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (norm || 1));
}

'use strict';

// Required modules for enhanced file system access
const fs = require('fs').promises;
const path = require('path');

// Services for enhanced functionalities
const projectIntelligenceService = require('../services/project_intelligence_service');
const fileSystemService = require('../services/file_system_service');
const semanticSearchService = require('../services/semantic_search_service');
const guruloMemoryService = require('../services/gurulo_memory_service');


// Step 3: Main Answering Engine with Model Router Integration
const { routeQuery } = require('../policy/model_router');
const SYSTEM_PROMPTS = require('../context/system_prompts');
const { findRelevantFiles, extractFileMentions, resolveCandidateFiles } = require('../services/context_retrieval_service');
const { readFileContent } = require('../services/file_system_service');
// const { semanticSearchService } = require('../services/semantic_search_service'); // Already imported above
const { fileSystemMonitorService } = require('../services/file_system_monitor_service');
const { replitMonitorService } = require('../services/replit_monitor_service');
// PROJECT "PHOENIX" - Phase 1: Real-time Code Intelligence System
const projectIntelligenceServiceNew = require('../services/project_intelligence_service'); // Renamed to avoid conflict if it was already implicitly used.


/**
 * Enhanced Context Builder for PROJECT PHOENIX
 * Integrates real-time project intelligence with semantic knowledge and personal memory.
 * @param {string} queryMessage - The user's query.
 * @param {Object} options - Configuration options.
 * @param {string} [options.userId='default'] - Identifier for user-specific memory.
 * @param {boolean} [options.includeLiveFiles=true] - Whether to include live project files.
 * @param {number} [options.maxContext=8000] - Maximum characters for the final context.
 * @returns {Promise<string>} - The combined context string.
 */
async function buildEnhancedContext(queryMessage, options = {}) {
  const { userId = 'default', includeLiveFiles = true, maxContext = 8000 } = options;
  const contexts = [];

  console.log('🌟 [PHOENIX ENGINE] Starting enhanced context building...');

  // --- PHASE 1: Real-time Project Intelligence (NEW) ---
  if (includeLiveFiles) {
    try {
      console.log('🔍 [PROJECT INTEL] Scanning project files in real-time...');
      // Use the imported projectIntelligenceService
      const allProjectFiles = await projectIntelligenceService.getAllProjectFiles();
      console.log(`📂 [PROJECT INTEL] Found ${allProjectFiles.length} project files`);

      const relevantFilePaths = await projectIntelligenceService.findRelevantProjectFiles(
        queryMessage,
        allProjectFiles,
        8 // Top 8 most relevant files
      );

      console.log(`🎯 [PROJECT INTEL] Selected ${relevantFilePaths.length} relevant files:`,
        relevantFilePaths.slice(0, 3).map(f => path.basename(f))
      );

      // Read and analyze relevant files
      for (const filePath of relevantFilePaths) {
        try {
          // Use the imported fileSystemService
          const content = await fileSystemService.readFileContent(filePath, { maxBytes: 4000 });
          if (content && content.trim()) {
            contexts.push({
              source: `live-file: ${filePath}`,
              relevance: 0.95, // Highest priority for live files
              content: `# 📄 Live File Analysis: ${filePath}\n\n${content}`,
              type: 'real-time-file',
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.warn(`⚠️ [PROJECT INTEL] Could not read file ${filePath}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ [PROJECT INTEL] Real-time file analysis failed:', error);
    }
  }

  // --- PHASE 2: Gurulo Memory Integration ---
  try {
    console.log('🧠 [GURULO MEMORY] Retrieving personalized context...');
    const guruloMemory = await guruloMemoryService.getGuruloMemory(userId);

    // Recent interactions for context continuity
    const recentInteractions = guruloMemory.guruloInteractions.slice(-3);
    if (recentInteractions.length > 0) {
      const memoryContext = recentInteractions
        .map(interaction => `Q: ${interaction.query}\nA: ${interaction.response.substring(0, 300)}...`)
        .join('\n\n');

      contexts.push({
        source: 'gurulo-memory',
        relevance: 0.8,
        content: `# 🧠 Recent Interaction Context\n\n${memoryContext}`,
        type: 'memory',
        timestamp: Date.now()
      });
    }

    // Project context
    const currentContext = guruloMemory.guruloContext.slice(-1)[0];
    if (currentContext) {
      contexts.push({
        source: 'project-context',
        relevance: 0.85,
        content: `# 🎯 Current Project Context\nProject: ${currentContext.projectName}\nTask: ${currentContext.currentTask}\nFiles: ${currentContext.workingFiles.join(', ')}`,
        type: 'project-context',
        timestamp: Date.now()
      });
    }

    // Relevant facts
    const relevantFacts = guruloMemory.guruloFacts
      .filter(fact => fact.confidence > 0.7)
      .slice(-5);
    if (relevantFacts.length > 0) {
      const factsContext = relevantFacts
        .map(fact => `${fact.category}: ${fact.fact}`)
        .join('\n');

      contexts.push({
        source: 'gurulo-facts',
        relevance: 0.75,
        content: `# 💡 Relevant Facts\n\n${factsContext}`,
        type: 'facts',
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('❌ [GURULO MEMORY] Memory retrieval failed:', error);
  }

  // --- PHASE 3: Semantic Knowledge Base (Existing Enhanced) ---
  try {
    console.log('📚 [SEMANTIC SEARCH] Searching knowledge base...');
    // Use the imported semanticSearchService
    const semanticChunks = semanticSearchService.findSimilarChunks(queryMessage, 3);

    for (const chunk of semanticChunks) {
      contexts.push({
        source: `knowledge-base: ${chunk.source}`,
        relevance: 0.6,
        content: `# 📚 Knowledge Base\n\n${chunk.content}`,
        type: 'semantic',
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('❌ [SEMANTIC SEARCH] Knowledge search failed:', error);
  }

  // --- PHASE 4: Context Assembly & Optimization ---
  const prioritizedContexts = contexts
    .sort((a, b) => b.relevance - a.relevance)
    .filter(ctx => ctx.content && ctx.content.trim());

  let finalContext = '';
  let totalLength = 0;
  let includedContexts = 0;

  for (const ctx of prioritizedContexts) {
    if (totalLength + ctx.content.length < maxContext && includedContexts < 12) {
      finalContext += `${ctx.content}\n\n---\n\n`;
      totalLength += ctx.content.length;
      includedContexts++;
    }
  }

  console.log(`✅ [PHOENIX ENGINE] Context built: ${includedContexts} sources, ${totalLength} chars`);

  // Store successful context building in memory
  if (userId !== 'default') {
    try {
      await guruloMemoryService.updateContext(
        userId,
        'Phoenix Analysis',
        `Enhanced context: ${includedContexts} sources`,
        relevantFilePaths || [] // Pass the file paths here
      );
    } catch (error) {
      console.warn('⚠️ [GURULO MEMORY] Context storage failed:', error);
    }
  }

  return finalContext || '# 🔍 Context Analysis\n\nNo relevant context found for this query.';
}

/**
 * Enhanced query classification with Georgian language support
 */
function classifyQuery(message) {
  const query = message.toLowerCase();

  // Georgian language patterns
  const georgianPatterns = {
    code_analysis: ['კოდი', 'ფუნქცია', 'ანალიზი', 'შეცდომა'],
    file_operation: ['ფაილი', 'წაკითხვა', 'ჩატვირთვა', 'დამატება'],
    explanation: ['ახსენი', 'რა არის', 'როგორ მუშაობს', 'ნიშნავს'],
    debugging: ['შეცდომა', 'პრობლემა', 'არ მუშაობს', 'დებაგი']
  };

  for (const [category, patterns] of Object.entries(georgianPatterns)) {
    if (patterns.some(pattern => query.includes(pattern))) {
      return category;
    }
  }

  // English fallback patterns
  if (query.includes('code') || query.includes('function')) return 'code_analysis';
  if (query.includes('file') || query.includes('read')) return 'file_operation';
  if (query.includes('explain') || query.includes('what is')) return 'explanation';
  if (query.includes('error') || query.includes('debug')) return 'debugging';

  return 'general';
}


// Main Answering Engine with Model Router Integration
// const { routeQuery } = require('../policy/model_router'); // Already imported above
// const SYSTEM_PROMPTS = require('../context/system_prompts'); // Already imported above
// const { findRelevantFiles, extractFileMentions, resolveCandidateFiles } = require('../services/context_retrieval_service'); // Already imported above
// const { readFileContent } = require('../services/file_system_service'); // Already imported above
// const { fileSystemMonitorService } = require('../services/file_system_monitor_service'); // Already imported above
// const { replitMonitorService } = require('../services/replit_monitor_service'); // Already imported above
// const projectIntelligenceService = require('../services/project_intelligence_service'); // Already imported above


/**
 * Main Answering Engine - Routes queries to appropriate models
 * Based on specifications from პრობლემის მოგვარება.txt
 */

// Static responses for GREETING policy (model: 'none')
const STATIC_GREETINGS = [
  "გამარჯობა! მე ვარ გურულო, შენი AI დეველოპერ ასისტენტი. როგორ შემიძლია დაგეხმარო?",
  "მშვიდობა! გურულო ვარ და მზად ვარ დაგეხმარო შენს პროექტში.",
  "გამარჯობა! რა საკითხით შემიძლია დაგეხმარო?",
  "მოგესალმებით! გურულო ვარ, შენი ტექნიკური ასისტენტი."
];

function getRandomGreeting() {
  return STATIC_GREETINGS[Math.floor(Math.random() * STATIC_GREETINGS.length)];
}

// -------------------- Part 1: Unified RAG Configs & Utils --------------------
const TOKEN_BUDGET_TOTAL = 1500;      // საერთო ბიუჯეტი კონტექსტისთვის
const MAX_FILE_BYTES = 80 * 1024;     // ფაილის მაქს ზომა context-ში
const RECENT_WINDOW_MS = 10 * 60 * 1000; // ბოლო 10 წუთი

const DENY_PATHS = [
  /^\.env/i,
  /^node_modules\//i,
  /^\.git\//i,
  /^dist\//i,
  /^build\//i,
];
const DENY_FILES = [/\.lock$/i, /\.zip$/i, /\.png$/i, /\.jpg$/i, /\.pdf$/i, /\.mp4$/i];

function estimateTokens(str = '') { return Math.ceil((str || '').length / 4); }

function withinBudget(chunks, budgetTokens) {
  const out = [];
  let used = 0;
  for (const c of chunks) {
    const t = estimateTokens(c.text);
    if (used + t > budgetTokens) break;
    out.push(c);
    used += t;
  }
  return out;
}

function truncateText(str = '', chars = 4000) {
  if (str.length <= chars) return str;
  return str.slice(0, chars) + '…';
}

function allowFilePath(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (DENY_PATHS.some(rx => rx.test(p))) return false;
  if (DENY_FILES.some(rx => rx.test(p))) return false;
  return true;
}

function uniqueByKey(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

/**
 * Part 1: Unified RAG - True Codebase Awareness (CRITICAL FIX)
 * Build enhanced context from 3 sources:
 * 1) Semantic KB (knowledge_base.json)
 * 2) Direct live files (explicit mentions)
 * 3) Recent changes (last 5–10 min)
 *
 * @param {string} queryMessage - Query message (could be expanded for RAG)
 * @param {Object} options - Additional options
 * @param {Array} options.conversationHistory - Conversation history for vague follow-up detection
 * @returns {Promise<Object>} Enhanced context object with unified sources
 */
async function buildUnifiedContextForRouting(queryMessage, options = {}) {
  console.log('🧠 [UNIFIED CONTEXT] Building unified context for routing...');

  // 0) Phase 0 Integration: Intelligent Query Expansion for Conversational Memory Fix
  const { conversationHistory = [] } = options;

  // Safe import with try/catch fallback (Architect Review Fix)
  let isVagueFollowUp, buildExpandedRagQuery;
  try {
    const helpers = require('./conversation_memory_helpers');
    isVagueFollowUp = helpers.isVagueFollowUp;
    buildExpandedRagQuery = helpers.buildExpandedRagQuery;
  } catch (error) {
    // Fallback implementations if helper module doesn't exist
    isVagueFollowUp = (msg = '') => {
      const m = (msg || '').trim().toLowerCase();
      if (!m) return false;
      const words = m.split(/\s+/).filter(Boolean);
      if (words.length >= 4) return false;
      return /(გააგრძელე|კიდევ|რატომ|continue|more|why)\b/i.test(m);
    };
    buildExpandedRagQuery = (history = [], currentMsg = '') => {
      let lastUserQ = '';
      let lastAiA = '';
      for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i];
        if (!lastAiA && h.role === 'assistant') lastAiA = h.content || '';
        if (!lastUserQ && h.role === 'user') { lastUserQ = h.content || ''; break; }
      }
      if (!lastUserQ) lastUserQ = currentMsg;
      const ansSummary = lastAiA ? lastAiA.slice(0, 100) + '...' : '';
      return `${lastUserQ} ${ansSummary} ${currentMsg}`.trim();
    };
    console.log('🔄 [MEMORY FIX] Using fallback implementations for conversation helpers');
  }

  const useExpanded = isVagueFollowUp(queryMessage) && conversationHistory.length > 0;

  const ragQuery = useExpanded
    ? buildExpandedRagQuery(conversationHistory, queryMessage)
    : queryMessage;

  if (useExpanded) {
    console.log('🧠 [MEMORY FIX] Vague follow-up detected, using expanded query for Unified RAG:', {
      original: queryMessage,
      expanded: ragQuery.substring(0, 100) + '...'
    });
  }

  // Budgets (adjust dynamically later)
  let budgetSemantic = Math.floor(TOKEN_BUDGET_TOTAL * 0.5);
  let budgetDirect   = Math.floor(TOKEN_BUDGET_TOTAL * 0.3);
  let budgetRecent   = TOKEN_BUDGET_TOTAL - budgetSemantic - budgetDirect;

  const outSemantic = [];
  const outDirect = [];
  const outRecent = [];
  const sourcesMeta = { semantic: [], direct: [], recent: [] };

  // 1) ENHANCED: Real-time Project File Analysis (Replit Assistant equivalent)
  try {
    console.log('📁 [REAL FILE ACCESS] Starting dynamic project file analysis...');

    // Step 1: Get all project files using PROJECT "PHOENIX" - Enhanced Intelligence
    console.log('🚀 [PROJECT PHOENIX] Using ProjectIntelligenceService for enhanced file analysis...');
    const allProjectFiles = await projectIntelligenceServiceNew.getAllProjectFiles(); // Using the renamed import
    console.log(`📂 [PROJECT PHOENIX] Scanned ${allProjectFiles.length} project files`);

    // Step 2: Analyze query using enhanced Georgian/English scoring
    const relevantFiles = await projectIntelligenceServiceNew.findRelevantProjectFiles(ragQuery, allProjectFiles, 10); // Using the renamed import
    console.log(`🎯 [PROJECT PHOENIX] Found ${relevantFiles.length} relevant files for query: "${ragQuery}"`);

    // Step 3: Read and analyze relevant file content
    const fileAnalysis = [];
    for (const filePath of relevantFiles.slice(0, 10)) { // Limit to top 10 most relevant
      try {
        const content = await readFileContent(filePath, { maxBytes: MAX_FILE_BYTES });
        if (!content) continue;

        // Analyze file relevance to query
        const relevanceScore = calculateFileRelevance(ragQuery, filePath, String(content));
        const snippet = truncateText(String(content), 3000);

        fileAnalysis.push({
          text: `# [REAL FILE:${filePath}] (Relevance: ${relevanceScore.toFixed(2)})\n${snippet}`,
          score: relevanceScore,
          source: { type: 'real-file', path: filePath, analyzed: true }
        });
      } catch (e) {
        console.warn('⚠️ [REAL FILE ACCESS] Failed to analyze', filePath, e?.message);
      }
    }

    // Step 4: Sort by relevance and apply budget
    const sortedFiles = fileAnalysis.sort((a, b) => b.score - a.score);
    const budgetedFiles = withinBudget(sortedFiles, budgetSemantic);
    outSemantic.push(...budgetedFiles);
    sourcesMeta.semantic = budgetedFiles.map(f => f.source);

    // Reclaim unused budget
    const used = budgetedFiles.reduce((a, c) => a + estimateTokens(c.text), 0);
    if (used < budgetSemantic) {
      const reclaim = budgetSemantic - used;
      budgetDirect += Math.floor(reclaim / 2);
      budgetRecent += Math.ceil(reclaim / 2);
    }

    console.log(`🚀 [REAL FILE ACCESS] Successfully analyzed ${budgetedFiles.length} files (like Replit Assistant)`);

    // Fallback to knowledge base if no real files found
    if (budgetedFiles.length === 0 && semanticSearchService) {
      console.log('📚 [FALLBACK] Using knowledge base as fallback...');
      const queryEmbedding = generateSimpleEmbedding(ragQuery);
      const top = semanticSearchService.findSimilarChunks(queryEmbedding, 3);

      if (top && top.length > 0) {
        const sema = top.map((t, i) => ({
          text: `# [KB FALLBACK:${i+1}] ${t.text}`,
          score: (t.similarity ?? 0.5) * 0.5, // Lower priority than real files
          source: { type: 'kb-fallback', id: t.id, file: t.source, idx: t.chunk_index }
        }));
        const semaBudgeted = withinBudget(sema, Math.floor(budgetSemantic * 0.3));
        outSemantic.push(...semaBudgeted);
      }
    }
  } catch (error) {
    console.warn('⚠️ [REAL FILE ACCESS] Error in dynamic file analysis:', error.message);
    // Fallback to original knowledge base approach
    if (semanticSearchService) {
      const queryEmbedding = generateSimpleEmbedding(ragQuery);
      const top = semanticSearchService.findSimilarChunks(queryEmbedding, 3);
      if (top && top.length > 0) {
        const sema = top.map((t, i) => ({
          text: `# [KB FALLBACK:${i+1}] ${t.text}`,
          score: t.similarity ?? (1 - i * 0.01),
          source: { type: 'kb-error-fallback', id: t.id }
        }));
        outSemantic.push(...withinBudget(sema, Math.floor(budgetSemantic * 0.3)));
      }
    }
  }

  // 2) Direct File Context (explicit mentions)
  try {
    const mentions = extractFileMentions(ragQuery) || [];
    let candidates = mentions;
    if (resolveCandidateFiles && mentions.length > 0) {
      // optional: expand short names to paths
      const resolved = await resolveCandidateFiles(mentions);
      if (Array.isArray(resolved) && resolved.length) candidates = resolved;
    }

    // read files safely
    const directEntries = [];
    for (const rel of candidates) {
      if (!rel) continue;
      const p = rel.replace(/\\/g, '/');
      if (!allowFilePath(p)) continue;

      try {
        const content = await readFileContent(p, { maxBytes: MAX_FILE_BYTES });
        if (!content) continue;
        const snippet = truncateText(String(content), 4000);
        directEntries.push({
          text: `# [FILE:${p}]\n${snippet}`,
          score: 1.0, // explicit mention → strong
          source: { type: 'file', path: p }
        });
      } catch (e) {
        console.warn('⚠️ [UNIFIED CONTEXT] readFileContent failed', p, e?.message || e);
      }
    }

    // dedupe & budget
    const uniq = uniqueByKey(directEntries, x => x.source?.path ?? x.text);
    const budgeted = withinBudget(uniq, budgetDirect);
    outDirect.push(...budgeted);
    sourcesMeta.direct = budgeted.map(s => s.source);

    const used = budgeted.reduce((a, c) => a + estimateTokens(c.text), 0);
    if (used < budgetDirect) {
      const reclaim = budgetDirect - used;
      budgetRecent += reclaim; // move leftovers to recent
    }
    if (budgeted.length > 0) {
      console.log(`📁 [UNIFIED CONTEXT] Found ${budgeted.length} direct file contexts`);
    }
  } catch (e) {
    console.warn('⚠️ [UNIFIED CONTEXT] direct-files failed:', e?.message || e);
  }

  // 3) Recent Changes Context
  try {
    if (fileSystemMonitorService && fileSystemMonitorService.getStatus().isInitialized) {
      const recent = fileSystemMonitorService.getRecentChanges(10) || [];
      // rank by mtime desc; read top few
      recent.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const recentEntries = [];
      for (const r of recent.slice(0, 6)) {
        const p = (r.path || '').replace(/\\/g, '/');
        if (!p || !allowFilePath(p)) continue;
        try {
          const content = await readFileContent(p, { maxBytes: MAX_FILE_BYTES });
          if (!content) continue;
          const snippet = truncateText(String(content), 2500);
          // recent score slightly lower than explicit mention
          recentEntries.push({
            text: `# [RECENT:${p} @ ${new Date(r.timestamp || Date.now()).toISOString()}]\n${snippet}`,
            score: 0.7,
            source: { type: 'recent', path: p, timestamp: r.timestamp }
          });
        } catch (e) {
          console.warn('⚠️ [UNIFIED CONTEXT] read recent failed', p, e?.message || e);
        }
      }

      // dedupe vs direct (prefer direct)
      const directPaths = new Set(outDirect.map(d => d.source?.path));
      const filtered = recentEntries.filter(e => !directPaths.has(e.source?.path));
      // budget
      const budgeted = withinBudget(filtered, budgetRecent);
      outRecent.push(...budgeted);
      sourcesMeta.recent = budgeted.map(s => s.source);

      if (budgeted.length > 0) {
        console.log(`⏰ [UNIFIED CONTEXT] Found ${budgeted.length} recent file contexts`);
      }
    }
  } catch (e) {
    console.warn('⚠️ [UNIFIED CONTEXT] recent failed:', e?.message || e);
  }

  // Legacy Console Activity (preserved for compatibility)
  let consoleContext = null;
  try {
    if (replitMonitorService && replitMonitorService.getStatus().isInitialized) {
      const recentLogs = replitMonitorService.getRecentLogs(10);
      const recentErrors = replitMonitorService.getRecentErrors(5);
      const logsFromLastMinutes = replitMonitorService.getLogsFromLastMinutes(5);

      consoleContext = {
        recentLogs,
        recentErrors,
        logsFromLastMinutes
      };
      console.log(`👂 [UNIFIED CONTEXT] Console: ${recentLogs.length} recent logs, ${recentErrors.length} recent errors`);
    }
  } catch (error) {
    console.warn('⚠️ [UNIFIED CONTEXT] Console monitoring error:', error.message);
  }

  // Merge all, sort by score desc (semantic already in order; direct > recent by score)
  const merged = [...outDirect, ...outSemantic, ...outRecent]
    .sort((a, b) => (b.score - a.score));

  // Final clamp to total budget (safety)
  const final = withinBudget(merged, TOKEN_BUDGET_TOTAL);

  // Compose unified context
  const unifiedText = final.map(x => x.text).join('\n\n');

  // Legacy compatibility: return old format + new unified context
  return {
    // New unified context
    contextText: unifiedText,
    sourcesMeta,

    // Legacy format for compatibility
    semantic: unifiedText || null,
    fileSystem: {
      recentChanges: sourcesMeta.recent || [],
      projectStats: { totalFiles: final.length }
    },
    console: consoleContext,
    currentFile: null
  };
}

/**
 * Format enhanced context into a structured prompt
 * @param {string} userMessage - User's original message
 * @param {Object} context - Enhanced context from all sensors
 * @returns {string} Formatted context block
 */
function formatEnhancedPrompt(userMessage, context) {
  let promptParts = [`--- Unified Context Block ---\nUser Query: "${userMessage}"\n`];

  // Semantic Search Results
  if (context.semantic) {
    promptParts.push(`## Semantic Search Results:\n${context.semantic}\n`);
  }

  // Live Project State
  if (context.fileSystem) {
    promptParts.push(`## Live Project State:`);

    if (context.fileSystem.recentChanges?.length > 0) {
      promptParts.push(`- Recent file changes:`);
      context.fileSystem.recentChanges.forEach(change => {
        promptParts.push(`  - ${change.event.toUpperCase()}: ${change.path}`);
      });
    }

    if (context.fileSystem.recentlyModified?.length > 0) {
      promptParts.push(`- Recently modified files:`);
      context.fileSystem.recentlyModified.forEach(file => {
        promptParts.push(`  - ${file.path} (${new Date(file.modified).toLocaleTimeString()})`);
      });
    }

    if (context.fileSystem.projectStats) {
      promptParts.push(`- Project overview: ${context.fileSystem.projectStats.totalFiles} files, ${Math.round(context.fileSystem.projectStats.totalSize / 1024)}KB total`);
    }
    promptParts.push('');
  }

  // Recent Console Activity
  if (context.console) {
    promptParts.push(`## Recent Console Activity:`);

    if (context.console.recentErrors?.length > 0) {
      promptParts.push(`- Recent Errors:`);
      context.console.recentErrors.slice(0, 3).forEach(error => {
        promptParts.push(`  - ${error.level.toUpperCase()}: ${error.message}`);
      });
    }

    if (context.console.logsFromLastMinutes?.length > 0) {
      promptParts.push(`- Recent Activity:`);
      context.console.logsFromLastMinutes.slice(0, 5).forEach(log => {
        promptParts.push(`  - ${log.level.toUpperCase()}: ${log.message}`);
      });
    }
    promptParts.push('');
  }

  promptParts.push(`--- End of Context Block ---\n\nBased on all the information above, provide the best possible answer.`);

  return promptParts.join('\n');
}

/**
 * Phase 0: Intelligent Query Expansion - Fix Conversational Memory Drift
 * Helper functions for fixing the "contextual drift" issue on follow-up questions
 */

/**
 * Detect if a message is a vague follow-up that needs context expansion
 * @param {string} msg - User message to analyze
 * @returns {boolean} - True if this is a vague follow-up
 */
function isVagueFollowUp(msg = '') {
  const m = (msg || '').trim().toLowerCase();
  if (!m) return false;
  const words = m.split(/\s+/).filter(Boolean);
  if (words.length >= 4) return false; // Not vague if 4+ words

  // Fix: Remove \b word boundary which doesn't work with Georgian Unicode
  // Use more precise pattern matching for Georgian and English words
  const georgianPattern = /(^|\s)(გააგრძელე|კიდევ|რატომ|დეტალურად|მეტი|ასევე|კიდე)($|\s)/;
  const englishPattern = /(^|\s)(continue|more|why|also|again|details)($|\s)/;

  return georgianPattern.test(m) || englishPattern.test(m);
}

/**
 * Create a quick, cheap summary of AI response for query expansion
 * @param {string} text - Text to summarize
 * @returns {string} - Quick summary (first 1-2 sentences or 220 chars)
 */
function quickSummary(text = '') {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= 220) return t;

  // Try to cut by sentences
  const sentences = t.split(/([.!?？！…]+)\s*/).reduce((acc, cur, i, arr) => {
    if (/[.!?？！…]+/.test(cur)) {
      if (acc.length > 0) acc[acc.length - 1] += cur;
    } else {
      acc.push(cur);
    }
    return acc;
  }, []).filter(Boolean);

  const first = (sentences[0] || '').trim();
  if (first && first.length <= 220) return first;
  return t.slice(0, 220) + '…';
}

/**
 * Build expanded query for RAG by combining chat history context
 * @param {Array} history - Conversation history [{role:'user'|'assistant', content:string}, ...]
 * @param {string} currentMsg - Current vague message
 * @returns {string} - Expanded query combining last question + AI summary + current message
 */
function buildExpandedRagQuery(history = [], currentMsg = '') {
  // Find last user question and last AI answer
  let lastUserQ = '';
  let lastAiA = '';

  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!lastAiA && h.role === 'assistant') lastAiA = h.content || '';
    if (!lastUserQ && h.role === 'user') {
      lastUserQ = h.content || '';
      break;
    }
  }

  if (!lastUserQ) lastUserQ = currentMsg; // fallback
  const ansSummary = quickSummary(lastAiA);
  return `${lastUserQ} ${ansSummary} ${currentMsg}`.trim();
}

/**
 * Phase 2: Action Loop - Process potential tool calls and execute actions
 * This is the core of the Decision-Making Brain that transforms Gurulo into an active agent
 * @param {Object} initialResponse - Initial LLM response that might contain tool calls
 * @param {Array} conversationMessages - The conversation context for LLM
 * @param {string} modelType - 'small' or 'large' for routing
 * @param {Object} opts - Additional options
 * @returns {Promise<Object>} - Final processed response
 */
async function processActionLoop(initialResponse, conversationMessages, modelType, opts = {}) {
  try {
    const responseContent = initialResponse.content || '';

    // Phase 2.1: JSON Tool Call Detection
    const jsonToolCall = extractJsonToolCall(responseContent);

    if (!jsonToolCall) {
      // No tool call detected - return original response
      console.log('📝 [ACTION LOOP] No JSON tool call detected, returning original response');
      return initialResponse;
    }

    console.log('🔧 [ACTION LOOP] JSON tool call detected:', {
      tool: jsonToolCall.tool_name,
      hasParameters: !!jsonToolCall.parameters,
      idempotencyKey: jsonToolCall.idempotencyKey
    });

    // Phase 2.2: JSON Validation
    const validationResult = validateJsonToolCall(jsonToolCall);
    if (!validationResult.isValid) {
      console.error('❌ [ACTION LOOP] Invalid JSON tool call:', validationResult.error);
      return {
        ...initialResponse,
        content: `🚨 JSON Tool Call ვალიდაციის შეცდომა: ${validationResult.error}`,
        isError: true
      };
    }

    // Phase 2.3: Tool Execution with Safety Switch
    const executionResult = await executeJsonTool(jsonToolCall, opts.requestId);

    if (!executionResult.success) {
      console.error('❌ [ACTION LOOP] Tool execution failed:', executionResult.error);
      return {
        ...initialResponse,
        content: `🚨 Tool Execution შეცდომა: ${executionResult.error}`,
        isError: true
      };
    }

    console.log('✅ [ACTION LOOP] Tool executed successfully:', {
      tool: jsonToolCall.tool_name,
      success: executionResult.success,
      duration: executionResult.duration
    });

    // Phase 2.4: Result Chaining - Send result back to LLM for final response
    const chainedResponse = await chainToolResultToLLM(
      executionResult,
      jsonToolCall,
      conversationMessages,
      modelType,
      opts
    );

    console.log('🔗 [ACTION LOOP] Result chained back to LLM successfully');

    return chainedResponse;

  } catch (error) {
    console.error('❌ [ACTION LOOP] Unexpected error in action loop:', error);
    return {
      ...initialResponse,
      content: `🚨 Action Loop შეცდომა: ${error.message}`,
      isError: true
    };
  }
}

/**
 * Phase 2.1: Extract JSON tool call from LLM response
 * @param {string} responseContent - LLM response content
 * @returns {Object|null} - Extracted JSON tool call or null
 */
function extractJsonToolCall(responseContent) {
  if (!responseContent || typeof responseContent !== 'string') {
    return null;
  }

  try {
    // Look for JSON code blocks first
    const jsonCodeBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
    const codeBlockMatch = responseContent.match(jsonCodeBlockRegex);

    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);

      // Verify it has the expected tool call structure
      if (parsed.tool_name && parsed.parameters) {
        return parsed;
      }
    }

    // Fallback: Look for raw JSON objects in the response
    const jsonObjectRegex = /\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/;
    const objectMatch = responseContent.match(jsonObjectRegex);

    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed.tool_name && parsed.parameters) {
        return parsed;
      }
    }

  } catch (error) {
    console.warn('⚠️ [ACTION LOOP] JSON parsing error:', error.message);
  }

  return null;
}

/**
 * Phase 2.2: Validate JSON tool call against expected schema
 * @param {Object} toolCall - Extracted tool call object
 * @returns {Object} - Validation result {isValid: boolean, error?: string}
 */
function validateJsonToolCall(toolCall) {
  if (!toolCall || typeof toolCall !== 'object') {
    return { isValid: false, error: 'Tool call is not an object' };
  }

  // Required fields validation
  if (!toolCall.tool_name || typeof toolCall.tool_name !== 'string') {
    return { isValid: false, error: 'Missing or invalid tool_name' };
  }

  if (!toolCall.parameters || typeof toolCall.parameters !== 'object') {
    return { isValid: false, error: 'Missing or invalid parameters' };
  }

  // Validate tool_name is one of the allowed tools
  const allowedTools = ['writeFile', 'installPackage', 'executeShellCommand'];
  if (!allowedTools.includes(toolCall.tool_name)) {
    return { isValid: false, error: `Invalid tool_name. Allowed: ${allowedTools.join(', ')}` };
  }

  // Tool-specific parameter validation
  switch (toolCall.tool_name) {
    case 'writeFile':
      if (!toolCall.parameters.filePath || typeof toolCall.parameters.filePath !== 'string') {
        return { isValid: false, error: 'writeFile requires filePath parameter' };
      }
      if (toolCall.parameters.filePath.trim() === '' || toolCall.parameters.filePath === '...' || toolCall.parameters.filePath.includes('...')) {
        return { isValid: false, error: 'writeFile requires a specific, valid filePath (not placeholder like "...")' };
      }
      if (!toolCall.parameters.content || typeof toolCall.parameters.content !== 'string') {
        return { isValid: false, error: 'writeFile requires content parameter' };
      }
      break;

    case 'installPackage':
      if (!toolCall.parameters.packageName || typeof toolCall.parameters.packageName !== 'string') {
        return { isValid: false, error: 'installPackage requires packageName parameter' };
      }
      break;

    case 'executeShellCommand':
      if (!toolCall.parameters.command || typeof toolCall.parameters.command !== 'string') {
        return { isValid: false, error: 'executeShellCommand requires command parameter' };
      }
      // args is optional but should be array if provided
      if (toolCall.parameters.args && !Array.isArray(toolCall.parameters.args)) {
        return { isValid: false, error: 'executeShellCommand args must be an array' };
      }
      break;
  }

  return { isValid: true };
}

/**
 * Phase 2.3: Execute the validated JSON tool call with Safety Switch integration
 * @param {Object} toolCall - Validated tool call object
 * @param {string} requestId - Request ID for tracking
 * @returns {Promise<Object>} - Execution result
 */
async function executeJsonTool(toolCall, requestId = null) {
  try {
    // Phase 3: Safety Switch Integration - Request user confirmation before execution
    const { safetySwitchService } = require('../services/safety_switch_service');

    // Initialize Safety Switch service if not already done
    if (!safetySwitchService.isInitialized) {
      await safetySwitchService.initialize();
      console.log('🔒 [ACTION LOOP] SafetySwitchService initialized');
    }

    console.log('🔒 [ACTION LOOP] Requesting user confirmation for tool execution:', {
      tool: toolCall.tool_name,
      requestId,
      parameters: Object.keys(toolCall.parameters || {})
    });

    // Request user confirmation through Safety Switch
    let confirmationResult;
    try {
      confirmationResult = await safetySwitchService.requestActionConfirmation(toolCall, requestId);
    } catch (confirmationError) {
      console.error('❌ [ACTION LOOP] User confirmation failed:', confirmationError.message);
      return {
        success: false,
        error: `Action cancelled: ${confirmationError.message}`,
        tool: toolCall.tool_name,
        cancelled: true
      };
    }

    if (!confirmationResult.confirmed) {
      console.log('❌ [ACTION LOOP] User denied action execution');
      return {
        success: false,
        error: 'Action denied by user',
        tool: toolCall.tool_name,
        cancelled: true
      };
    }

    console.log('✅ [ACTION LOOP] User confirmed action, proceeding with execution:', {
      tool: toolCall.tool_name,
      actionId: confirmationResult.actionId,
      confirmedBy: confirmationResult.confirmedBy
    });

    // Proceed with actual tool execution
    const { actionExecutorService } = require('../services/action_executor_service');

    // Initialize if not already done
    if (!actionExecutorService.isInitialized) {
      await actionExecutorService.initialize();
      console.log('🔧 [ACTION LOOP] ActionExecutorService initialized');
    }

    const actionExecutor = actionExecutorService;

    let result;

    switch (toolCall.tool_name) {
      case 'writeFile':
        result = await actionExecutor.writeFile(
          toolCall.parameters.filePath,
          toolCall.parameters.content,
          {
            ...toolCall.parameters.options,
            requestId,
            actionId: confirmationResult.actionId
          }
        );
        break;

      case 'installPackage':
        result = await actionExecutor.installPackage(
          toolCall.parameters.packageName,
          {
            ...toolCall.parameters.options,
            requestId,
            actionId: confirmationResult.actionId
          }
        );
        break;

      case 'executeShellCommand':
        // Convert to executeTerminalCommand for Part 3 compliance
        const fullCommand = toolCall.parameters.args?.length > 0
          ? `${toolCall.parameters.command} ${toolCall.parameters.args.join(' ')}`
          : toolCall.parameters.command;

        result = await actionExecutor.executeTerminalCommand(
          fullCommand,
          {
            ...toolCall.parameters.options,
            requestId,
            actionId: confirmationResult.actionId
          }
        );
        break;

      default:
        throw new Error(`Unknown tool: ${toolCall.tool_name}`);
    }

    // Add confirmation metadata to result
    result.confirmationData = {
      actionId: confirmationResult.actionId,
      confirmedBy: confirmationResult.confirmedBy,
      confirmedAt: confirmationResult.confirmedAt
    };

    return result;

  } catch (error) {
    console.error(`❌ [ACTION LOOP] Error executing ${toolCall.tool_name}:`, error);
    return {
      success: false,
      error: error.message,
      tool: toolCall.tool_name
    };
  }
}

/**
 * Phase 2.4: Chain tool execution result back to LLM for user-friendly response
 * @param {Object} executionResult - Result from tool execution
 * @param {Object} originalToolCall - Original tool call
 * @param {Array} conversationMessages - Conversation context
 * @param {string} modelType - 'small' or 'large'
 * @param {Object} opts - Additional options
 * @returns {Promise<Object>} - Final user-friendly response
 */
async function chainToolResultToLLM(executionResult, originalToolCall, conversationMessages, modelType, opts) {
  try {
    const llmClient = require('../lib/llmClient');

    // Create a result summary message for the LLM
    const resultMessage = `Tool Execution Result:
Tool: ${originalToolCall.tool_name}
Success: ${executionResult.success}
${executionResult.success ?
      `Result: ${executionResult.result || 'Operation completed successfully'}` :
      `Error: ${executionResult.error}`
    }
${executionResult.duration ? `Duration: ${executionResult.duration}ms` : ''}

გთხოვთ მიაწოდოთ მომხმარებელს მეგობრული, ქართული ენის პასუხი შესრულებული ოპერაციის შესახებ.`;

    // Build messages for the chaining call
    const chainMessages = [
      ...conversationMessages,
      { role: 'assistant', content: `Executing ${originalToolCall.tool_name}...` },
      { role: 'user', content: resultMessage }
    ];

    // Call LLM again with the execution result
    const finalResponse = await llmClient.callLLMWithFallback(chainMessages, modelType, {
      ...opts,
      isChainedCall: true
    });

    // Add execution metadata to the response
    finalResponse.toolExecuted = {
      tool: originalToolCall.tool_name,
      success: executionResult.success,
      duration: executionResult.duration
    };

    return finalResponse;

  } catch (error) {
    console.error('❌ [ACTION LOOP] Error chaining result to LLM:', error);

    // Fallback: Return a basic success/error message
    const fallbackContent = executionResult.success ?
      `✅ ${originalToolCall.tool_name} წარმატებით შესრულდა: ${executionResult.result}` :
      `❌ ${originalToolCall.tool_name} ვერ შესრულდა: ${executionResult.error}`;

    return {
      content: fallbackContent,
      policy: opts.policy || 'TOOL_EXECUTION',
      model: modelType,
      isError: !executionResult.success,
      toolExecuted: {
        tool: originalToolCall.tool_name,
        success: executionResult.success,
        duration: executionResult.duration
      }
    };
  }
}

/**
 * Main message processing function
 * @param {string} userMessage - User's input message
 * @param {Array} conversationHistory - Previous conversation context
 * @param {string} personalId - User's personal identifier
 * @param {Object} options - Additional options (modelOverride, etc.)
 * @returns {Promise<{success: boolean, response: string, policy: string, model: string}>}
 */
async function processMessage(userMessage, conversationHistory = [], personalId = null, options = {}) {
  // Generate unique request ID for tracking
  const requestId = options.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // Phase 0: Intelligent Query Expansion for Conversational Memory Fix
  const useExpanded = isVagueFollowUp(userMessage) && conversationHistory.length > 0;

  const ragQuery = useExpanded
    ? buildExpandedRagQuery(conversationHistory, userMessage)
    : userMessage;

  if (useExpanded) {
    console.log('🧠 [MEMORY FIX] Detected vague follow-up, expanding query for RAG:', {
      original: userMessage,
      expanded: ragQuery.substring(0, 100) + '...',
      requestId
    });
  }


  try {
    console.log('🎯 [INTELLIGENT ENGINE] Processing message:', {
      requestId,
      messageLength: userMessage?.length,
      hasHistory: conversationHistory?.length > 0,
      personalId,
      modelOverride: options.modelOverride || 'auto'
    });

    // Step 1: Route the query to get policy and model
    const routingOpts = {
      modelOverride: options.modelOverride,
      requestId
    };
    const routing = routeQuery(userMessage, routingOpts);
    console.log('🔀 [ROUTER] Query routing result:', { ...routing, requestId });

    const { policy, model } = routing;

    // Step 2: Use switch statement to decide action based on model
    let response;
    let apiUsed = false;

    switch (model) {
      case 'none':
        // Handle GREETING with static response - no API call
        response = getRandomGreeting();
        console.log('💬 [STATIC] Using static greeting response');
        break;

      case 'small':
        // Handle SIMPLE_QA with small, fast model + unified context
        console.log('🏃 [SMALL MODEL] Calling small model API with unified context...');
        // Use the enhanced buildEnhancedContext for context
        response = await callSmallModelAPI(userMessage, conversationHistory, { ...options, ragQuery, buildContext: buildEnhancedContext });
        apiUsed = true;
        break;

      case 'large':
        // Handle CODE_COMPLEX and REASONING_COMPLEX with large model + unified context
        console.log('🧠 [LARGE MODEL] Calling large model API with unified context...');
        // Use the enhanced buildEnhancedContext for context
        response = await callLargeModelAPI(userMessage, conversationHistory, { ...options, ragQuery, buildContext: buildEnhancedContext });
        apiUsed = true;
        break;

      default:
        // Fallback to small model for unknown routing
        console.log('⚠️ [FALLBACK] Unknown model type, using small model');
        // Use the enhanced buildEnhancedContext for context
        response = await callSmallModelAPI(userMessage, conversationHistory, { ...options, ragQuery, buildContext: buildEnhancedContext });
        apiUsed = true;
    }

    console.log('✅ [ENGINE] Response generated:', {
      policy,
      model,
      apiUsed,
      responseLength: response?.length
    });

    // Handle different response formats (string vs object)
    let finalResponse = response;
    let modelLabel = 'Unknown';

    if (typeof response === 'object' && response.content) {
      // New llmClient response format
      finalResponse = response.content;
      modelLabel = response.modelLabel || modelLabel;
    }

    // Calculate duration and final metadata
    const duration = Date.now() - startTime;

    console.log('✅ [INTELLIGENT ENGINE] Processing complete:', {
      requestId,
      policy,
      model,
      modelLabel,
      apiUsed,
      overridden: routing.overridden || false,
      responseLength: finalResponse?.length || 0,
      duration: `${duration}ms`
    });

    return {
      success: true,
      response: finalResponse,
      policy,
      model,
      modelLabel,
      apiUsed,
      overridden: routing.overridden || false,
      requestId,
      duration,
      timestamp: new Date().toISOString(),
      personalId
    };

  } catch (error) {
    console.error('❌ [ENGINE] Error processing message:', error);
    return {
      success: false,
      response: 'უკაცრავად, ტექნიკური შეცდომა მოხდა. გთხოვთ სცადოთ ხელახლა.',
      policy: 'ERROR',
      model: 'none',
      error: error.message,
      timestamp: new Date().toISOString(),
      personalId
    };
  }
}

/**
 * Call small model API - integrated with robust LLM client
 * @param {string} message - User message
 * @param {Array} history - Conversation history
 * @param {Object} opts - Additional options
 * @param {Function} opts.buildContext - Function to build context
 * @returns {Promise<Object>} - AI response with metadata
 */
async function callSmallModelAPI(message, history = [], opts = {}) {
  try {
    console.log('🔄 [SMALL API] Calling small model with unified context support...');

    const llmClient = require('../lib/llmClient');
    const SYSTEM_PROMPTS = require('../context/system_prompts');

    // Phase 3: Build Enhanced Context from all sensors (using RAG query for semantic search)
    const enhancedContext = await opts.buildContext(opts.ragQuery || message, { // Use passed buildContext
      conversationHistory: history
    });

    // Check if we have semantic context (primary) or need file-based fallback
    let enhancedMessage = message;

    if (enhancedContext && enhancedContext.contextText) { // Check for contextText from new buildEnhancedContext
      // Use the formatted unified context
      enhancedMessage = formatEnhancedPrompt(message, { semantic: enhancedContext.contextText }); // Pass contextText
      console.log('🧠 [UNIFIED CONTEXT] Using enhanced multi-sensor context');
    } else {
      // Fallback: Traditional file-based RAG if no semantic context
      console.log('⚠️ [FALLBACK] No semantic context, using file-based RAG...');

      const relevantFilePaths = await findRelevantFiles(message);
      let fileContext = '';

      if (relevantFilePaths.length > 0) {
          console.log('📁 [RAG] Found relevant files:', relevantFilePaths);
          const contentPromises = relevantFilePaths.map(filePath => readFileContent(filePath));
          const contents = await Promise.all(contentPromises);

          fileContext = contents.map((content, index) => {
              return `--- File: ${relevantFilePaths[index]} ---\n${content}\n--- End of File ---`;
          }).join('\n\n');
      }

      enhancedMessage = fileContext ?
          `User message: "${message}"\n\nHere is the content of relevant files from the codebase to help you answer:\n\n${fileContext}` :
          message;
    }

    // Phase 2: Integrate JSON Tool Instructions for Agent Mode
    const systemPrompt = SYSTEM_PROMPTS.SYSTEM_PROMPTS.base + '\n\n' + SYSTEM_PROMPTS.SYSTEM_PROMPTS.jsonToolInstructions;

    // Build messages for small model
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: enhancedMessage }
    ];

    // Use robust LLM client with timeout and error handling
    const initialResponse = await llmClient.callLLMWithFallback(messages, 'small', {
      ...opts,
      policy: 'SIMPLE_QA'
    });

    // Phase 2: Action Loop - Process potential tool calls
    const finalResponse = await processActionLoop(initialResponse, messages, 'small', opts);

    return finalResponse;

  } catch (error) {
    console.error('❌ [SMALL API] Fallback error:', error);
    return {
      content: 'უკაცრავად, ტექნიკური შეცდომა მოხდა მცირე მოდელთან კომუნიკაციისას.',
      policy: 'ERROR',
      model: 'none',
      modelLabel: 'System Error',
      isError: true
    };
  }
}

/**
 * Call large model API - integrated with existing Groq service
 * @param {string} message - User message
 * @param {Array} history - Conversation history
 * @param {Object} opts - Additional options
 * @param {Function} opts.buildContext - Function to build context
 * @returns {Promise<string>} - AI response
 */
async function callLargeModelAPI(message, history = [], opts = {}) {
  try {
    console.log('🔄 [LARGE API] Calling large model with unified context support...');

    const llmClient = require('../lib/llmClient');
    const SYSTEM_PROMPTS = require('../context/system_prompts');

    // Phase 3: Build Enhanced Context from all sensors (using RAG query for semantic search)
    const enhancedContext = await opts.buildContext(opts.ragQuery || message, { // Use passed buildContext
      conversationHistory: history
    });

    // Check if we have semantic context (primary) or need file-based fallback
    let enhancedMessage = message;

    if (enhancedContext && enhancedContext.contextText) { // Check for contextText from new buildEnhancedContext
      // Use the formatted unified context
      enhancedMessage = formatEnhancedPrompt(message, { semantic: enhancedContext.contextText }); // Pass contextText
      console.log('🧠 [UNIFIED CONTEXT] Using enhanced multi-sensor context');
    } else {
      // Fallback: Traditional file-based RAG if no semantic context
      console.log('⚠️ [FALLBACK] No semantic context, using file-based RAG...');

      const relevantFilePaths = await findRelevantFiles(message);
      let fileContext = '';

      if (relevantFilePaths.length > 0) {
          console.log('📁 [RAG] Found relevant files:', relevantFilePaths);
          const contentPromises = relevantFilePaths.map(filePath => readFileContent(filePath));
          const contents = await Promise.all(contentPromises);

          fileContext = contents.map((content, index) => {
              return `--- File: ${relevantFilePaths[index]} ---\n${content}\n--- End of File ---`;
          }).join('\n\n');
      }

      enhancedMessage = fileContext ?
          `User message: "${message}"\n\nHere is the content of relevant files from the codebase to help you answer:\n\n${fileContext}` :
          message;
    }

    // Phase 2: Integrate JSON Tool Instructions for Agent Mode
    const systemPrompt = SYSTEM_PROMPTS.SYSTEM_PROMPTS.base + '\n\n' + SYSTEM_PROMPTS.SYSTEM_PROMPTS.jsonToolInstructions;

    // Build messages for large model with enhanced context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: enhancedMessage }
    ];

    // Use robust LLM client with enhanced error handling and fallback
    const initialResponse = await llmClient.callLLMWithFallback(messages, 'large', {
      ...opts,
      policy: 'CODE_COMPLEX'
    });

    // Phase 2: Action Loop - Process potential tool calls
    const finalResponse = await processActionLoop(initialResponse, messages, 'large', opts);

    return finalResponse;

  } catch (error) {
    console.error('❌ [LARGE API] Error calling large model:', error);
    return {
      content: 'უკაცრავად, ტექნიკური შეცდომა მოხდა დიდ მოდელთან კომუნიკაციისას.',
      policy: 'ERROR',
      model: 'none',
      modelLabel: 'System Error',
      isError: true
    };
  }
}

// Enhanced Real File System Access Functions (Replit Assistant equivalent)

/**
 * Get all project files dynamically (like Replit Assistant)
 * @returns {Promise<Array<string>>} - Array of all project file paths
 */
async function getAllProjectFiles() {
  const allFiles = [];
  const projectRoot = process.cwd();
  const ignoredDirs = ['node_modules', '.git', '.replit', 'dist', 'build', '.next', 'coverage', '.nyc_output'];
  const ignoredFiles = ['.env', '.DS_Store', 'Thumbs.db'];

  async function scanDirectory(dirPath, relativePath = '') {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemName = item.name;
        const fullPath = path.join(dirPath, itemName);
        const relPath = path.join(relativePath, itemName).replace(/\\/g, '/');

        if (item.isDirectory()) {
          if (!ignoredDirs.includes(itemName) && !itemName.startsWith('.') && itemName !== 'tmp') {
            await scanDirectory(fullPath, relPath);
          }
        } else if (item.isFile()) {
          if (!ignoredFiles.includes(itemName) && !itemName.startsWith('.') && !itemName.endsWith('.log')) {
            // Only include code and config files
            const ext = path.extname(itemName).toLowerCase();
            const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.dart', '.vue', '.html', '.css', '.scss', '.less', '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.sql', '.sh', '.bat'];

            if (codeExts.includes(ext) || itemName === 'Dockerfile' || itemName === 'Makefile' || itemName.includes('package') || itemName.includes('config')) {
              allFiles.push(relPath);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ [REAL FILE ACCESS] Could not scan directory ${relativePath}:`, error.message);
    }
  }

  await scanDirectory(projectRoot);
  return allFiles;
}

/**
 * Find relevant project files based on query (intelligent selection like Replit Assistant)
 * @param {string} query - User query
 * @param {Array<string>} allFiles - All project files
 * @returns {Promise<Array<string>>} - Most relevant files
 */
async function findRelevantProjectFiles(query, allFiles) {
  const relevantFiles = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

  // Score each file based on relevance
  const fileScores = [];

  for (const filePath of allFiles) {
    let score = 0;
    const fileName = path.basename(filePath).toLowerCase();
    const dirPath = path.dirname(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();

    // Exact filename match
    if (queryWords.some(word => fileName.includes(word))) {
      score += 10;
    }

    // Directory relevance
    if (queryWords.some(word => dirPath.includes(word))) {
      score += 5;
    }

    // Extension relevance based on query context
    if (queryLower.includes('component') && ['.jsx', '.tsx'].includes(ext)) score += 8;
    if (queryLower.includes('style') && ['.css', '.scss', '.less'].includes(ext)) score += 8;
    if (queryLower.includes('config') && (fileName.includes('config') || ext === '.json')) score += 8;
    if (queryLower.includes('api') && filePath.includes('api')) score += 8;
    if (queryLower.includes('service') && fileName.includes('service')) score += 8;
    if (queryLower.includes('util') && fileName.includes('util')) score += 8;

    // Georgian language context
    if (/[ა-ჰ]/.test(query)) {
      if (fileName.includes('georgian') || fileName.includes('geo') || fileName.includes('ka')) score += 5;
      if (queryLower.includes('კომპონენტი') && ['.jsx', '.tsx'].includes(ext)) score += 8;
      if (queryLower.includes('სერვისი') && fileName.includes('service')) score += 8;
    }

    // Recent files get slight boost
    if (fileName.includes('recent') || fileName.includes('new') || fileName.includes('update')) score += 2;

    if (score > 0) {
      fileScores.push({ filePath, score });
    }
  }

  // Sort by score and return top files
  fileScores.sort((a, b) => b.score - a.score);
  return fileScores.slice(0, 15).map(item => item.filePath); // Top 15 most relevant
}

/**
 * Calculate file relevance score based on content analysis
 * @param {string} query - User query
 * @param {string} filePath - File path
 * @param {string} content - File content
 * @returns {number} - Relevance score (0-1)
 */
function calculateFileRelevance(query, filePath, content) {
  let score = 0;
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
  const fileName = path.basename(filePath).toLowerCase();

  // Direct query word matches in content
  for (const word of queryWords) {
    const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
    score += Math.min(matches * 0.1, 0.5); // Max 0.5 per word
  }

  // File name relevance
  if (queryWords.some(word => fileName.includes(word))) {
    score += 0.3;
  }

  // Content type relevance
  if (content.includes('export default') || content.includes('function ') || content.includes('class ')) {
    score += 0.1;
  }

  // Georgian language support
  if (/[ა-ჰ]/.test(query) && /[ა-ჰ]/.test(content)) {
    score += 0.2;
  }

  // Normalize score to 0-1 range
  return Math.min(score, 1.0);
}

module.exports = {
  processMessage,
  // Exporting the new functions as well
  buildEnhancedContext,
  classifyQuery
};
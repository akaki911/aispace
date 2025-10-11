'use strict';

const express = require('express');
const router = express.Router();

/**
 * Enhanced File Monitor API Routes
 * 
 * Provides endpoints for the Georgian AI Developer Panel to access
 * real-time file system intelligence and analysis insights.
 */

let enhancedFileMonitorService = null;

// Initialize service reference
const setEnhancedFileMonitorService = (service) => {
  enhancedFileMonitorService = service;
};

/**
 * GET /api/file-monitor/status
 * Get current file monitoring status and statistics
 */
router.get('/status', (req, res) => {
  try {
    if (!enhancedFileMonitorService) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not initialized',
        status: 'unavailable'
      });
    }

    const state = enhancedFileMonitorService.getState();
    
    res.json({
      success: true,
      status: state.isInitialized ? 'active' : 'initializing',
      data: {
        ...state,
        message: state.isInitialized 
          ? `📊 ${state.totalFiles} ფაილი მონიტორინგშია`
          : '🔄 სისტემა ინიციალიზდება...'
      }
    });

  } catch (error) {
    console.error('❌ [FILE MONITOR API] Status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      status: 'error'
    });
  }
});

/**
 * GET /api/file-monitor/recent-changes
 * Get recent file changes with AI insights
 */
router.get('/recent-changes', (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    const state = enhancedFileMonitorService.getState();
    
    res.json({
      success: true,
      data: {
        changes: state.recentChanges,
        total: state.totalFiles,
        analysisQueue: state.analysisQueueSize,
        message: `📝 ბოლო ${state.recentChanges.length} ცვლილება`
      }
    });

  } catch (error) {
    console.error('❌ [FILE MONITOR API] Recent changes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/file-monitor/file-analysis/:encodedPath
 * Get detailed analysis for a specific file
 */
router.get('/file-analysis/:encodedPath', (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    const filePath = decodeURIComponent(req.params.encodedPath);
    const analysis = enhancedFileMonitorService.getFileAnalysis(filePath);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: `File not found in monitoring system: ${filePath}`,
        message: `ფაილი ვერ მოიძებნა: ${filePath}`
      });
    }

    res.json({
      success: true,
      data: {
        ...analysis,
        message: `🔍 ${filePath} ანალიზის შედეგები`
      }
    });

  } catch (error) {
    console.error('❌ [FILE MONITOR API] File analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/file-monitor/project-insights
 * Get project-level insights and statistics
 */
router.get('/project-insights', async (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    // Generate fresh insights
    const insights = await enhancedFileMonitorService.generateProjectInsights();
    
    res.json({
      success: true,
      data: {
        insights,
        message: `📊 პროექტის ანალიზი დასრულდა - ${insights.totalFiles} ფაილი`
      }
    });

  } catch (error) {
    console.error('❌ [FILE MONITOR API] Project insights error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/file-monitor/security-report
 * Get security analysis report for the entire project
 */
router.get('/security-report', (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    const securityIssues = [];
    const filesWithIssues = [];
    let totalIssues = 0;

    // Collect security information from all monitored files
    for (const [filePath, fileInfo] of enhancedFileMonitorService.projectTree) {
      if (fileInfo.security && fileInfo.security.issues.length > 0) {
        filesWithIssues.push({
          path: filePath,
          level: fileInfo.security.level,
          issues: fileInfo.security.issues,
          lastAnalyzed: fileInfo.lastAnalyzed
        });
        totalIssues += fileInfo.security.issues.length;
        securityIssues.push(...fileInfo.security.issues);
      }
    }

    // Categorize issues by severity
    const issuesBySeverity = securityIssues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        summary: {
          totalIssues,
          affectedFiles: filesWithIssues.length,
          severity: issuesBySeverity,
          lastScan: new Date().toISOString()
        },
        files: filesWithIssues,
        message: totalIssues === 0 
          ? '🛡️ უსაფრთხოების პრობლემები ვერ მოიძებნა'
          : `⚠️ ${totalIssues} უსაფრთხოების საკითხი ${filesWithIssues.length} ფაილში`
      }
    });

  } catch (error) {
    console.error('❌ [FILE MONITOR API] Security report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/file-monitor/complexity-report
 * Get code complexity analysis for the project
 */
router.get('/complexity-report', (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    const complexityData = [];
    let totalComplexity = 0;
    let analyzedFiles = 0;

    // Collect complexity information
    for (const [filePath, fileInfo] of enhancedFileMonitorService.projectTree) {
      if (fileInfo.complexity !== undefined && fileInfo.complexity > 0) {
        complexityData.push({
          path: filePath,
          complexity: fileInfo.complexity,
          category: fileInfo.category,
          lastAnalyzed: fileInfo.lastAnalyzed
        });
        totalComplexity += fileInfo.complexity;
        analyzedFiles++;
      }
    }

    // Sort by complexity (highest first)
    complexityData.sort((a, b) => b.complexity - a.complexity);

    const averageComplexity = analyzedFiles > 0 ? Math.round(totalComplexity / analyzedFiles) : 0;
    const highComplexityFiles = complexityData.filter(f => f.complexity > 20);
    const mediumComplexityFiles = complexityData.filter(f => f.complexity > 10 && f.complexity <= 20);

    res.json({
      success: true,
      data: {
        summary: {
          totalFiles: analyzedFiles,
          averageComplexity,
          highComplexity: highComplexityFiles.length,
          mediumComplexity: mediumComplexityFiles.length,
          maxComplexity: complexityData.length > 0 ? complexityData[0].complexity : 0
        },
        files: complexityData.slice(0, 20), // Top 20 most complex files
        message: `🧮 კოდის სირთულის ანალიზი: საშუალო ${averageComplexity}, მაქსიმალური ${complexityData.length > 0 ? complexityData[0].complexity : 0}`
      }
    });

  } catch (error) {
    console.error('❌ [FILE MONITOR API] Complexity report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/file-monitor/force-analysis
 * Force analysis of a specific file or trigger project-wide re-analysis
 */
router.post('/force-analysis', async (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    const { filePath, projectWide } = req.body;

    if (projectWide) {
      // Trigger project-wide analysis
      const insights = await enhancedFileMonitorService.generateProjectInsights();
      
      res.json({
        success: true,
        data: {
          insights,
          message: '🔄 პროექტის სრული ანალიზი დასრულდა'
        }
      });
    } else if (filePath) {
      // Force analysis of specific file
      enhancedFileMonitorService.queueForAnalysis(filePath, 'manual');
      
      res.json({
        success: true,
        data: {
          filePath,
          message: `🔍 ${filePath} ანალიზისთვის დაემატა რიგში`
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Either filePath or projectWide parameter required'
      });
    }

  } catch (error) {
    console.error('❌ [FILE MONITOR API] Force analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/file-monitor/patterns
 * Get detected patterns across the project
 */
router.get('/patterns', (req, res) => {
  try {
    if (!enhancedFileMonitorService || !enhancedFileMonitorService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced File Monitor service not available'
      });
    }

    const { category, severity } = req.query;
    const patternData = new Map();
    let totalPatterns = 0;

    // Collect patterns from all files
    for (const [filePath, fileInfo] of enhancedFileMonitorService.projectTree) {
      if (fileInfo.patterns && fileInfo.patterns.length > 0) {
        for (const pattern of fileInfo.patterns) {
          // Filter by category if specified
          if (category && pattern.category !== category) continue;
          if (severity && pattern.severity !== severity) continue;

          const key = `${pattern.type}_${pattern.category}`;
          if (!patternData.has(key)) {
            patternData.set(key, {
              type: pattern.type,
              category: pattern.category,
              count: 0,
              files: new Set(),
              severity: pattern.severity
            });
          }

          const data = patternData.get(key);
          data.count += pattern.count || 1;
          data.files.add(filePath);
          totalPatterns += pattern.count || 1;
        }
      }
    }

    // Convert to array and add file count
    const patterns = Array.from(patternData.values()).map(pattern => ({
      ...pattern,
      fileCount: pattern.files.size,
      files: Array.from(pattern.files)
    }));

    // Sort by count (highest first)
    patterns.sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        patterns,
        summary: {
          totalPatterns,
          uniquePatterns: patterns.length,
          categories: [...new Set(patterns.map(p => p.category))]
        },
        message: `🔎 ${patterns.length} სახის pattern ნაპოვნია (${totalPatterns} სულ)`
      }
    });

    } catch (error) {
    console.error('❌ [FILE MONITOR API] Patterns error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// CommonJS exports - ensure proper module export
module.exports = { 
  router, 
  setEnhancedFileMonitorService 
};
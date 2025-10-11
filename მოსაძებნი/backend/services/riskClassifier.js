
const path = require('path');
const fs = require('fs');

/**
 * SOL-241 Risk Classifier Service
 * ავტომატურად განისაზღვრავს AutoImprove proposals-ების რისკის დონე
 */
class RiskClassifier {
  constructor() {
    this.riskRules = this.loadRiskRules();
    this.heuristics = this.loadHeuristics();
  }

  /**
   * Risk Rules Matrix - ფაილების მიხედვით რისკის განსაზღვრა
   */
  loadRiskRules() {
    return {
      // HIGH RISK - კრიტიკული სისტემური ფაილები
      high: [
        /^config\/.*$/,
        /^\.env.*$/,
        /^secrets?\/.*/,
        /^db\/migrations?\/.*/,
        /^backend\/.*firebaseAdmin\.js$/,
        /^backend\/.*index\.js$/,
        /^.*\/package\.json$/,
        /^.*\/package-lock\.json$/,
        /^.*\.replit$/,
        /^replit\.nix$/,
        /^vite\.config\.(js|ts)$/,
        /^backend\/middleware\/security\.js$/,
        /^backend\/routes\/admin_auth\.js$/,
        /^.*\/auth.*\.js$/,
        /^backend\/services\/fallbackResponder\.js$/,
        // Database და Migration ფაილები
        /firestore\.(rules|indexes).*$/,
        /firebase\.json$/
      ],
      
      // MEDIUM RISK - Core Services და Backend
      medium: [
        /^backend\/.*\.(js|ts)$/,
        
        /^backend\/routes\/.*$/,
        /^backend\/services\/.*$/,
        /^backend\/middleware\/.*$/,
        /^src\/contexts\/.*$/,
        /^src\/services\/.*$/,
        /^src\/hooks\/.*$/,
        // API endpoints
        /^pages\/api\/.*$/,
        /^backend\/routes\/.*$/
      ],
      
      // LOW RISK - UI/Frontend ფაილები
      low: [
        /^src\/components\/.*\.(tsx?|jsx?)$/,
        /^src\/.*\.(css|scss)$/,
        /^src\/styles\/.*$/,
        /^public\/.*$/,
        /^docs\/.*$/,
        /\.md$/,
        /^src\/pages\/(?!api).*$/,
        // სტილების ფაილები
        /\.(css|scss|less|styl)$/,
        /tailwind\.config\.js$/,
        /postcss\.config\.js$/
      ]
    };
  }

  /**
   * Heuristics - დამატებითი ფაქტორები რისკის გასაანგარიშებლად
   */
  loadHeuristics() {
    return {
      fileCountThresholds: {
        low: 3,
        medium: 8,
        high: 15
      },
      lineLimits: {
        low: 50,
        medium: 200,
        high: 500
      },
      criticalKeywords: [
        'delete',
        'drop',
        'truncate',
        'rm -rf',
        'removeAll',
        'clearAll',
        'auth',
        'password',
        'secret',
        'token',
        'private',
        'admin',
        'sudo',
        'root'
      ]
    };
  }

  /**
   * მთავარი ფუნქცია რისკის კლასიფიკაციისთვის
   */
  classifyRisk(proposal) {
    console.log(`🔍 [RISK] Classifying risk for proposal: ${proposal.id}`);
    
    const risks = {
      level: 'low',
      score: 0,
      reasons: [],
      factors: {}
    };

    try {
      // 1. File Path Analysis
      const pathRisk = this.analyzeFilePaths(proposal.files || []);
      risks.score += pathRisk.score;
      risks.reasons.push(...pathRisk.reasons);
      risks.factors.pathAnalysis = pathRisk;

      // 2. File Count Heuristic
      const countRisk = this.analyzeFileCount(proposal.files || []);
      risks.score += countRisk.score;
      risks.reasons.push(...countRisk.reasons);
      risks.factors.fileCount = countRisk;

      // 3. Content Analysis
      const contentRisk = this.analyzeContent(proposal);
      risks.score += contentRisk.score;
      risks.reasons.push(...contentRisk.reasons);
      risks.factors.contentAnalysis = contentRisk;

      // 4. Scope Analysis
      const scopeRisk = this.analyzeScope(proposal.scope || []);
      risks.score += scopeRisk.score;
      risks.reasons.push(...scopeRisk.reasons);
      risks.factors.scopeAnalysis = scopeRisk;

      // 5. Change Type Analysis
      const typeRisk = this.analyzeChangeType(proposal);
      risks.score += typeRisk.score;
      risks.reasons.push(...typeRisk.reasons);
      risks.factors.typeAnalysis = typeRisk;

      // Final risk level calculation
      risks.level = this.calculateFinalRiskLevel(risks.score);

      console.log(`✅ [RISK] Risk classification complete:`, {
        id: proposal.id,
        level: risks.level,
        score: risks.score,
        reasonCount: risks.reasons.length
      });

      return risks;
    } catch (error) {
      console.error(`❌ [RISK] Classification error for ${proposal.id}:`, error);
      return {
        level: 'high', // Default to HIGH on error for safety
        score: 100,
        reasons: [`Risk analysis failed: ${error.message}`],
        factors: { error: error.message }
      };
    }
  }

  /**
   * ფაილის path-ების ანალიზი
   */
  analyzeFilePaths(files) {
    const analysis = {
      score: 0,
      reasons: [],
      highRiskFiles: [],
      mediumRiskFiles: [],
      lowRiskFiles: []
    };

    files.forEach(file => {
      const filePath = file.path || file;
      
      // Check HIGH risk patterns
      for (const pattern of this.riskRules.high) {
        if (pattern.test(filePath)) {
          analysis.score += 30;
          analysis.highRiskFiles.push(filePath);
          analysis.reasons.push(`High-risk file: ${filePath}`);
          return; // Don't check other patterns for this file
        }
      }

      // Check MEDIUM risk patterns
      for (const pattern of this.riskRules.medium) {
        if (pattern.test(filePath)) {
          analysis.score += 10;
          analysis.mediumRiskFiles.push(filePath);
          analysis.reasons.push(`Medium-risk file: ${filePath}`);
          return;
        }
      }

      // Default to LOW risk
      analysis.lowRiskFiles.push(filePath);
    });

    return analysis;
  }

  /**
   * ფაილების რაოდენობის ანალიზი
   */
  analyzeFileCount(files) {
    const count = files.length;
    const thresholds = this.heuristics.fileCountThresholds;
    
    const analysis = {
      score: 0,
      reasons: [],
      fileCount: count
    };

    if (count >= thresholds.high) {
      analysis.score += 20;
      analysis.reasons.push(`High file count: ${count} files (threshold: ${thresholds.high})`);
    } else if (count >= thresholds.medium) {
      analysis.score += 5;
      analysis.reasons.push(`Medium file count: ${count} files (threshold: ${thresholds.medium})`);
    }

    return analysis;
  }

  /**
   * შინაარსის ანალიზი (diff, keywords)
   */
  analyzeContent(proposal) {
    const analysis = {
      score: 0,
      reasons: [],
      criticalKeywords: [],
      hasLargeChanges: false
    };

    // Check for critical keywords in description/summary
    const textToAnalyze = `${proposal.description || ''} ${proposal.summary || ''}`.toLowerCase();
    
    this.heuristics.criticalKeywords.forEach(keyword => {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        analysis.score += 15;
        analysis.criticalKeywords.push(keyword);
        analysis.reasons.push(`Critical keyword found: "${keyword}"`);
      }
    });

    // Check diff size if available
    if (proposal.patch && proposal.patch.diff) {
      const diffLines = proposal.patch.diff.split('\n').length;
      if (diffLines > this.heuristics.lineLimits.high) {
        analysis.score += 15;
        analysis.hasLargeChanges = true;
        analysis.reasons.push(`Large diff: ${diffLines} lines (threshold: ${this.heuristics.lineLimits.high})`);
      } else if (diffLines > this.heuristics.lineLimits.medium) {
        analysis.score += 5;
        analysis.reasons.push(`Medium diff: ${diffLines} lines (threshold: ${this.heuristics.lineLimits.medium})`);
      }
    }

    return analysis;
  }

  /**
   * Scope-ის ანალიზი
   */
  analyzeScope(scope) {
    const analysis = {
      score: 0,
      reasons: [],
      highRiskScopes: []
    };

    const highRiskScopes = ['backend', 'security', 'auth', 'admin', 'database'];
    
    scope.forEach(s => {
      if (highRiskScopes.includes(s.toLowerCase())) {
        analysis.score += 10;
        analysis.highRiskScopes.push(s);
        analysis.reasons.push(`High-risk scope: ${s}`);
      }
    });

    return analysis;
  }

  /**
   * ცვლილების ტიპის ანალიზი
   */
  analyzeChangeType(proposal) {
    const analysis = {
      score: 0,
      reasons: [],
      changeType: proposal.type || 'unknown'
    };

    const typeRiskMap = {
      'security': 25,
      'performance': 10,
      'bugfix': 5,
      'feature': 8,
      'refactor': 3,
      'style': 1
    };

    const riskScore = typeRiskMap[proposal.type] || 10;
    analysis.score += riskScore;

    if (riskScore >= 20) {
      analysis.reasons.push(`High-risk change type: ${proposal.type}`);
    } else if (riskScore >= 10) {
      analysis.reasons.push(`Medium-risk change type: ${proposal.type}`);
    }

    return analysis;
  }

  /**
   * საბოლოო რისკის დონის გაანგარიშება
   */
  calculateFinalRiskLevel(score) {
    if (score >= 50) {
      return 'high';
    } else if (score >= 20) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Guard ფუნქცია - High რისკის proposals ვერ გადადის Auto-Apply-ზე
   */
  checkAutoApplyEligibility(risk) {
    if (risk.level === 'high') {
      return {
        eligible: false,
        reason: 'High-risk proposals require manual approval',
        guardReason: 'AUTO_APPLY_BLOCKED_HIGH_RISK'
      };
    }

    return {
      eligible: true,
      reason: 'Risk level acceptable for auto-apply'
    };
  }

  /**
   * Risk badge-ის UI მონაცემები
   */
  getRiskBadgeData(risk) {
    const badgeMap = {
      'high': {
        color: 'red',
        icon: '⚠️',
        label: 'მაღალი რისკი',
        description: 'კრიტიკული ცვლილება - საჭიროებს ხელმოწერას'
      },
      'medium': {
        color: 'orange',
        icon: '⚡',
        label: 'საშუალო რისკი',
        description: 'ზომიერი რისკი - რეკომენდებულია ზედამხედველობა'
      },
      'low': {
        color: 'green',
        icon: '✅',
        label: 'დაბალი რისკი',
        description: 'უსაფრთხო ცვლილება - შეიძლება ავტო-გამოყენება'
      }
    };

    return badgeMap[risk.level] || badgeMap['medium'];
  }
}

module.exports = RiskClassifier;

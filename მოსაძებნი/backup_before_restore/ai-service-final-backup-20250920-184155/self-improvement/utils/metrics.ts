
import { ImprovementMetrics, CodeIssue, Improvement } from '../types';

/**
 * Calculate improvement metrics from analysis data
 * Pure functions for metrics computation
 */
export class MetricsCalculator {
  /**
   * Create initial metrics state
   */
  static createInitialMetrics(): ImprovementMetrics {
    return {
      totalIssuesFound: 0,
      issuesResolved: 0,
      performanceGains: 0,
      securityEnhancements: 0,
      codeQualityImprovement: 0,
      technicalDebtReduction: 0,
      lastUpdateTime: new Date().toISOString(),
      successRate: 100
    };
  }

  /**
   * Update metrics after issue resolution
   */
  static updateMetricsAfterResolution(
    currentMetrics: ImprovementMetrics,
    resolvedIssues: Improvement[]
  ): ImprovementMetrics {
    const performanceImprovements = resolvedIssues.filter(i => i.issue.type === 'performance').length;
    const securityImprovements = resolvedIssues.filter(i => i.issue.type === 'security').length;
    const qualityImprovements = resolvedIssues.filter(i => i.issue.type === 'quality').length;

    return {
      ...currentMetrics,
      issuesResolved: currentMetrics.issuesResolved + resolvedIssues.length,
      performanceGains: currentMetrics.performanceGains + performanceImprovements,
      securityEnhancements: currentMetrics.securityEnhancements + securityImprovements,
      codeQualityImprovement: currentMetrics.codeQualityImprovement + qualityImprovements,
      technicalDebtReduction: currentMetrics.technicalDebtReduction + this.calculateDebtReduction(resolvedIssues),
      lastUpdateTime: new Date().toISOString(),
      successRate: this.calculateSuccessRate(currentMetrics, resolvedIssues.length)
    };
  }

  /**
   * Calculate overall system health score (0-100)
   */
  static calculateHealthScore(metrics: ImprovementMetrics): number {
    const factors = [
      Math.min(metrics.successRate, 100),
      Math.max(0, 100 - (metrics.totalIssuesFound - metrics.issuesResolved) * 2),
      Math.min(metrics.performanceGains * 10, 100),
      Math.min(metrics.securityEnhancements * 15, 100),
      Math.min(metrics.codeQualityImprovement * 5, 100)
    ];

    return Math.round(factors.reduce((sum, factor) => sum + factor, 0) / factors.length);
  }

  /**
   * Generate performance trend analysis
   */
  static analyzePerformanceTrend(historicalMetrics: ImprovementMetrics[]): {
    trend: 'improving' | 'stable' | 'declining';
    score: number;
    recommendation: string;
  } {
    if (historicalMetrics.length < 2) {
      return {
        trend: 'stable',
        score: 50,
        recommendation: 'Need more data points for trend analysis'
      };
    }

    const latest = historicalMetrics[historicalMetrics.length - 1];
    const previous = historicalMetrics[historicalMetrics.length - 2];

    const improvementDelta = latest.issuesResolved - previous.issuesResolved;
    const successRateDelta = latest.successRate - previous.successRate;

    let trend: 'improving' | 'stable' | 'declining';
    let score = 50;
    let recommendation = '';

    if (improvementDelta > 0 && successRateDelta >= 0) {
      trend = 'improving';
      score = 80;
      recommendation = 'System is actively improving. Continue current optimization strategy.';
    } else if (improvementDelta === 0 && Math.abs(successRateDelta) < 5) {
      trend = 'stable';
      score = 60;
      recommendation = 'System is stable. Consider increasing improvement frequency.';
    } else {
      trend = 'declining';
      score = 30;
      recommendation = 'System needs attention. Review failed improvements and adjust strategy.';
    }

    return { trend, score, recommendation };
  }

  /**
   * Calculate technical debt reduction score
   */
  private static calculateDebtReduction(improvements: Improvement[]): number {
    return improvements.reduce((total, improvement) => {
      const severityMultiplier = {
        'CRITICAL': 4,
        'HIGH': 3,
        'MEDIUM': 2,
        'LOW': 1
      };
      
      return total + (severityMultiplier[improvement.issue.severity] || 1);
    }, 0);
  }

  /**
   * Calculate success rate based on historical data
   */
  private static calculateSuccessRate(
    currentMetrics: ImprovementMetrics,
    newResolutions: number
  ): number {
    const totalAttempts = currentMetrics.totalIssuesFound;
    const totalSuccesses = currentMetrics.issuesResolved + newResolutions;
    
    if (totalAttempts === 0) return 100;
    
    return Math.round((totalSuccesses / totalAttempts) * 100);
  }

  /**
   * Format metrics for Georgian language display
   */
  static formatMetricsInGeorgian(metrics: ImprovementMetrics): Record<string, string> {
    return {
      totalIssuesFound: `სულ ნაპოვნია ${metrics.totalIssuesFound} პრობლემა`,
      issuesResolved: `გადაწყვეტილია ${metrics.issuesResolved} პრობლემა`,
      performanceGains: `წარმადობა გაუმჯობესებულია ${metrics.performanceGains}-ჯერ`,
      securityEnhancements: `უსაფრთხოება გაძლიერებულია ${metrics.securityEnhancements}-ჯერ`,
      codeQualityImprovement: `კოდის ხარისხი გაუმჯობესებულია ${metrics.codeQualityImprovement} პუნქტით`,
      successRate: `წარმატების მაჩვენებელი: ${metrics.successRate}%`,
      lastUpdate: `ბოლო განახლება: ${new Date(metrics.lastUpdateTime).toLocaleDateString('ka-GE')}`
    };
  }
}

/**
 * Export utility functions for metrics operations
 */
export const metricsUtils = {
  createInitial: MetricsCalculator.createInitialMetrics,
  updateAfterResolution: MetricsCalculator.updateMetricsAfterResolution,
  calculateHealthScore: MetricsCalculator.calculateHealthScore,
  analyzePerformanceTrend: MetricsCalculator.analyzePerformanceTrend,
  formatInGeorgian: MetricsCalculator.formatMetricsInGeorgian
};

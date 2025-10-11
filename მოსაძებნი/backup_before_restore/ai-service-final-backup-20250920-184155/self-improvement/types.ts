
// Self-Improvement System Type Definitions
// Strict typed interfaces for Gurulo's self-improvement capabilities

export interface CodeIssue {
  id: string;
  type: 'performance' | 'security' | 'quality' | 'duplication' | 'legacy';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  file: string;
  line: number;
  description: string;
  context: string;
  suggestion: string;
}

export interface PerformanceIssue extends CodeIssue {
  type: 'performance';
  metrics: {
    executionTime?: number;
    memoryUsage?: number;
    complexity?: number;
  };
}

export interface SecurityIssue extends CodeIssue {
  type: 'security';
  vulnerabilityType: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cweId?: string;
}

export interface LegacyCode extends CodeIssue {
  type: 'legacy';
  deprecatedFeatures: string[];
  modernAlternatives: string[];
}

export interface DuplicationReport {
  duplicates: Array<{
    files: string[];
    similarity: number;
    lines: number;
    suggestion: string;
  }>;
  totalDuplicates: number;
  potentialSavings: number;
}

export interface Optimization {
  type: 'refactor' | 'modernize' | 'optimize' | 'secure';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  implementation: string;
}

export interface RefactoringPlan {
  targetFiles: string[];
  steps: string[];
  estimatedTime: number;
  risks: string[];
  benefits: string[];
}

export interface FeatureProposal {
  name: string;
  description: string;
  motivation: string;
  implementation: RefactoringPlan;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ArchitectureUpdate {
  component: string;
  currentState: string;
  proposedState: string;
  migrationPath: string[];
  dependencies: string[];
}

export interface Improvement {
  id: string;
  issue: CodeIssue;
  optimization: Optimization;
  refactoringPlan: RefactoringPlan;
  codeComparison: CodeComparison;
  impact: ImpactAnalysis;
  explanation: DetailedExplanation;
}

export interface ImpactAnalysis {
  performance: number; // -1 to 1 scale
  security: number;
  maintainability: number;
  readability: number;
  testability: number;
  affectedFiles: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ImprovementProposal {
  improvements: Improvement[];
  summary: string;
  totalImpact: ImpactAnalysis;
  recommendedOrder: string[]; // improvement IDs in recommended order
}

export interface DetailedExplanation {
  problem: string;
  solution: string;
  reasoning: string;
  alternatives: string[];
  georgianExplanation: string; // Georgian language explanation
}

export interface CodeComparison {
  before: string;
  after: string;
  diff: string;
  highlights: string[];
}

export interface TestResults {
  passed: boolean;
  testCount: number;
  coverage: number;
  errors: string[];
  performance: {
    before: number;
    after: number;
    improvement: number;
  };
}

export interface UpdateResult {
  success: boolean;
  appliedChanges: string[];
  failedChanges: string[];
  testResults: TestResults;
  rollbackAvailable: boolean;
}

export interface CategorizedIssues {
  performance: PerformanceIssue[];
  security: SecurityIssue[];
  quality: CodeIssue[];
  duplication: DuplicationReport;
  legacy: LegacyCode[];
  totalIssues: number;
  priorityBreakdown: Record<string, number>;
}

export interface AnalysisReport {
  timestamp: string;
  scannedFiles: string[];
  categorizedIssues: CategorizedIssues;
  recommendations: string[];
  metrics: ImprovementMetrics;
}

export interface UserDecision {
  approvedImprovements: string[]; // improvement IDs
  rejectedImprovements: string[];
  postponedImprovements: string[];
  customInstructions: string[];
}

export interface ImprovementMetrics {
  totalIssuesFound: number;
  issuesResolved: number;
  performanceGains: number;
  securityEnhancements: number;
  codeQualityImprovement: number;
  technicalDebtReduction: number;
  lastUpdateTime: string;
  successRate: number;
}

export interface SelfImprovementSystem {
  scanCodebase(): Promise<AnalysisReport>;
  categorizeProblems(issues: CodeIssue[]): CategorizedIssues;
  generateImprovement(issue: CodeIssue): Promise<Improvement>;
  presentToUser(improvements: Improvement[]): Promise<UserDecision>;
  applyApprovedChanges(approvedChanges: Improvement[]): Promise<UpdateResult>;
  rollbackChanges(changeId: string): Promise<boolean>;
  getMetrics(): ImprovementMetrics;
  scheduleAnalysis(schedule: 'daily' | 'weekly' | 'monthly'): void;
}

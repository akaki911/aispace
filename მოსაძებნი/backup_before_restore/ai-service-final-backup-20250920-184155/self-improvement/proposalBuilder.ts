
interface EvidenceEntry {
  file: string;
  line: number;
  rule: string;
  note: string;
}

interface Proposal {
  title: string;
  severity: 'P1' | 'P2' | 'P3';
  summary: string;
  evidence: EvidenceEntry[];
  patch: {
    type: 'unified';
    diff: string;
  };
  risk?: 'low' | 'medium' | 'high';
  rollbackPlan?: string;
}

class ProposalBuilder {
  
  async buildProposals(evidence: EvidenceEntry[]): Promise<Proposal[]> {
    console.log('📝 [PROPOSAL-BUILDER] Building proposals from evidence...');
    
    if (evidence.length === 0) {
      return [];
    }
    
    // Group evidence by file and rule type
    const groupedEvidence = this.groupEvidence(evidence);
    
    const proposals: Proposal[] = [];
    
    // Build proposals for each group
    for (const [groupKey, groupEvidence] of Object.entries(groupedEvidence)) {
      const proposal = this.buildProposal(groupKey, groupEvidence);
      if (proposal) {
        proposals.push(proposal);
      }
    }
    
    console.log(`✅ [PROPOSAL-BUILDER] Generated ${proposals.length} proposals`);
    return proposals;
  }

  private groupEvidence(evidence: EvidenceEntry[]): Record<string, EvidenceEntry[]> {
    const groups: Record<string, EvidenceEntry[]> = {};
    
    for (const entry of evidence) {
      // Group by file and rule category
      const category = this.getRuleCategory(entry.rule);
      const groupKey = `${category}:${entry.file}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(entry);
    }
    
    // Split large groups into smaller atomic proposals (max 3 files per proposal)
    const atomicGroups: Record<string, EvidenceEntry[]> = {};
    
    for (const [groupKey, groupEvidence] of Object.entries(groups)) {
      if (groupEvidence.length <= 5) {
        atomicGroups[groupKey] = groupEvidence;
      } else {
        // Split into smaller chunks
        for (let i = 0; i < groupEvidence.length; i += 3) {
          const chunkKey = `${groupKey}_chunk_${Math.floor(i / 3) + 1}`;
          atomicGroups[chunkKey] = groupEvidence.slice(i, i + 3);
        }
      }
    }
    
    return atomicGroups;
  }

  private buildProposal(groupKey: string, evidence: EvidenceEntry[]): Proposal | null {
    if (evidence.length === 0) return null;
    
    const [category] = groupKey.split(':');
    const files = [...new Set(evidence.map(e => e.file))];
    const mainFile = files[0];
    
    const severity = this.determineSeverity(category, evidence);
    const title = this.generateTitle(category, mainFile, evidence);
    const summary = this.generateSummary(category, files, evidence);
    const risk = this.determineRisk(category, evidence);
    
    return {
      title,
      severity,
      summary,
      evidence,
      patch: {
        type: 'unified',
        diff: '' // Empty diff - no actual mutations proposed
      },
      risk,
      rollbackPlan: 'Manual review and revert if needed'
    };
  }

  private getRuleCategory(rule: string): string {
    // Security-related rules
    if (rule.includes('security') || rule.includes('vulnerability') || 
        rule.includes('auth') || rule.includes('cors') || 
        rule.includes('csrf') || rule.includes('xss')) {
      return 'security';
    }
    
    // Performance-related rules
    if (rule.includes('performance') || rule.includes('memory') || 
        rule.includes('unused') || rule.includes('async') ||
        rule.includes('sync') || rule.includes('blocking')) {
      return 'performance';
    }
    
    // TypeScript errors
    if (rule.startsWith('TS')) {
      return 'typescript';
    }
    
    // Dependencies
    if (rule.includes('dependency') || rule.includes('import') || 
        rule.includes('missing') || rule.includes('unused-dependency')) {
      return 'dependencies';
    }
    
    // Code quality
    if (rule.includes('complexity') || rule.includes('cognitive') || 
        rule.includes('nested') || rule.includes('readability')) {
      return 'quality';
    }
    
    // Style/formatting
    return 'style';
  }

  private determineSeverity(category: string, evidence: EvidenceEntry[]): 'P1' | 'P2' | 'P3' {
    // P1: Security and critical performance issues
    if (category === 'security') return 'P1';
    
    if (category === 'performance' && evidence.some(e => 
        e.note.includes('blocking') || e.note.includes('sync') || e.note.includes('memory')
    )) {
      return 'P1';
    }
    
    // P2: TypeScript errors, missing dependencies, quality issues
    if (category === 'typescript' || category === 'dependencies' || category === 'quality') {
      return 'P2';
    }
    
    // P3: Style and minor issues
    return 'P3';
  }

  private generateTitle(category: string, mainFile: string, evidence: EvidenceEntry[]): string {
    const fileName = mainFile.split('/').pop() || mainFile;
    const issueCount = evidence.length;
    
    switch (category) {
      case 'security':
        return `Security: Fix vulnerabilities in ${fileName}`;
      case 'performance':
        return `Performance: Optimize ${fileName}`;
      case 'typescript':
        return `TypeScript: Fix ${issueCount} type errors in ${fileName}`;
      case 'dependencies':
        return `Dependencies: Clean up unused/missing deps`;
      case 'quality':
        return `Quality: Improve code quality in ${fileName}`;
      default:
        return `Refactor: Fix ${issueCount} issues in ${fileName}`;
    }
  }

  private generateSummary(category: string, files: string[], evidence: EvidenceEntry[]): string {
    const fileList = files.length > 1 ? `${files.length} files` : files[0];
    const issueCount = evidence.length;
    
    const georgianSummary = this.getGeorgianSummary(category, issueCount);
    const englishSummary = this.getEnglishSummary(category, fileList, evidence);
    
    return `${georgianSummary} | ${englishSummary}`;
  }

  private getGeorgianSummary(category: string, count: number): string {
    switch (category) {
      case 'security':
        return `უსაფრთხოების ${count} პრობლემის გადაწყვეტა`;
      case 'performance':
        return `წარმადობის ${count} ოპტიმიზაცია`;
      case 'typescript':
        return `TypeScript-ის ${count} შეცდომის გასწორება`;
      case 'dependencies':
        return `დამოკიდებულებების გასუფთავება`;
      case 'quality':
        return `კოდის ხარისხის ${count} გაუმჯობესება`;
      default:
        return `${count} პრობლემის გადაწყვეტა`;
    }
  }

  private getEnglishSummary(category: string, fileList: string, evidence: EvidenceEntry[]): string {
    const mainIssues = evidence.slice(0, 3).map(e => e.note).join('; ');
    return `Fix ${category} issues in ${fileList}: ${mainIssues}${evidence.length > 3 ? '...' : ''}`;
  }

  private determineRisk(category: string, evidence: EvidenceEntry[]): 'low' | 'medium' | 'high' {
    // High risk for security issues
    if (category === 'security') return 'high';
    
    // Medium risk for TypeScript errors and performance issues
    if (category === 'typescript' || category === 'performance') return 'medium';
    
    // Low risk for style and minor quality issues
    return 'low';
  }
}

export const proposalBuilder = new ProposalBuilder();


import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getFileAllowlist } from './utils/fsUtils';

interface EvidenceEntry {
  file: string;
  line: number;
  rule: string;
  note: string;
}

interface DiscoveryResult {
  evidence: EvidenceEntry[];
  evidenceCount: number;
  skippedTools: string[];
}

class DiscoveryRunner {
  private projectRoot: string;
  private skippedTools: string[] = [];
  private allowlist: Set<string>;

  constructor() {
    this.projectRoot = process.cwd();
    this.allowlist = getFileAllowlist();
  }

  async runDiscovery(): Promise<DiscoveryResult> {
    console.log('🔍 [DISCOVERY] Starting safe repository scan...');
    this.skippedTools = [];
    
    const evidence: EvidenceEntry[] = [];
    
    // Run TypeScript compile check
    const tscEvidence = await this.runTypeScriptCheck();
    evidence.push(...tscEvidence);
    
    // Run ESLint if config exists
    const eslintEvidence = await this.runESLintCheck();
    evidence.push(...eslintEvidence);
    
    // Run depcheck if available
    const depcheckEvidence = await this.runDepcheck();
    evidence.push(...depcheckEvidence);
    
    // Run ts-prune if available
    const tsPruneEvidence = await this.runTsPrune();
    evidence.push(...tsPruneEvidence);
    
    // Run dependency-cruiser if config exists
    const depCruiserEvidence = await this.runDependencyCruiser();
    evidence.push(...depCruiserEvidence);
    
    console.log(`📊 [DISCOVERY] Scan completed: ${evidence.length} evidence entries, ${this.skippedTools.length} tools skipped`);
    
    return {
      evidence,
      evidenceCount: evidence.length,
      skippedTools: [...this.skippedTools]
    };
  }

  private async runTypeScriptCheck(): Promise<EvidenceEntry[]> {
    try {
      console.log('🔧 [DISCOVERY] Running TypeScript compile check...');
      
      // Check if tsconfig.json exists
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) {
        this.skippedTools.push('tsc (no tsconfig.json)');
        return [];
      }
      
      const output = await this.runCommand('npx', ['tsc', '--noEmit']);
      return this.parseTscOutput(output.stderr);
      
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] TypeScript check failed:', error.message);
      this.skippedTools.push('tsc (execution failed)');
      return [];
    }
  }

  private async runESLintCheck(): Promise<EvidenceEntry[]> {
    try {
      console.log('🔧 [DISCOVERY] Running ESLint check...');
      
      // Check if eslint config exists
      const eslintConfigs = ['eslint.config.js', '.eslintrc.js', '.eslintrc.json', '.eslintrc'];
      const hasConfig = eslintConfigs.some(config => 
        fs.existsSync(path.join(this.projectRoot, config))
      );
      
      if (!hasConfig) {
        this.skippedTools.push('eslint (no config found)');
        return [];
      }
      
      const output = await this.runCommand('npx', ['eslint', '.', '--format', 'json']);
      return this.parseESLintOutput(output.stdout);
      
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] ESLint check failed:', error.message);
      this.skippedTools.push('eslint (execution failed)');
      return [];
    }
  }

  private async runDepcheck(): Promise<EvidenceEntry[]> {
    try {
      console.log('🔧 [DISCOVERY] Running depcheck...');
      
      const output = await this.runCommand('npx', ['depcheck', '--json']);
      return this.parseDepcheckOutput(output.stdout);
      
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] Depcheck failed:', error.message);
      this.skippedTools.push('depcheck (not available)');
      return [];
    }
  }

  private async runTsPrune(): Promise<EvidenceEntry[]> {
    try {
      console.log('🔧 [DISCOVERY] Running ts-prune...');
      
      const output = await this.runCommand('npx', ['ts-prune']);
      return this.parseTsPruneOutput(output.stdout);
      
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] ts-prune failed:', error.message);
      this.skippedTools.push('ts-prune (not available)');
      return [];
    }
  }

  private async runDependencyCruiser(): Promise<EvidenceEntry[]> {
    try {
      console.log('🔧 [DISCOVERY] Running dependency-cruiser...');
      
      // Check if config exists
      const configPath = path.join(this.projectRoot, '.dependency-cruiser.js');
      if (!fs.existsSync(configPath)) {
        this.skippedTools.push('dependency-cruiser (no config)');
        return [];
      }
      
      const output = await this.runCommand('npx', ['depcruise', '--output-type', 'json', 'src']);
      return this.parseDepCruiserOutput(output.stdout);
      
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] dependency-cruiser failed:', error.message);
      this.skippedTools.push('dependency-cruiser (execution failed)');
      return [];
    }
  }

  private runCommand(command: string, args: string[]): Promise<{stdout: string, stderr: string}> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ stdout, stderr });
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        process.kill();
        reject(new Error('Command timeout'));
      }, 30000);
    });
  }

  private parseTscOutput(stderr: string): EvidenceEntry[] {
    const evidence: EvidenceEntry[] = [];
    const lines = stderr.split('\n');
    
    for (const line of lines) {
      const match = line.match(/(.+\.tsx?)\((\d+),\d+\): error TS(\d+): (.+)/);
      if (match) {
        const filePath = match[1];
        const relativePath = path.relative(this.projectRoot, filePath);
        
        // Enhanced security validation
        if (this.isSecureFilePath(relativePath)) {
          evidence.push({
            file: relativePath,
            line: parseInt(match[2]),
            rule: `TS${match[3]}`,
            note: match[4].trim()
          });
        } else {
          console.log(`🚨 [DISCOVERY] SECURITY: Blocked access to ${relativePath}`);
        }
      }
    }
    
    return evidence;
  }

  private isSecureFilePath(filePath: string): boolean {
    // Check allowlist first
    if (!this.allowlist.has(filePath)) {
      return false;
    }

    // Additional security checks
    const normalizedPath = path.normalize(filePath);
    
    // Block path traversal attempts
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
      console.log(`🚨 [DISCOVERY] Path traversal detected: ${filePath}`);
      return false;
    }

    // Block access to sensitive directories
    const sensitiveDirs = ['node_modules', '.git', '.env', 'backup_', 'attached_assets'];
    if (sensitiveDirs.some(dir => normalizedPath.includes(dir))) {
      console.log(`🚨 [DISCOVERY] Sensitive directory access blocked: ${filePath}`);
      return false;
    }

    // Block sensitive file types
    const sensitiveFiles = ['.env', '.key', '.json', '.secrets'];
    if (sensitiveFiles.some(ext => normalizedPath.endsWith(ext) && !normalizedPath.includes('tsconfig'))) {
      console.log(`🚨 [DISCOVERY] Sensitive file type blocked: ${filePath}`);
      return false;
    }

    return true;
  }

  private parseESLintOutput(stdout: string): EvidenceEntry[] {
    const evidence: EvidenceEntry[] = [];
    
    try {
      const results = JSON.parse(stdout);
      
      for (const result of results) {
        const relativePath = result.filePath.replace(this.projectRoot + '/', '');
        
        // Enhanced security validation
        if (this.isSecureFilePath(relativePath)) {
          for (const message of result.messages || []) {
            evidence.push({
              file: relativePath,
              line: message.line || 1,
              rule: message.ruleId || 'eslint',
              note: message.message
            });
          }
        } else {
          console.log(`🚨 [DISCOVERY] SECURITY: Blocked ESLint access to ${relativePath}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] Failed to parse ESLint output:', error.message);
    }
    
    return evidence;
  }

  private parseDepcheckOutput(stdout: string): EvidenceEntry[] {
    const evidence: EvidenceEntry[] = [];
    
    try {
      const result = JSON.parse(stdout);
      
      // Unused dependencies (package.json is usually allowed)
      if (this.allowlist.has('package.json')) {
        for (const dep of result.dependencies || []) {
          evidence.push({
            file: 'package.json',
            line: 1,
            rule: 'unused-dependency',
            note: `Unused dependency: ${dep}`
          });
        }
      }
      
      // Missing dependencies
      for (const [file, deps] of Object.entries(result.missing || {})) {
        const relativePath = file.replace(this.projectRoot + '/', '');
        
        // Check if file is in allowlist
        if (this.allowlist.has(relativePath)) {
          for (const dep of deps as string[]) {
            evidence.push({
              file: relativePath,
              line: 1,
              rule: 'missing-dependency',
              note: `Missing dependency: ${dep}`
            });
          }
        } else {
          console.log(`⚠️ [DISCOVERY] Skipping non-allowed file: ${relativePath}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] Failed to parse depcheck output:', error.message);
    }
    
    return evidence;
  }

  private parseTsPruneOutput(stdout: string): EvidenceEntry[] {
    const evidence: EvidenceEntry[] = [];
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const match = line.match(/(.+\.tsx?):(\d+) - (.+)/);
      if (match) {
        const filePath = match[1];
        const relativePath = path.relative(this.projectRoot, filePath);
        
        // Check if file is in allowlist
        if (this.allowlist.has(relativePath)) {
          evidence.push({
            file: relativePath,
            line: parseInt(match[2]),
            rule: 'unused-export',
            note: match[3].trim()
          });
        } else {
          console.log(`⚠️ [DISCOVERY] Skipping non-allowed file: ${relativePath}`);
        }
      }
    }
    
    return evidence;
  }

  private parseDepCruiserOutput(stdout: string): EvidenceEntry[] {
    const evidence: EvidenceEntry[] = [];
    
    try {
      const result = JSON.parse(stdout);
      
      for (const module of result.modules || []) {
        for (const rule of module.rules || []) {
          if (rule.severity === 'error' || rule.severity === 'warn') {
            evidence.push({
              file: module.source,
              line: 1,
              rule: rule.name,
              note: rule.comment || 'Dependency rule violation'
            });
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ [DISCOVERY] Failed to parse dependency-cruiser output:', error.message);
    }
    
    return evidence;
  }
}

export const discoveryRunner = new DiscoveryRunner();

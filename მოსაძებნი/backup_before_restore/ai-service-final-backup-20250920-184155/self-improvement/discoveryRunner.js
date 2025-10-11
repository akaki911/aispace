"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoveryRunner = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DiscoveryRunner {
    constructor() {
        this.skippedTools = [];
        this.projectRoot = process.cwd();
    }
    async runDiscovery() {
        console.log('🔍 [DISCOVERY] Starting safe repository scan...');
        this.skippedTools = [];
        const evidence = [];
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
    async runTypeScriptCheck() {
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
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] TypeScript check failed:', error.message);
            this.skippedTools.push('tsc (execution failed)');
            return [];
        }
    }
    async runESLintCheck() {
        try {
            console.log('🔧 [DISCOVERY] Running ESLint check...');
            // Check if eslint config exists
            const eslintConfigs = ['eslint.config.js', '.eslintrc.js', '.eslintrc.json', '.eslintrc'];
            const hasConfig = eslintConfigs.some(config => fs.existsSync(path.join(this.projectRoot, config)));
            if (!hasConfig) {
                this.skippedTools.push('eslint (no config found)');
                return [];
            }
            const output = await this.runCommand('npx', ['eslint', '.', '--format', 'json']);
            return this.parseESLintOutput(output.stdout);
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] ESLint check failed:', error.message);
            this.skippedTools.push('eslint (execution failed)');
            return [];
        }
    }
    async runDepcheck() {
        try {
            console.log('🔧 [DISCOVERY] Running depcheck...');
            const output = await this.runCommand('npx', ['depcheck', '--json']);
            return this.parseDepcheckOutput(output.stdout);
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] Depcheck failed:', error.message);
            this.skippedTools.push('depcheck (not available)');
            return [];
        }
    }
    async runTsPrune() {
        try {
            console.log('🔧 [DISCOVERY] Running ts-prune...');
            const output = await this.runCommand('npx', ['ts-prune']);
            return this.parseTsPruneOutput(output.stdout);
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] ts-prune failed:', error.message);
            this.skippedTools.push('ts-prune (not available)');
            return [];
        }
    }
    async runDependencyCruiser() {
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
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] dependency-cruiser failed:', error.message);
            this.skippedTools.push('dependency-cruiser (execution failed)');
            return [];
        }
    }
    runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)(command, args, {
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
    parseTscOutput(stderr) {
        const evidence = [];
        const lines = stderr.split('\n');
        for (const line of lines) {
            const match = line.match(/(.+\.tsx?)\((\d+),\d+\): error TS(\d+): (.+)/);
            if (match) {
                evidence.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    rule: `TS${match[3]}`,
                    note: match[4].trim()
                });
            }
        }
        return evidence;
    }
    parseESLintOutput(stdout) {
        const evidence = [];
        try {
            const results = JSON.parse(stdout);
            for (const result of results) {
                for (const message of result.messages || []) {
                    evidence.push({
                        file: result.filePath.replace(this.projectRoot + '/', ''),
                        line: message.line || 1,
                        rule: message.ruleId || 'eslint',
                        note: message.message
                    });
                }
            }
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] Failed to parse ESLint output:', error.message);
        }
        return evidence;
    }
    parseDepcheckOutput(stdout) {
        const evidence = [];
        try {
            const result = JSON.parse(stdout);
            // Unused dependencies
            for (const dep of result.dependencies || []) {
                evidence.push({
                    file: 'package.json',
                    line: 1,
                    rule: 'unused-dependency',
                    note: `Unused dependency: ${dep}`
                });
            }
            // Missing dependencies
            for (const [file, deps] of Object.entries(result.missing || {})) {
                for (const dep of deps) {
                    evidence.push({
                        file: file.replace(this.projectRoot + '/', ''),
                        line: 1,
                        rule: 'missing-dependency',
                        note: `Missing dependency: ${dep}`
                    });
                }
            }
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] Failed to parse depcheck output:', error.message);
        }
        return evidence;
    }
    parseTsPruneOutput(stdout) {
        const evidence = [];
        const lines = stdout.split('\n');
        for (const line of lines) {
            const match = line.match(/(.+\.tsx?):(\d+) - (.+)/);
            if (match) {
                evidence.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    rule: 'unused-export',
                    note: match[3].trim()
                });
            }
        }
        return evidence;
    }
    parseDepCruiserOutput(stdout) {
        const evidence = [];
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
        }
        catch (error) {
            console.warn('⚠️ [DISCOVERY] Failed to parse dependency-cruiser output:', error.message);
        }
        return evidence;
    }
}
exports.discoveryRunner = new DiscoveryRunner();

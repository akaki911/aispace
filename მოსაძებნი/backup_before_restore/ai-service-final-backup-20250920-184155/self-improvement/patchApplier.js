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
exports.dryRunApply = dryRunApply;
exports.applyOnBranch = applyOnBranch;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const preflight_1 = require("./preflight");
const fsUtils_1 = require("./utils/fsUtils");
async function dryRunApply(patch, allowlist, branchNamePrefix = "ai-proposal") {
    console.log('🧪 [DRY-RUN] Starting dry run patch application...');
    const branchName = `${branchNamePrefix}-${Date.now()}`;
    const tmpPath = path.join(os.tmpdir(), branchName);
    try {
        // Create temporary worktree
        const worktreeResult = await runGitCommand(['worktree', 'add', '-B', branchName, tmpPath, 'HEAD']);
        if (worktreeResult.exitCode !== 0) {
            // Fallback: copy repo to temp directory
            console.warn('⚠️ [DRY-RUN] Git worktree failed, using copy fallback');
            await copyRepoToTemp(process.cwd(), tmpPath);
        }
        // Apply patch
        const applyResult = await applyPatch(patch, tmpPath, allowlist);
        if (!applyResult.ok) {
            return applyResult;
        }
        // Run preflight checks
        const preflightResult = await (0, preflight_1.runPreflight)(tmpPath);
        return {
            ok: true,
            checklist: preflightResult,
            logs: preflightResult.logs
        };
    }
    catch (error) {
        return {
            ok: false,
            reason: `Dry run failed: ${error.message}`
        };
    }
    finally {
        // Clean up
        await cleanupWorktree(branchName, tmpPath);
    }
}
async function applyOnBranch(patch, allowlist, branchName) {
    console.log(`🚀 [APPLY] Applying patch on branch: ${branchName}`);
    const tmpPath = path.join(os.tmpdir(), `${branchName}-apply`);
    try {
        // Create worktree for application
        const worktreeResult = await runGitCommand(['worktree', 'add', '-B', branchName, tmpPath, 'HEAD']);
        if (worktreeResult.exitCode !== 0) {
            // Fallback: copy repo to temp directory
            console.warn('⚠️ [APPLY] Git worktree failed, using copy fallback');
            await copyRepoToTemp(process.cwd(), tmpPath);
        }
        // Apply patch
        const applyResult = await applyPatch(patch, tmpPath, allowlist);
        if (!applyResult.ok) {
            return applyResult;
        }
        // Run preflight checks
        const preflightResult = await (0, preflight_1.runPreflight)(tmpPath);
        // Check if all critical gates pass
        const criticalGates = ['tsc', 'eslint', 'build'];
        const failedGates = criticalGates.filter(gate => preflightResult[gate] === 'fail');
        if (failedGates.length > 0) {
            return {
                ok: false,
                reason: `Preflight gates failed: ${failedGates.join(', ')}`,
                checklist: preflightResult
            };
        }
        // Commit changes
        await runGitCommand(['add', '.'], tmpPath);
        const commitResult = await runGitCommand([
            'commit',
            '-m',
            `AI-generated proposal: ${branchName}`
        ], tmpPath);
        if (commitResult.exitCode !== 0) {
            return {
                ok: false,
                reason: `Failed to commit changes: ${commitResult.output}`
            };
        }
        // Get commit SHA
        const shaResult = await runGitCommand(['rev-parse', 'HEAD'], tmpPath);
        const commitSha = shaResult.output.trim();
        // Push branch
        const pushResult = await runGitCommand(['push', 'origin', branchName], tmpPath);
        if (pushResult.exitCode !== 0) {
            return {
                ok: false,
                reason: `Failed to push branch: ${pushResult.output}`,
                checklist: preflightResult
            };
        }
        return {
            ok: true,
            branchName,
            commitSha,
            checklist: preflightResult,
            logs: preflightResult.logs
        };
    }
    catch (error) {
        return {
            ok: false,
            reason: `Apply failed: ${error.message}`
        };
    }
    finally {
        // Clean up
        await cleanupWorktree(branchName, tmpPath);
    }
}
async function applyPatch(patch, workingDir, allowlist) {
    if (patch.type === 'unified' && patch.diff) {
        return await applyUnifiedDiff(patch.diff, workingDir, allowlist);
    }
    else if (patch.type === 'ops' && patch.ops) {
        return await applyOpsArray(patch.ops, workingDir, allowlist);
    }
    return {
        ok: false,
        reason: 'Invalid patch format'
    };
}
async function applyUnifiedDiff(diff, workingDir, allowlist) {
    console.log('📝 [PATCH] Applying unified diff...');
    const lines = diff.split('\n');
    let currentFile = '';
    let currentChanges = [];
    for (const line of lines) {
        if (line.startsWith('--- ')) {
            // Start of file diff
            continue;
        }
        if (line.startsWith('+++ ')) {
            // Target file
            currentFile = line.substring(4).trim();
            if (currentFile.startsWith('b/')) {
                currentFile = currentFile.substring(2);
            }
            // Check if file is allowed
            if (!(0, fsUtils_1.isPathAllowed)(currentFile, allowlist)) {
                return {
                    ok: false,
                    reason: `File not in allowlist: ${currentFile}`
                };
            }
            continue;
        }
        if (line.startsWith('@@')) {
            // Process previous file changes if any
            if (currentFile && currentChanges.length > 0) {
                const result = await applyChangesToFile(currentFile, currentChanges, workingDir);
                if (!result.ok)
                    return result;
                currentChanges = [];
            }
            continue;
        }
        if (line.startsWith('+')) {
            currentChanges.push({
                line: 0, // Will be calculated during application
                content: line.substring(1),
                type: 'add'
            });
        }
        else if (line.startsWith('-')) {
            currentChanges.push({
                line: 0,
                content: line.substring(1),
                type: 'remove'
            });
        }
    }
    // Apply final file changes
    if (currentFile && currentChanges.length > 0) {
        const result = await applyChangesToFile(currentFile, currentChanges, workingDir);
        if (!result.ok)
            return result;
    }
    return { ok: true };
}
async function applyOpsArray(ops, workingDir, allowlist) {
    console.log('⚙️ [PATCH] Applying operations array...');
    for (const op of ops) {
        if (!op.path || !(0, fsUtils_1.isPathAllowed)(op.path, allowlist)) {
            return {
                ok: false,
                reason: `Operation path not allowed: ${op.path || 'undefined'}`
            };
        }
        const filePath = path.join(workingDir, op.path);
        try {
            switch (op.op) {
                case 'replace':
                    await fs.promises.writeFile(filePath, op.content || '');
                    break;
                case 'add':
                    if (!fs.existsSync(path.dirname(filePath))) {
                        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                    }
                    await fs.promises.writeFile(filePath, op.content || '');
                    break;
                case 'remove':
                    if (fs.existsSync(filePath)) {
                        await fs.promises.unlink(filePath);
                    }
                    break;
                default:
                    console.warn(`⚠️ [PATCH] Unknown operation: ${op.op}`);
            }
        }
        catch (error) {
            return {
                ok: false,
                reason: `Failed to apply operation ${op.op} on ${op.path}: ${error.message}`
            };
        }
    }
    return { ok: true };
}
async function applyChangesToFile(filePath, changes, workingDir) {
    const fullPath = path.join(workingDir, filePath);
    try {
        let content = '';
        if (fs.existsSync(fullPath)) {
            content = await fs.promises.readFile(fullPath, 'utf8');
        }
        const lines = content.split('\n');
        // Simple implementation: apply adds and removes
        for (const change of changes) {
            if (change.type === 'add') {
                lines.push(change.content);
            }
            else if (change.type === 'remove') {
                const index = lines.findIndex(line => line === change.content);
                if (index !== -1) {
                    lines.splice(index, 1);
                }
            }
        }
        await fs.promises.writeFile(fullPath, lines.join('\n'));
        return { ok: true };
    }
    catch (error) {
        return {
            ok: false,
            reason: `Failed to apply changes to ${filePath}: ${error.message}`
        };
    }
}
async function runGitCommand(args, cwd) {
    return new Promise((resolve) => {
        const gitProcess = (0, child_process_1.spawn)('git', args, {
            cwd: cwd || process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        let output = '';
        gitProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        gitProcess.stderr.on('data', (data) => {
            output += data.toString();
        });
        gitProcess.on('close', (exitCode) => {
            resolve({
                exitCode: exitCode || 0,
                output: output.trim()
            });
        });
        gitProcess.on('error', (error) => {
            resolve({
                exitCode: 1,
                output: `Git command failed: ${error.message}`
            });
        });
    });
}
async function copyRepoToTemp(sourcePath, targetPath) {
    console.log(`📋 [PATCH] Copying repository to temporary location: ${targetPath}`);
    // Simple recursive copy (excluding .git, node_modules, etc.)
    const excludePatterns = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'];
    async function copyRecursive(src, dest) {
        const stats = await fs.promises.stat(src);
        if (stats.isDirectory()) {
            const basename = path.basename(src);
            if (excludePatterns.includes(basename)) {
                return;
            }
            await fs.promises.mkdir(dest, { recursive: true });
            const items = await fs.promises.readdir(src);
            for (const item of items) {
                await copyRecursive(path.join(src, item), path.join(dest, item));
            }
        }
        else {
            await fs.promises.copyFile(src, dest);
        }
    }
    await copyRecursive(sourcePath, targetPath);
}
async function cleanupWorktree(branchName, tmpPath) {
    try {
        // Remove worktree
        await runGitCommand(['worktree', 'remove', '--force', tmpPath]);
        // Delete branch if it exists locally
        await runGitCommand(['branch', '-D', branchName]);
    }
    catch (error) {
        console.warn(`⚠️ [CLEANUP] Failed to cleanup worktree: ${error.message}`);
        // Fallback: remove temp directory
        try {
            await fs.promises.rm(tmpPath, { recursive: true, force: true });
        }
        catch (rmError) {
            console.warn(`⚠️ [CLEANUP] Failed to remove temp directory: ${rmError.message}`);
        }
    }
}

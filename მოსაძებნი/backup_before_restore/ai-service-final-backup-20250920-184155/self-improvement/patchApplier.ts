
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runPreflight } from './preflight';
import { isPathAllowed } from './utils/fsUtils';

interface PatchResult {
  ok: boolean;
  reason?: string;
  checklist?: any;
  logs?: any;
  branchName?: string;
  commitSha?: string;
}

interface Patch {
  type: "unified" | "ops";
  diff?: string;
  ops?: any[];
}

export async function dryRunApply(
  patch: Patch, 
  allowlist: string[], 
  branchNamePrefix: string = "ai-proposal"
): Promise<PatchResult> {
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
    const preflightResult = await runPreflight(tmpPath);
    
    return {
      ok: true,
      checklist: preflightResult,
      logs: preflightResult.logs
    };

  } catch (error) {
    return {
      ok: false,
      reason: `Dry run failed: ${error.message}`
    };
  } finally {
    // Clean up
    await cleanupWorktree(branchName, tmpPath);
  }
}

export async function applyOnBranch(
  patch: Patch,
  allowlist: string[],
  branchName: string
): Promise<PatchResult> {
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
    const preflightResult = await runPreflight(tmpPath);
    
    // Check if all critical gates pass
    const criticalGates = ['tsc', 'eslint', 'build'] as const;
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

  } catch (error) {
    return {
      ok: false,
      reason: `Apply failed: ${error.message}`
    };
  } finally {
    // Clean up
    await cleanupWorktree(branchName, tmpPath);
  }
}

async function applyPatch(patch: Patch, workingDir: string, allowlist: string[]): Promise<PatchResult> {
  if (patch.type === 'unified' && patch.diff) {
    return await applyUnifiedDiff(patch.diff, workingDir, allowlist);
  } else if (patch.type === 'ops' && patch.ops) {
    return await applyOpsArray(patch.ops, workingDir, allowlist);
  }
  
  return {
    ok: false,
    reason: 'Invalid patch format'
  };
}

async function applyUnifiedDiff(diff: string, workingDir: string, allowlist: string[]): Promise<PatchResult> {
  console.log('📝 [PATCH] Applying unified diff...');
  
  const lines = diff.split('\n');
  let currentFile = '';
  let currentChanges: Array<{line: number, content: string, type: 'add' | 'remove'}> = [];
  
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
      if (!isPathAllowed(currentFile, allowlist)) {
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
        if (!result.ok) return result;
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
    } else if (line.startsWith('-')) {
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
    if (!result.ok) return result;
  }
  
  return { ok: true };
}

async function applyOpsArray(ops: any[], workingDir: string, allowlist: string[]): Promise<PatchResult> {
  console.log('⚙️ [PATCH] Applying operations array...');
  
  for (const op of ops) {
    if (!op.path || !isPathAllowed(op.path, allowlist)) {
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
    } catch (error) {
      return {
        ok: false,
        reason: `Failed to apply operation ${op.op} on ${op.path}: ${error.message}`
      };
    }
  }
  
  return { ok: true };
}

async function applyChangesToFile(
  filePath: string, 
  changes: Array<{line: number, content: string, type: 'add' | 'remove'}>, 
  workingDir: string
): Promise<PatchResult> {
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
      } else if (change.type === 'remove') {
        const index = lines.findIndex(line => line === change.content);
        if (index !== -1) {
          lines.splice(index, 1);
        }
      }
    }
    
    await fs.promises.writeFile(fullPath, lines.join('\n'));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: `Failed to apply changes to ${filePath}: ${error.message}`
    };
  }
}

async function runGitCommand(args: string[], cwd?: string): Promise<{exitCode: number, output: string}> {
  return new Promise((resolve) => {
    const gitProcess = spawn('git', args, {
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

async function copyRepoToTemp(sourcePath: string, targetPath: string): Promise<void> {
  console.log(`📋 [PATCH] Copying repository to temporary location: ${targetPath}`);
  
  // Simple recursive copy (excluding .git, node_modules, etc.)
  const excludePatterns = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'];
  
  async function copyRecursive(src: string, dest: string) {
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
    } else {
      await fs.promises.copyFile(src, dest);
    }
  }
  
  await copyRecursive(sourcePath, targetPath);
}

async function cleanupWorktree(branchName: string, tmpPath: string): Promise<void> {
  try {
    // Remove worktree
    await runGitCommand(['worktree', 'remove', '--force', tmpPath]);
    
    // Delete branch if it exists locally
    await runGitCommand(['branch', '-D', branchName]);
  } catch (error) {
    console.warn(`⚠️ [CLEANUP] Failed to cleanup worktree: ${error.message}`);
    
    // Fallback: remove temp directory
    try {
      await fs.promises.rm(tmpPath, { recursive: true, force: true });
    } catch (rmError) {
      console.warn(`⚠️ [CLEANUP] Failed to remove temp directory: ${rmError.message}`);
    }
  }
}

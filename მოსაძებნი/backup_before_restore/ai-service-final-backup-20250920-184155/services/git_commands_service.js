
/**
 * Git Commands Service for Gurulo AI Assistant
 * Provides comprehensive Git operations with visual feedback
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class GitCommandsService {
  constructor() {
    this.projectRoot = process.cwd();
    this.isInitialized = false;
    this.currentBranch = 'main';
    this.conflictFiles = [];
  }

  /**
   * Execute git command safely
   */
  async executeGitCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const fullCommand = `git ${command}`;
      
      exec(fullCommand, { 
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        ...options 
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Git command failed: ${error.message}\nStderr: ${stderr}`));
        } else {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: true
          });
        }
      });
    });
  }

  /**
   * Initialize git repository
   */
  async initializeGit() {
    try {
      const gitDir = path.join(this.projectRoot, '.git');
      const exists = await fs.access(gitDir).then(() => true).catch(() => false);
      
      if (!exists) {
        await this.executeGitCommand('init');
        console.log('🎯 Git repository initialized');
      }

      // Set default configuration
      await this.executeGitCommand('config user.name "Gurulo AI Assistant"');
      await this.executeGitCommand('config user.email "gurulo@bakhmaro.ai"');
      
      this.isInitialized = true;
      return { success: true, message: 'Git repository ready' };
    } catch (error) {
      console.error('❌ Git initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get repository status with detailed file information
   */
  async getStatus() {
    try {
      const statusResult = await this.executeGitCommand('status --porcelain -b');
      const lines = statusResult.stdout.split('\n').filter(line => line.trim());
      
      let branch = 'main';
      const files = [];
      
      for (const line of lines) {
        if (line.startsWith('##')) {
          // Branch information
          const branchMatch = line.match(/## (.+?)(?:\.\.\.|$)/);
          if (branchMatch) {
            branch = branchMatch[1];
          }
        } else {
          // File status
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          
          files.push({
            path: filePath,
            status: this.parseFileStatus(status),
            staged: status[0] !== ' ' && status[0] !== '?',
            modified: status[1] !== ' ',
            untracked: status === '??'
          });
        }
      }

      this.currentBranch = branch;
      
      return {
        success: true,
        branch,
        files,
        hasChanges: files.length > 0,
        clean: files.length === 0
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse git status codes to readable format
   */
  parseFileStatus(status) {
    const statusMap = {
      '??': 'untracked',
      'A ': 'added',
      'M ': 'modified',
      'D ': 'deleted',
      'R ': 'renamed',
      'C ': 'copied',
      'MM': 'modified',
      'AM': 'added-modified',
      'AD': 'added-deleted',
      'UU': 'conflict',
      'AA': 'conflict',
      'DD': 'conflict'
    };
    
    return statusMap[status] || 'unknown';
  }

  /**
   * Add files to staging area
   */
  async addFiles(files = []) {
    try {
      if (files.length === 0) {
        await this.executeGitCommand('add .');
        return { success: true, message: 'All files added to staging' };
      } else {
        const fileList = files.map(f => `"${f}"`).join(' ');
        await this.executeGitCommand(`add ${fileList}`);
        return { success: true, message: `${files.length} files added to staging` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove files from staging area
   */
  async unstageFiles(files = []) {
    try {
      if (files.length === 0) {
        await this.executeGitCommand('reset HEAD');
        return { success: true, message: 'All files unstaged' };
      } else {
        const fileList = files.map(f => `"${f}"`).join(' ');
        await this.executeGitCommand(`reset HEAD ${fileList}`);
        return { success: true, message: `${files.length} files unstaged` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Commit changes with message
   */
  async commit(message, options = {}) {
    try {
      if (!message || message.trim() === '') {
        message = `🤖 Auto-commit: ${new Date().toISOString()}`;
      }

      let command = `commit -m "${message}"`;
      
      if (options.amend) {
        command = `commit --amend -m "${message}"`;
      }
      
      if (options.allowEmpty) {
        command += ' --allow-empty';
      }

      const result = await this.executeGitCommand(command);
      
      return {
        success: true,
        message: 'Commit created successfully',
        hash: await this.getLastCommitHash(),
        details: result.stdout
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get last commit hash
   */
  async getLastCommitHash() {
    try {
      const result = await this.executeGitCommand('rev-parse HEAD');
      return result.stdout.substring(0, 8);
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get commit history with visualization data
   */
  async getLog(options = {}) {
    try {
      const limit = options.limit || 20;
      const format = '--pretty=format:"%H|%an|%ae|%ad|%s|%P" --date=iso';
      
      const result = await this.executeGitCommand(`log ${format} -${limit}`);
      const lines = result.stdout.split('\n').filter(line => line.trim());
      
      const commits = lines.map(line => {
        const [hash, author, email, date, message, parents] = line.split('|');
        return {
          hash: hash.substring(0, 8),
          fullHash: hash,
          author,
          email,
          date: new Date(date),
          message,
          parents: parents ? parents.split(' ').map(p => p.substring(0, 8)) : [],
          isMerge: parents && parents.split(' ').length > 1
        };
      });

      return { success: true, commits };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get branches information
   */
  async getBranches() {
    try {
      const localResult = await this.executeGitCommand('branch -v');
      const remoteResult = await this.executeGitCommand('branch -r -v').catch(() => ({ stdout: '' }));
      
      const local = this.parseBranches(localResult.stdout, 'local');
      const remote = this.parseBranches(remoteResult.stdout, 'remote');
      
      return {
        success: true,
        local,
        remote,
        current: local.find(b => b.current)?.name || 'main'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse branch output
   */
  parseBranches(output, type) {
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const current = line.startsWith('*');
        const cleaned = line.replace(/^\*?\s+/, '');
        const parts = cleaned.split(/\s+/);
        const name = parts[0];
        const hash = parts[1];
        
        return {
          name: type === 'remote' ? name.replace('origin/', '') : name,
          hash: hash ? hash.substring(0, 8) : '',
          current,
          type
        };
      });
  }

  /**
   * Create new branch
   */
  async createBranch(branchName, baseBranch = null) {
    try {
      let command = `checkout -b ${branchName}`;
      if (baseBranch) {
        command += ` ${baseBranch}`;
      }
      
      await this.executeGitCommand(command);
      this.currentBranch = branchName;
      
      return {
        success: true,
        message: `Branch '${branchName}' created and checked out`,
        branch: branchName
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch to branch
   */
  async switchBranch(branchName) {
    try {
      await this.executeGitCommand(`checkout ${branchName}`);
      this.currentBranch = branchName;
      
      return {
        success: true,
        message: `Switched to branch '${branchName}'`,
        branch: branchName
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(branchName, force = false) {
    try {
      const flag = force ? '-D' : '-d';
      await this.executeGitCommand(`branch ${flag} ${branchName}`);
      
      return {
        success: true,
        message: `Branch '${branchName}' deleted`,
        branch: branchName
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge branch
   */
  async mergeBranch(branchName, options = {}) {
    try {
      let command = `merge ${branchName}`;
      
      if (options.noFastForward) {
        command += ' --no-ff';
      }
      
      if (options.message) {
        command += ` -m "${options.message}"`;
      }

      const result = await this.executeGitCommand(command);
      
      return {
        success: true,
        message: `Branch '${branchName}' merged successfully`,
        details: result.stdout
      };
    } catch (error) {
      // Check if it's a merge conflict
      if (error.message.includes('CONFLICT')) {
        const conflicts = await this.getConflictFiles();
        return {
          success: false,
          hasConflicts: true,
          conflicts,
          error: 'Merge conflicts detected'
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Get conflict files
   */
  async getConflictFiles() {
    try {
      const result = await this.executeGitCommand('diff --name-only --diff-filter=U');
      this.conflictFiles = result.stdout.split('\n').filter(f => f.trim());
      
      const conflicts = [];
      for (const file of this.conflictFiles) {
        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf8');
        const conflictSections = this.parseConflicts(content);
        conflicts.push({
          file,
          conflicts: conflictSections
        });
      }
      
      return conflicts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse conflict markers in file
   */
  parseConflicts(content) {
    const conflicts = [];
    const lines = content.split('\n');
    let inConflict = false;
    let currentConflict = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        currentConflict = {
          start: i,
          ours: [],
          theirs: [],
          base: line.substring(7).trim()
        };
      } else if (line.startsWith('=======') && inConflict) {
        currentConflict.separator = i;
      } else if (line.startsWith('>>>>>>>') && inConflict) {
        currentConflict.end = i;
        currentConflict.their = line.substring(7).trim();
        conflicts.push(currentConflict);
        inConflict = false;
        currentConflict = null;
      } else if (inConflict && currentConflict) {
        if (currentConflict.separator) {
          currentConflict.theirs.push(line);
        } else {
          currentConflict.ours.push(line);
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Resolve conflict by choosing side
   */
  async resolveConflict(filePath, resolution) {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      
      let resolvedContent = content;
      
      if (resolution.type === 'ours') {
        resolvedContent = content.replace(
          /<<<<<<< .*?\n([\s\S]*?)\n=======\n[\s\S]*?\n>>>>>>> .*?\n/g,
          '$1\n'
        );
      } else if (resolution.type === 'theirs') {
        resolvedContent = content.replace(
          /<<<<<<< .*?\n[\s\S]*?\n=======\n([\s\S]*?)\n>>>>>>> .*?\n/g,
          '$1\n'
        );
      } else if (resolution.type === 'manual' && resolution.content) {
        resolvedContent = resolution.content;
      }
      
      await fs.writeFile(fullPath, resolvedContent);
      await this.executeGitCommand(`add "${filePath}"`);
      
      return {
        success: true,
        message: `Conflict resolved for ${filePath}`,
        file: filePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete merge after resolving conflicts
   */
  async completeMerge(message = null) {
    try {
      const msg = message || 'Merge completed with conflict resolution';
      await this.executeGitCommand(`commit -m "${msg}"`);
      
      this.conflictFiles = [];
      
      return {
        success: true,
        message: 'Merge completed successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Interactive rebase operations
   */
  async startInteractiveRebase(targetCommit, operations = []) {
    try {
      // Create rebase script
      const script = operations.map(op => 
        `${op.action} ${op.commit} ${op.message || ''}`
      ).join('\n');
      
      // For now, we'll use a simplified approach
      const result = await this.executeGitCommand(`rebase -i ${targetCommit}`);
      
      return {
        success: true,
        message: 'Interactive rebase started',
        operations
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Push to remote
   */
  async push(remoteName = 'origin', branchName = null) {
    try {
      const branch = branchName || this.currentBranch;
      await this.executeGitCommand(`push ${remoteName} ${branch}`);
      
      return {
        success: true,
        message: `Pushed ${branch} to ${remoteName}`,
        remote: remoteName,
        branch
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull from remote
   */
  async pull(remoteName = 'origin', branchName = null) {
    try {
      const branch = branchName || this.currentBranch;
      const result = await this.executeGitCommand(`pull ${remoteName} ${branch}`);
      
      return {
        success: true,
        message: `Pulled ${branch} from ${remoteName}`,
        details: result.stdout
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remoteName = 'origin') {
    try {
      const result = await this.executeGitCommand(`fetch ${remoteName}`);
      
      return {
        success: true,
        message: `Fetched from ${remoteName}`,
        details: result.stdout
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Show diff for files
   */
  async showDiff(filePath = null, options = {}) {
    try {
      let command = 'diff';
      
      if (options.staged) {
        command += ' --staged';
      }
      
      if (options.commits) {
        command += ` ${options.commits[0]}..${options.commits[1]}`;
      }
      
      if (filePath) {
        command += ` "${filePath}"`;
      }
      
      const result = await this.executeGitCommand(command);
      
      return {
        success: true,
        diff: result.stdout,
        file: filePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stash changes
   */
  async stash(message = null, options = {}) {
    try {
      let command = 'stash';
      
      if (message) {
        command += ` push -m "${message}"`;
      } else {
        command += ' push';
      }
      
      if (options.includeUntracked) {
        command += ' -u';
      }
      
      const result = await this.executeGitCommand(command);
      
      return {
        success: true,
        message: 'Changes stashed successfully',
        details: result.stdout
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List stashes
   */
  async listStashes() {
    try {
      const result = await this.executeGitCommand('stash list');
      const stashes = result.stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/^(stash@\{(\d+)\}): (.+)$/);
          if (match) {
            return {
              ref: match[1],
              index: parseInt(match[2]),
              message: match[3]
            };
          }
          return null;
        })
        .filter(Boolean);
      
      return { success: true, stashes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply stash
   */
  async applyStash(stashRef = 'stash@{0}') {
    try {
      const result = await this.executeGitCommand(`stash apply ${stashRef}`);
      
      return {
        success: true,
        message: `Stash ${stashRef} applied successfully`,
        details: result.stdout
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const gitCommandsService = new GitCommandsService();

module.exports = gitCommandsService;

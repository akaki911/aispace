/**
 * Git command orchestration for AI GitHub automation.
 *
 * This module exposes promise-based helpers around common Git flows that the
 * admin AI developer dashboard expects (status, add, commit, push, etc.).
 * It is adapted from the legacy AI microservice implementation but simplified
 * to run directly inside the backend process.
 *
 * Testing:
 *   - Test by clicking "Git ოპერაციები" → "Verify" on the admin panel.
 *   - Stage a file, commit and push from the UI and confirm output in console.
 */

const { exec } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_AUTHOR = {
  name: process.env.GIT_COMMIT_NAME || 'Bakhmaro AI Assistant',
  email: process.env.GIT_COMMIT_EMAIL || 'assistant@bakhmaro.co'
};

const sanitizeFiles = (files = []) =>
  Array.isArray(files)
    ? files
        .filter((file) => typeof file === 'string' && file.trim().length > 0)
        .map((file) => file.trim())
    : [];

const executeGit = (args, options = {}) =>
  new Promise((resolve, reject) => {
    const command = Array.isArray(args) ? args.join(' ') : args;
    exec(
      `git ${command}`,
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, ...options.env }
      },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr?.toString()?.trim() || error.message;
          return reject(new Error(message));
        }
        resolve({
          stdout: stdout?.toString()?.trim() || '',
          stderr: stderr?.toString()?.trim() || ''
        });
      }
    );
  });

const ensureAuthorConfig = async () => {
  await executeGit(`config user.name "${DEFAULT_AUTHOR.name}"`).catch(() => {});
  await executeGit(`config user.email "${DEFAULT_AUTHOR.email}"`).catch(() => {});
};

const parseStatusLine = (line) => {
  const status = line.slice(0, 2);
  const filePath = line.slice(3).trim();
  return {
    path: filePath,
    status:
      {
        '??': 'untracked',
        'A ': 'added',
        'M ': 'modified',
        ' D': 'deleted',
        'D ': 'deleted',
        'R ': 'renamed',
        'C ': 'copied',
        'MM': 'modified',
        'AM': 'added-modified',
        'UU': 'conflict'
      }[status] || 'unknown',
    staged: status[0] !== ' ' && status[0] !== '?',
    modified: status[1] !== ' ',
    untracked: status === '??'
  };
};

const parseBranchHeader = (line) => {
  const result = {
    branch: 'main',
    upstream: undefined,
    ahead: 0,
    behind: 0,
  };

  const header = line.replace(/^##\s*/, '').trim();
  if (!header) {
    return result;
  }

  const bracketIndex = header.indexOf('[');
  const infoSection = bracketIndex >= 0 ? header.slice(0, bracketIndex).trim() : header;
  const metaSection = bracketIndex >= 0 ? header.slice(bracketIndex) : '';

  const tripleDotIndex = infoSection.indexOf('...');
  if (tripleDotIndex >= 0) {
    const branchPart = infoSection.slice(0, tripleDotIndex).trim();
    const upstreamPart = infoSection.slice(tripleDotIndex + 3).trim();
    if (branchPart) {
      result.branch = branchPart;
    }
    if (upstreamPart) {
      result.upstream = upstreamPart.split(/\s+/)[0];
    }
  } else {
    const branchPart = infoSection.split(/\s+/)[0];
    if (branchPart && branchPart !== 'HEAD') {
      result.branch = branchPart;
    }
  }

  const tokens = metaSection
    ? metaSection.replace(/[\[\]]/g, '').split(',').map((token) => token.trim()).filter(Boolean)
    : [];

  for (const token of tokens) {
    const aheadMatch = token.match(/^ahead\s+(\d+)/);
    if (aheadMatch) {
      result.ahead = Number.parseInt(aheadMatch[1], 10) || 0;
      continue;
    }

    const behindMatch = token.match(/^behind\s+(\d+)/);
    if (behindMatch) {
      result.behind = Number.parseInt(behindMatch[1], 10) || 0;
    }
  }

  // Fallback in case the data is outside brackets (older git versions)
  if (!tokens.length) {
    const aheadFallback = header.match(/ahead\s+(\d+)/);
    if (aheadFallback) {
      result.ahead = Number.parseInt(aheadFallback[1], 10) || 0;
    }
    const behindFallback = header.match(/behind\s+(\d+)/);
    if (behindFallback) {
      result.behind = Number.parseInt(behindFallback[1], 10) || 0;
    }
  }

  return result;
};

const getStatus = async () => {
  try {
    const { stdout } = await executeGit('status --porcelain=1 -b');
    const lines = stdout.split('\n').filter(Boolean);

    let branchInfo = {
      branch: 'main',
      upstream: undefined,
      ahead: 0,
      behind: 0,
    };
    const files = [];

    for (const line of lines) {
      if (line.startsWith('##')) {
        branchInfo = parseBranchHeader(line);
      } else {
        files.push(parseStatusLine(line));
      }
    }

    return {
      success: true,
      branch: branchInfo.branch,
      upstream: branchInfo.upstream,
      ahead: branchInfo.ahead,
      behind: branchInfo.behind,
      aheadBehind: { ahead: branchInfo.ahead, behind: branchInfo.behind },
      files,
      changesCount: files.length,
      hasChanges: files.length > 0,
      clean: files.length === 0,
      hasRemote: Boolean(branchInfo.upstream),
    };
  } catch (error) {
    console.error('❌ Git status error:', error);
    return { success: false, error: error.message };
  }
};

const addFiles = async (files) => {
  const sanitized = sanitizeFiles(files);
  try {
    if (sanitized.length === 0) {
      await executeGit('add .');
      return { success: true, message: 'ყველა ფაილი დაემატა staging სივრცეში.' };
    }
    const quoted = sanitized.map((file) => `"${file}"`).join(' ');
    await executeGit(`add ${quoted}`);
    return { success: true, message: `${sanitized.length} ფაილი დაემატა staging-ში.` };
  } catch (error) {
    console.error('❌ Git add error:', error);
    return { success: false, error: error.message };
  }
};

const unstageFiles = async (files) => {
  const sanitized = sanitizeFiles(files);
  try {
    if (sanitized.length === 0) {
      await executeGit('reset HEAD');
      return { success: true, message: 'ყველა ფაილი unstaged მდგომარეობაში დაბრუნდა.' };
    }
    const quoted = sanitized.map((file) => `"${file}"`).join(' ');
    await executeGit(`reset HEAD ${quoted}`);
    return { success: true, message: `${sanitized.length} ფაილი unstaged გახდა.` };
  } catch (error) {
    console.error('❌ Git unstage error:', error);
    return { success: false, error: error.message };
  }
};

const discardChanges = async (files) => {
  const sanitized = sanitizeFiles(files);
  try {
    if (sanitized.length === 0) {
      await executeGit('checkout -- .');
      await executeGit('clean -fd');
      return { success: true, message: 'ყველა არასტაბილური ცვლილება გაუქმდა.' };
    }
    const quoted = sanitized.map((file) => `"${file}"`).join(' ');
    await executeGit(`checkout -- ${quoted}`);
    await executeGit(`clean -f ${quoted}`);
    return { success: true, message: `${sanitized.length} ფაილის ცვლილება გაუქმდა.` };
  } catch (error) {
    console.error('❌ Git discard error:', error);
    return { success: false, error: error.message };
  }
};

const commit = async (message, options = {}) => {
  try {
    await ensureAuthorConfig();
    const safeMessage = message && message.trim().length > 0 ? message.trim() : `🤖 Auto-commit ${new Date().toISOString()}`;
    const flags = [];
    if (options.amend) flags.push('--amend');
    if (options.allowEmpty) flags.push('--allow-empty');
    await executeGit(`commit ${flags.join(' ')} -m "${safeMessage.replace(/"/g, '\\"')}"`.trim());
    const { stdout } = await executeGit('rev-parse HEAD');
    return {
      success: true,
      message: 'Commit წარმატებით შეიქმნა.',
      hash: stdout.trim()
    };
  } catch (error) {
    console.error('❌ Git commit error:', error);
    return { success: false, error: error.message };
  }
};

const getLog = async ({ limit = 20, branch } = {}) => {
  try {
    const args = ['log', `-n ${limit}`, '--pretty=format:%H|%h|%an|%ae|%ad|%s'];
    if (branch) {
      args.push(branch);
    }
    const { stdout } = await executeGit(args.join(' '));
    const commits = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [fullHash, shortHash, author, email, date, ...messageParts] = line.split('|');
        return {
          hash: shortHash,
          fullHash,
          author,
          email,
          date: new Date(date),
          message: messageParts.join('|'),
          parents: []
        };
      });
    return { success: true, commits };
  } catch (error) {
    console.error('❌ Git log error:', error);
    return { success: false, error: error.message, commits: [] };
  }
};

const getBranches = async () => {
  try {
    const { stdout: local } = await executeGit('branch --format="%(refname:short)|local"');
    const { stdout: remote } = await executeGit('branch -r --format="%(refname:short)|remote"');

    const mapBranch = (line) => {
      const [name, type] = line.split('|');
      return {
        name: name.replace(/^remotes\//, ''),
        type: type === 'remote' ? 'remote' : 'local',
        current: line.startsWith('* ')
      };
    };

    const localBranches = local
      .split('\n')
      .filter(Boolean)
      .map(mapBranch);

    const remoteBranches = remote
      .split('\n')
      .filter(Boolean)
      .map(mapBranch);

    const current = localBranches.find((branch) => branch.current)?.name || 'main';

    return {
      success: true,
      current,
      local: localBranches,
      remote: remoteBranches
    };
  } catch (error) {
    console.error('❌ Git branches error:', error);
    return { success: false, error: error.message };
  }
};

const createBranch = async (name, base = 'main') => {
  try {
    await executeGit(`checkout -b "${name}" "${base}"`);
    return { success: true, message: `ახალი branch '${name}' შექმნილია.` };
  } catch (error) {
    console.error('❌ Git create branch error:', error);
    return { success: false, error: error.message };
  }
};

const switchBranch = async (name) => {
  try {
    await executeGit(`checkout "${name}"`);
    return { success: true, message: `გადართულია '${name}' branch-ზე.` };
  } catch (error) {
    console.error('❌ Git switch branch error:', error);
    return { success: false, error: error.message };
  }
};

const deleteBranch = async (name, { force = false } = {}) => {
  try {
    await executeGit(`branch ${force ? '-D' : '-d'} "${name}"`);
    return { success: true, message: `'${name}' branch წაიშალა.` };
  } catch (error) {
    console.error('❌ Git delete branch error:', error);
    return { success: false, error: error.message };
  }
};

const withAuthEnv = (token) => ({
  ...process.env,
  GIT_ASKPASS: path.resolve(__dirname, '../utils/git-askpass.sh'),
  GITHUB_ACCESS_TOKEN: token
});

const push = async ({ remote = 'origin', branch = 'main', token }) => {
  try {
    await executeGit(`push ${remote} ${branch}`, { env: token ? withAuthEnv(token) : undefined });
    return { success: true, message: 'ცვლილებები Github-ზე აიტვირთა.' };
  } catch (error) {
    console.error('❌ Git push error:', error);
    return { success: false, error: error.message };
  }
};

const pull = async ({ remote = 'origin', branch = 'main', token }) => {
  try {
    await executeGit(`pull ${remote} ${branch}`, { env: token ? withAuthEnv(token) : undefined });
    return { success: true, message: 'ცვლილებები ჩამოიტვირთა Github-დან.' };
  } catch (error) {
    console.error('❌ Git pull error:', error);
    return { success: false, error: error.message };
  }
};

const fetchRemote = async ({ remote = 'origin', token }) => {
  try {
    await executeGit(`fetch ${remote}`, { env: token ? withAuthEnv(token) : undefined });
    return { success: true, message: 'Remote მონაცემები განახლდა.' };
  } catch (error) {
    console.error('❌ Git fetch error:', error);
    return { success: false, error: error.message };
  }
};

const recentFiles = async (limit = 10) => {
  try {
    const { stdout } = await executeGit(`log -n ${limit} --name-only --pretty=format:`);
    const files = [...new Set(stdout.split('\n').map((line) => line.trim()).filter(Boolean))];
    return { success: true, files };
  } catch (error) {
    console.error('❌ Git recent files error:', error);
    return { success: false, error: error.message, files: [] };
  }
};

const fileHistory = async (filePath, limit = 20) => {
  try {
    const { stdout } = await executeGit(
      `log -n ${limit} --pretty=format:%H|%an|%ad|%s -- "${filePath}"`
    );
    const versions = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, ...messageParts] = line.split('|');
        return {
          hash,
          author,
          timestamp: new Date(date).toISOString(),
          message: messageParts.join('|'),
          changes: { added: 0, deleted: 0, modified: 0 },
          size: 0
        };
      });
    return { success: true, versions };
  } catch (error) {
    console.error('❌ Git file history error:', error);
    return { success: false, error: error.message, versions: [] };
  }
};

const diff = async (fromRef, toRef, filePath) => {
  try {
    const target = filePath ? ` -- "${filePath}"` : '';
    const { stdout } = await executeGit(`diff ${fromRef} ${toRef}${target}`);
    return { success: true, diff: stdout };
  } catch (error) {
    console.error('❌ Git diff error:', error);
    return { success: false, error: error.message };
  }
};

const restore = async (filePath, ref = 'HEAD') => {
  try {
    await executeGit(`checkout ${ref} -- "${filePath}"`);
    return { success: true, message: `${filePath} აღდგა ${ref} ვერსიიდან.` };
  } catch (error) {
    console.error('❌ Git restore error:', error);
    return { success: false, error: error.message };
  }
};

const getLatestTag = async () => {
  try {
    const { stdout } = await executeGit('describe --tags --abbrev=0');
    const tag = stdout.trim();
    if (!tag) {
      return { success: false, tag: null, error: 'No tags found' };
    }
    return { success: true, tag };
  } catch (error) {
    return { success: false, tag: null, error: error.message };
  }
};

const getHeadCommit = async () => {
  try {
    const { stdout } = await executeGit('rev-parse HEAD');
    const hash = stdout.trim();
    if (!hash) {
      return { success: false, hash: null, error: 'HEAD commit not found' };
    }
    return { success: true, hash };
  } catch (error) {
    return { success: false, hash: null, error: error.message };
  }
};

module.exports = {
  getStatus,
  addFiles,
  unstageFiles,
  discardChanges,
  commit,
  getLog,
  getBranches,
  getLatestTag,
  getHeadCommit,
  createBranch,
  switchBranch,
  deleteBranch,
  push,
  pull,
  fetchRemote,
  recentFiles,
  fileHistory,
  diff,
  restore
};

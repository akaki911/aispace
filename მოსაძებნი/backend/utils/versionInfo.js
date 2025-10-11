const { execSync } = require('child_process');
const path = require('path');

const gitEnvKeys = ['GIT_SHA', 'VERCEL_GIT_COMMIT_SHA', 'COMMIT_SHA', 'SOURCE_VERSION'];

let cachedGitSha = null;

const resolveGitSha = () => {
  if (cachedGitSha) {
    return cachedGitSha;
  }

  const envSha = gitEnvKeys
    .map((key) => process.env[key])
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  if (envSha) {
    cachedGitSha = envSha.trim();
    return cachedGitSha;
  }

  try {
    const output = execSync('git rev-parse HEAD', {
      cwd: path.resolve(__dirname, '..', '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (output) {
      cachedGitSha = output;
      return cachedGitSha;
    }
  } catch (error) {
    console.warn('⚠️ [/api/version] Unable to resolve git SHA from repo:', error.message);
  }

  cachedGitSha = null;
  return cachedGitSha;
};

const getBuildTime = () =>
  process.env.BUILD_TIME || process.env.VERCEL_BUILD_TIME || process.env.DEPLOY_TIME || null;

const getVersionInfo = () => {
  const gitSha = resolveGitSha();

  return {
    gitSha: gitSha || null,
    gitShaShort: gitSha ? gitSha.slice(0, 7) : null,
    buildTime: getBuildTime(),
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  resolveGitSha,
  getVersionInfo,
};

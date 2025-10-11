import { useCallback, useState } from 'react';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface OperationResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

const isPortInUseMessage = (message: string | undefined): boolean =>
  typeof message === 'string' && /already in use|eaddrinuse/i.test(message);

export const useGitHubOperations = () => {
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<{ type: string; result: OperationResult } | null>(null);

  const performOperation = useCallback(
    async (operationType: string, url: string, options?: RequestInit): Promise<OperationResult> => {
      setOperationLoading(operationType);

      try {
        console.log(`🔄 GitHub Operation Request [${operationType}]: ${url}`);
        if (options?.body) {

          try {
            console.log(`   Request Body:`, JSON.parse(options.body as string));
          } catch (parseError) {
            console.log('   Request Body (raw):', options.body);
            console.debug('   Request body parse error:', parseError);
          }
        }
        console.log(`   Method: ${options?.method || 'GET'}`);

        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          ...options,
        });

        console.log(`📡 GitHub Operation Response [${operationType}]: ${response.status} ${response.statusText}`);

        const result = await response.json();
        console.log(`✅ GitHub Operation Result [${operationType}]:`, result);


        const operationResult: OperationResult = {
          success: response.ok,
          message: result.message,
          error: response.ok ? undefined : result.error,
          data: result,

        };

        setLastOperation({ type: operationType, result: operationResult });
        return operationResult;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');

        if (isPortInUseMessage(normalizedError.message)) {
          console.warn('⚠️ GitHub operation detected a potential port conflict:', normalizedError.message);
        }

        const operationResult: OperationResult = {
          success: false,
          error: normalizedError.message,
        };

        setLastOperation({ type: operationType, result: operationResult });
        return operationResult;
      } finally {
        setOperationLoading(null);
      }
    },
    [],
  );

  const initGit = useCallback(async () => {
    return await performOperation('init', '/api/ai/github/init', { method: 'POST' });
  }, [performOperation]);

  const addRemote = useCallback(
    async (repoUrl: string) =>
      await performOperation('addRemote', '/api/ai/github/remote', {
        method: 'POST',
        body: JSON.stringify({ repoUrl }),
      }),
    [performOperation],
  );

  const sync = useCallback(
    async (message?: string) =>
      await performOperation('sync', '/api/ai/github/sync', {
        method: 'POST',
        body: JSON.stringify({ message: message || 'Auto sync from Gurulo AI' }),
      }),
    [performOperation],
  );

  const pull = useCallback(async () => await performOperation('pull', '/api/ai/github/pull', { method: 'POST' }), [performOperation]);

  const fetchRefs = useCallback(
    async () => await performOperation('fetchRefs', '/api/ai/github/fetch', { method: 'POST' }),
    [performOperation],
  );

  const push = useCallback(
    async (message?: string) =>
      await performOperation('push', '/api/ai/github/push', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    [performOperation],
  );

  const commit = useCallback(
    async (message: string, files?: string[]) =>
      await performOperation('commit', '/api/ai/github/commit', {
        method: 'POST',
        body: JSON.stringify({ message, files }),
      }),
    [performOperation],
  );

  const enableAutoCommit = useCallback(
    async (intervalMinutes: number = 10) =>
      await performOperation('enableAutoCommit', '/api/ai/github/auto-commit/enable', {
        method: 'POST',
        body: JSON.stringify({ intervalMinutes }),
      }),
    [performOperation],
  );

  const disableAutoCommit = useCallback(
    async () => await performOperation('disableAutoCommit', '/api/ai/github/auto-commit/disable', { method: 'POST' }),
    [performOperation],
  );

  const enableAutoSync = useCallback(
    async (intervalMinutes: number = 5) =>
      await performOperation('enableAutoSync', '/api/ai/github/auto-sync/enable', {
        method: 'POST',
        body: JSON.stringify({ intervalMinutes }),
      }),
    [performOperation],
  );

  const disableAutoSync = useCallback(
    async () => await performOperation('disableAutoSync', '/api/ai/github/auto-sync/disable', { method: 'POST' }),
    [performOperation],
  );

  const createBranch = useCallback(
    async (branchName: string, fromBranch: string = 'main') => {
      console.log(`🌿 Creating branch '${branchName}' from '${fromBranch}'`);
      return await performOperation('createBranch', '/api/ai/github/branches/create', {
        method: 'POST',
        body: JSON.stringify({ branchName, fromBranch }),
      });
    },
    [performOperation],
  );

  const switchBranch = useCallback(
    async (branchName: string) =>
      await performOperation('switchBranch', '/api/ai/github/branches/switch', {
        method: 'POST',
        body: JSON.stringify({ targetBranch: branchName }),
      }),
    [performOperation],
  );

  const deleteBranch = useCallback(
    async (branchName: string, force?: boolean) =>
      await performOperation('deleteBranch', '/api/ai/github/branches/delete', {
        method: 'DELETE',
        body: JSON.stringify({ branchName, force }),
      }),
    [performOperation],
  );

  const createFeatureBranch = useCallback(
    async (featureName: string, baseBranch: string = 'main') => {
      console.log(`✨ Creating feature '${featureName}' from '${baseBranch}'`);
      return await performOperation('createFeatureBranch', '/api/ai/github/branches/feature', {
        method: 'POST',
        body: JSON.stringify({ featureName, baseBranch }),
      });
    },
    [performOperation],
  );

  const getStatus = useCallback(async () => await performOperation('getStatus', '/api/ai/github/status'), [performOperation]);

  const createIssue = useCallback(
    async (title: string, body?: string, labels?: string[]) =>
      await performOperation('createIssue', '/api/ai/github/issues/create', {
        method: 'POST',
        body: JSON.stringify({ title, body, labels }),
      }),
    [performOperation],
  );

  const closeIssue = useCallback(
    async (issueNumber: number) =>
      await performOperation('closeIssue', `/api/ai/github/issues/${issueNumber}/close`, { method: 'POST' }),
    [performOperation],
  );

  const enableRepositoryAutomation = useCallback(

    async (settings: any) =>

      await performOperation('enableRepositoryAutomation', '/api/ai/repository-automation/enable', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
    [performOperation],
  );

  const configureWebhooks = useCallback(
    async (webhookUrl: string, events: string[]) =>
      await performOperation('configureWebhooks', '/api/ai/repository-automation/webhooks', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl, events }),
      }),
    [performOperation],
  );

  const uploadFile = useCallback(
    async (filePath: string, content: string, message?: string, branch?: string) =>
      await performOperation('uploadFile', '/api/ai/github/upload-file', {
        method: 'POST',
        body: JSON.stringify({ filePath, content, message, branch }),
      }),
    [performOperation],
  );

  const checkPullRequestMergeable = useCallback(
    async (pullNumber: number) => {
      if (!pullNumber || Number.isNaN(pullNumber) || pullNumber <= 0) {
        console.error('❌ Invalid pull request number:', pullNumber);
        return { success: false, error: 'Pull request number must be positive integer (e.g. 123)' };
      }

      console.log(`🔍 Checking PR #${pullNumber} mergeable status`);
      return await performOperation('checkMergeable', `/api/ai/github/pulls/${pullNumber}/mergeable`);
    },
    [performOperation],
  );

  const mergePullRequest = useCallback(
    async (
      pullNumber: number,
      options?: {
        commit_title?: string;
        commit_message?: string;
        merge_method?: 'merge' | 'squash' | 'rebase';
      },
      settings?: {
        mergeMethod?: 'merge' | 'squash' | 'rebase';
        defaultCommitTitle?: string;
        defaultCommitMessage?: string;
      },
    ) => {
      if (!pullNumber || Number.isNaN(pullNumber) || pullNumber <= 0) {
        console.error('❌ Invalid pull request number:', pullNumber);
        return { success: false, error: 'Pull request number must be positive integer (e.g. 123)' };
      }

      const mergeOptions = {
        merge_method: options?.merge_method || settings?.mergeMethod || 'merge',
        commit_title: options?.commit_title || settings?.defaultCommitTitle || undefined,
        commit_message: options?.commit_message || settings?.defaultCommitMessage || undefined,
        ...options,
      };

      console.log(`🔀 Merging PR #${pullNumber} with method: ${mergeOptions.merge_method}`, mergeOptions);
      return await performOperation('mergePR', `/api/ai/github/pulls/${pullNumber}/merge`, {
        method: 'PUT',
        body: JSON.stringify(mergeOptions),
      });
    },
    [performOperation],
  );

  const stageFiles = useCallback(
    async (files: string[]) =>
      await performOperation('stageFiles', '/api/ai/github/stage', {
        method: 'POST',
        body: JSON.stringify({ files }),
      }),
    [performOperation],
  );

  const unstageFiles = useCallback(
    async (files: string[]) =>
      await performOperation('unstageFiles', '/api/ai/github/unstage', {
        method: 'POST',
        body: JSON.stringify({ files }),
      }),
    [performOperation],
  );

  const discardChanges = useCallback(
    async (files: string[]) =>
      await performOperation('discardChanges', '/api/ai/github/discard', {
        method: 'POST',
        body: JSON.stringify({ files }),
      }),
    [performOperation],
  );

  const checkWebhookSecurity = useCallback(
    async (signature: string, payload: string, secret: string): Promise<OperationResult> =>
      await performOperation('checkWebhookSecurity', '/api/ai/github/webhook/verify', {
        method: 'POST',
        body: JSON.stringify({ signature, payload, secret }),
      }),
    [performOperation],
  );

  return {
    initGit,
    addRemote,
    sync,
    pull,
    push,
    commit,
    fetchRefs,
    enableAutoCommit,
    disableAutoCommit,
    enableAutoSync,
    disableAutoSync,
    createBranch,
    switchBranch,
    deleteBranch,
    createFeatureBranch,
    getStatus,
    createIssue,
    closeIssue,
    enableRepositoryAutomation,
    configureWebhooks,
    stageFiles,
    unstageFiles,
    discardChanges,
    uploadFile,
    checkWebhookSecurity,
    checkPullRequestMergeable,
    mergePullRequest,
    operationLoading,
    lastOperation,
    isLoading: (operation?: string) => (operation ? operationLoading === operation : operationLoading !== null),
    clearLastOperation: () => setLastOperation(null),
  };
};

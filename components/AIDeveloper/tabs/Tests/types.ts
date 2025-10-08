export type DevTestType = 'npm' | 'node' | 'cypress' | 'legacy';

export interface DevTestItem {
  id: string;
  type: DevTestType;
  label: string;
  pathOrScript: string;
  detail?: string;
  runnable?: boolean;
  outdated?: boolean;
  outdatedReason?: string | null;
  outdatedDetail?: string | null;
}

export interface DevTestsResponse {
  success: boolean;
  npmScripts: DevTestItem[];
  nodeTests: DevTestItem[];
  cypressTests: DevTestItem[];
  legacyTests: DevTestItem[];
  items?: DevTestItem[];
  hasCypress: boolean;
  tsxAvailable: boolean;
  activeRun: null | {
    runId: string;
    id: string;
    type: DevTestType;
    label: string;
    pathOrScript: string;
    startedAt?: number;
  };
  status?: 'ok' | 'empty' | 'error';
  message?: string | null;
  summary?: {
    totalFiles: number;
    runnable: number;
    legacy: number;
    npm: number;
    node: number;
    cypress: number;
  };
}

export type TestRunStatus = 'idle' | 'running' | 'passed' | 'failed';

export interface ActiveRunState {
  runId: string;
  test: DevTestItem;
  status: TestRunStatus;
  startedAt: number;
  exitCode: number | null;
}

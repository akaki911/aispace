import type {
  SecretSource,
  SecretSummary,
  SecretVisibility,
  SecretsSyncResponse,
} from '@aispace/services/secretsAdminApi';

export type SecretsPageVariant = 'panel' | 'page';

export interface RevealState {
  value: string | null;
  revealed: boolean;
  loading: boolean;
  error?: string;
  correlationId?: string;
}

export interface EditorStateBase {
  mode: 'create' | 'edit';
  open: true;
}

export interface CreateEditorState extends EditorStateBase {
  mode: 'create';
  initialKey?: string;
  initialVisibility?: SecretVisibility;
  initialSource?: SecretSource;
  initialRequired?: boolean;
}

export interface EditEditorState extends EditorStateBase {
  mode: 'edit';
  secret: SecretSummary;
}

export type EditorState = CreateEditorState | EditEditorState | null;

export interface CreatePlaceholderOptions {
  key: string;
  visibility: SecretVisibility;
  source: SecretSource;
  markRequired?: boolean;
}

export type SyncResult = SecretsSyncResponse | null;

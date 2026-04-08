export type RunStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export type NodeExecutionVisualState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'skipped';

export type EdgeExecutionVisualState =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'skipped';

export interface RunConfig {
  maxIterations: number | null;
}

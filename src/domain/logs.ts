import { NodeType } from './node-types';

export type EventStatus = 'queued' | 'started' | 'completed' | 'failed' | 'skipped' | 'aborted';

export interface AttemptRecord {
  attemptNumber: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  errorMessage: string | null;
  status: 'failed' | 'completed' | 'aborted';
}

export interface ModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ModelEventMeta {
  provider: 'openai';
  model: string;
  usage: ModelUsage;
  finishReason: string | null;
  rawResponsePreview: string | null;
}

export interface ExecutionLogEvent {
  runId: string;
  eventId: string;
  parentEventId: string | null;
  nodeId: string;
  nodeTitle: string;
  nodeType: NodeType;
  status: EventStatus;
  iteration: number;
  inputText: string;
  outputText: string;
  errorMessage: string | null;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  attemptCount: number;
  attempts: AttemptRecord[];
  modelMeta: ModelEventMeta | null;
}

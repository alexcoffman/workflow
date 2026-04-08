import type { FlowEdge } from '../domain/edges';
import type { FlowMessage } from '../domain/messages';
import type { FlowNode } from '../domain/nodes';
import type { TelegramChatContext } from '../domain/telegram';
import type { ExecutionLogEvent } from '../domain/logs';
import type { EdgeExecutionVisualState, NodeExecutionVisualState, RunStatus } from '../domain/run';
import type { MergeInputItem } from './merge';

export interface CycleAnalysis {
  componentByNodeId: Record<string, string | null>;
  cycleComponentIds: Set<string>;
  cycleRelatedEdgeIds: Set<string>;
}

export interface RunSnapshot {
  runId: string;
  createdAt: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  nodeById: Record<string, FlowNode>;
  incomingEdgesByNode: Record<string, FlowEdge[]>;
  outgoingEdgesByNode: Record<string, FlowEdge[]>;
  executableNodeIds: Set<string>;
  startNodeIds: string[];
  cycleAnalysis: CycleAnalysis;
}

export interface EngineRunConfig {
  maxIterations: number | null;
  startNodeIdsOverride?: string[];
  triggerInputByNodeId?: Record<
    string,
    {
      text: string;
      telegramContext: TelegramChatContext | null;
    }
  >;
}

export interface ReadyNodeContext {
  nodeId: string;
  iteration: number;
  parentEventId: string | null;
}

export interface QueuedNodeExecution extends ReadyNodeContext {
  eventId: string;
  fingerprint: string;
  readyOrder: number;
  inputMessageIds: string[];
  inputText: string;
  mergeInputItems: MergeInputItem[];
}

export interface EngineCallbacks {
  onEvent: (event: ExecutionLogEvent) => void;
  onNodeState: (nodeId: string, state: NodeExecutionVisualState) => void;
  onEdgeState: (edgeId: string, state: EdgeExecutionVisualState) => void;
  onRunStatus: (status: RunStatus) => void;
  onTelegramOutput?: (payload: { nodeId: string; botId: string; chatId: number; text: string; signal: AbortSignal }) => Promise<void>;
}

export interface NodeInputBundle {
  messages: FlowMessage[];
  expectedInputCount: number;
  availableInputCount: number;
  inputMessagesByEdge: Array<{
    edge: FlowEdge;
    messages: FlowMessage[];
  }>;
}

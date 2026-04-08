import type { FlowEdge } from '../domain/edges';
import { NodeType } from '../domain/node-types';
import type {
  CounterNode,
  DecisionNode,
  ExecutableFlowNode,
  FlowNode,
  MergeNode,
  ModelNode,
  NoteNode,
  OutputNode,
  StartNode,
  TelegramInputNode,
  TelegramOutputNode,
  TextNode
} from '../domain/nodes';

import { analyzeCycles } from './cycle-analysis';
import type { RunSnapshot } from './types';

const sortIncomingEdges = (a: FlowEdge, b: FlowEdge): number => {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  if (a.source !== b.source) {
    return a.source.localeCompare(b.source);
  }

  return a.id.localeCompare(b.id);
};

const sortOutgoingEdges = (a: FlowEdge, b: FlowEdge): number => {
  if (a.target !== b.target) {
    return a.target.localeCompare(b.target);
  }

  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.id.localeCompare(b.id);
};

const cloneTextNode = (node: TextNode): TextNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneStartNode = (node: StartNode): StartNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneModelNode = (node: ModelNode): ModelNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneDecisionNode = (node: DecisionNode): DecisionNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneCounterNode = (node: CounterNode): CounterNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneMergeNode = (node: MergeNode): MergeNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneOutputNode = (node: OutputNode): OutputNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneTelegramInputNode = (node: TelegramInputNode): TelegramInputNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneTelegramOutputNode = (node: TelegramOutputNode): TelegramOutputNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneNoteNode = (node: NoteNode): NoteNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data }
});

const cloneNode = (node: FlowNode): FlowNode => {
  if (node.type === NodeType.START) {
    return cloneStartNode(node);
  }

  if (node.type === NodeType.TEXT) {
    return cloneTextNode(node);
  }

  if (node.type === NodeType.MODEL) {
    return cloneModelNode(node);
  }

  if (node.type === NodeType.DECISION) {
    return cloneDecisionNode(node);
  }

  if (node.type === NodeType.COUNTER) {
    return cloneCounterNode(node);
  }

  if (node.type === NodeType.MERGE) {
    return cloneMergeNode(node);
  }

  if (node.type === NodeType.OUTPUT) {
    return cloneOutputNode(node);
  }

  if (node.type === NodeType.TELEGRAM_INPUT) {
    return cloneTelegramInputNode(node);
  }

  if (node.type === NodeType.TELEGRAM_OUTPUT) {
    return cloneTelegramOutputNode(node);
  }

  return cloneNoteNode(node);
};

const cloneNodes = (nodes: FlowNode[]): FlowNode[] => nodes.map((node) => cloneNode(node));

const cloneEdges = (edges: FlowEdge[]): FlowEdge[] => {
  return edges.map((edge) => ({ ...edge }));
};

export const createRunSnapshot = (
  runId: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
): RunSnapshot => {
  const snapshotNodes = cloneNodes(nodes);
  const snapshotEdges = cloneEdges(edges);

  const nodeById: Record<string, FlowNode> = {};
  const incomingEdgesByNode: Record<string, FlowEdge[]> = {};
  const outgoingEdgesByNode: Record<string, FlowEdge[]> = {};

  for (const node of snapshotNodes) {
    nodeById[node.id] = node;
    incomingEdgesByNode[node.id] = [];
    outgoingEdgesByNode[node.id] = [];
  }

  for (const edge of snapshotEdges) {
    if (!incomingEdgesByNode[edge.target]) {
      incomingEdgesByNode[edge.target] = [];
    }

    if (!outgoingEdgesByNode[edge.source]) {
      outgoingEdgesByNode[edge.source] = [];
    }

    incomingEdgesByNode[edge.target].push(edge);
    outgoingEdgesByNode[edge.source].push(edge);
  }

  for (const nodeId of Object.keys(incomingEdgesByNode)) {
    incomingEdgesByNode[nodeId].sort(sortIncomingEdges);
  }

  for (const nodeId of Object.keys(outgoingEdgesByNode)) {
    outgoingEdgesByNode[nodeId].sort(sortOutgoingEdges);
  }

  const executableNodeIds = new Set<string>();
  const startNodeIds: string[] = [];
  const legacyStartNodeIds: string[] = [];

  for (const node of snapshotNodes) {
    if (node.type === NodeType.NOTE) {
      continue;
    }

    executableNodeIds.add(node.id);

    const incomingCount = incomingEdgesByNode[node.id]?.length ?? 0;
    if ((node.type === NodeType.START || node.type === NodeType.TELEGRAM_INPUT) && incomingCount === 0) {
      startNodeIds.push(node.id);
    }

    if (
      incomingCount === 0 &&
      node.type !== NodeType.MERGE &&
      node.type !== NodeType.OUTPUT &&
      node.type !== NodeType.COUNTER &&
      node.type !== NodeType.TELEGRAM_OUTPUT
    ) {
      legacyStartNodeIds.push(node.id);
    }
  }

  if (startNodeIds.length === 0) {
    startNodeIds.push(...legacyStartNodeIds);
  }

  startNodeIds.sort((a, b) => a.localeCompare(b));

  const executableNodesForCycles: ExecutableFlowNode[] = snapshotNodes.filter(
    (node): node is ExecutableFlowNode => node.type !== NodeType.NOTE
  );

  const executableNodeIdsSet = new Set(executableNodesForCycles.map((node) => node.id));
  const executableEdgesForCycles = snapshotEdges.filter(
    (edge) => executableNodeIdsSet.has(edge.source) && executableNodeIdsSet.has(edge.target)
  );

  const cycleAnalysis = analyzeCycles(executableNodesForCycles, executableEdgesForCycles);

  return {
    runId,
    createdAt: Date.now(),
    nodes: snapshotNodes,
    edges: snapshotEdges,
    nodeById,
    incomingEdgesByNode,
    outgoingEdgesByNode,
    executableNodeIds,
    startNodeIds,
    cycleAnalysis
  };
};

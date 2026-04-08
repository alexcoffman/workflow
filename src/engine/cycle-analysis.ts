import type { FlowEdge } from '../domain/edges';
import type { FlowNode } from '../domain/nodes';

import type { CycleAnalysis } from './types';

interface TarjanState {
  indexByNodeId: Map<string, number>;
  lowLinkByNodeId: Map<string, number>;
  stack: string[];
  stackSet: Set<string>;
  currentIndex: number;
  components: string[][];
}

const buildAdjacency = (nodes: FlowNode[], edges: FlowEdge[]): Map<string, string[]> => {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source);
    if (!neighbors) {
      continue;
    }
    neighbors.push(edge.target);
  }

  for (const [nodeId, neighbors] of adjacency.entries()) {
    neighbors.sort((a, b) => a.localeCompare(b));
    adjacency.set(nodeId, neighbors);
  }

  return adjacency;
};

const strongConnect = (nodeId: string, adjacency: Map<string, string[]>, state: TarjanState): void => {
  state.indexByNodeId.set(nodeId, state.currentIndex);
  state.lowLinkByNodeId.set(nodeId, state.currentIndex);
  state.currentIndex += 1;

  state.stack.push(nodeId);
  state.stackSet.add(nodeId);

  const neighbors = adjacency.get(nodeId) ?? [];
  for (const targetId of neighbors) {
    if (!state.indexByNodeId.has(targetId)) {
      strongConnect(targetId, adjacency, state);
      const currentLow = state.lowLinkByNodeId.get(nodeId) ?? 0;
      const targetLow = state.lowLinkByNodeId.get(targetId) ?? 0;
      state.lowLinkByNodeId.set(nodeId, Math.min(currentLow, targetLow));
    } else if (state.stackSet.has(targetId)) {
      const currentLow = state.lowLinkByNodeId.get(nodeId) ?? 0;
      const targetIndex = state.indexByNodeId.get(targetId) ?? 0;
      state.lowLinkByNodeId.set(nodeId, Math.min(currentLow, targetIndex));
    }
  }

  const nodeLow = state.lowLinkByNodeId.get(nodeId);
  const nodeIndex = state.indexByNodeId.get(nodeId);

  if (nodeLow === nodeIndex) {
    const component: string[] = [];

    while (state.stack.length > 0) {
      const member = state.stack.pop();
      if (!member) {
        break;
      }
      state.stackSet.delete(member);
      component.push(member);
      if (member === nodeId) {
        break;
      }
    }

    component.sort((a, b) => a.localeCompare(b));
    state.components.push(component);
  }
};

export const analyzeCycles = (nodes: FlowNode[], edges: FlowEdge[]): CycleAnalysis => {
  const adjacency = buildAdjacency(nodes, edges);
  const state: TarjanState = {
    indexByNodeId: new Map<string, number>(),
    lowLinkByNodeId: new Map<string, number>(),
    stack: [],
    stackSet: new Set<string>(),
    currentIndex: 0,
    components: []
  };

  const orderedNodeIds = [...nodes.map((node) => node.id)].sort((a, b) => a.localeCompare(b));
  for (const nodeId of orderedNodeIds) {
    if (!state.indexByNodeId.has(nodeId)) {
      strongConnect(nodeId, adjacency, state);
    }
  }

  const componentByNodeId: Record<string, string | null> = {};
  const cycleComponentIds = new Set<string>();

  state.components.forEach((component, index) => {
    const componentId = `scc-${index + 1}`;

    let isCycle = component.length > 1;
    if (!isCycle && component.length === 1) {
      const onlyNode = component[0];
      isCycle = edges.some((edge) => edge.source === onlyNode && edge.target === onlyNode);
    }

    for (const nodeId of component) {
      componentByNodeId[nodeId] = componentId;
    }

    if (isCycle) {
      cycleComponentIds.add(componentId);
    }
  });

  const cycleRelatedEdgeIds = new Set<string>();
  for (const edge of edges) {
    const sourceComponent = componentByNodeId[edge.source];
    const targetComponent = componentByNodeId[edge.target];

    if (!sourceComponent || !targetComponent) {
      continue;
    }

    if (sourceComponent === targetComponent && cycleComponentIds.has(sourceComponent)) {
      cycleRelatedEdgeIds.add(edge.id);
    }
  }

  for (const node of nodes) {
    if (!componentByNodeId[node.id]) {
      componentByNodeId[node.id] = null;
    }
  }

  return {
    componentByNodeId,
    cycleComponentIds,
    cycleRelatedEdgeIds
  };
};

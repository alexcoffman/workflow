import { create } from 'zustand';

import { DEFAULT_OPENAI_MODEL, LIMITS } from '../domain/constants';
import type { FlowEdge } from '../domain/edges';
import { NodeType } from '../domain/node-types';
import type { FlowNode } from '../domain/nodes';
import { CURRENT_SCHEMA_VERSION, type FlowSchema, type FlowSchemaMetadata } from '../domain/schema';
import { createId } from '../lib/id';

import { useSettingsStore } from './settings-store';

interface ConnectionInput {
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

interface EditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: FlowSchemaMetadata;
  selectedNodeId: string | null;
  locked: boolean;
  addNodeAtCanvasCenter: ((nodeType: NodeType) => string | null) | null;
  setAddNodeAtCanvasCenter: (handler: ((nodeType: NodeType) => string | null) | null) => void;
  setLocked: (locked: boolean) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (nodeType: NodeType, position?: { x: number; y: number }) => string | null;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, updater: (currentData: FlowNode['data']) => FlowNode['data']) => void;
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  connectNodes: (connection: ConnectionInput) => string | null;
  reconnectEdge: (edgeId: string, connection: ConnectionInput) => boolean;
  removeEdge: (edgeId: string) => void;
  clearSchema: () => void;
  loadSchema: (schema: FlowSchema) => void;
  updateMetadata: (metadata: Partial<FlowSchemaMetadata>) => void;
  toSchema: () => FlowSchema;
}

const now = (): number => Date.now();

const defaultMetadata = (): FlowSchemaMetadata => ({
  name: 'Новый Workflow',
  maxIterations: null,
  createdAt: now(),
  updatedAt: now()
});

const defaultNodePosition = { x: 120, y: 120 };

const createNodeByType = (nodeType: NodeType, position: { x: number; y: number }, defaultModel: string): FlowNode => {
  const id = createId();

  if (nodeType === NodeType.START) {
    return {
      id,
      type: NodeType.START,
      position,
      data: {
        title: 'Старт',
        text: 'Начало выполнения',
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.TEXT) {
    return {
      id,
      type: NodeType.TEXT,
      position,
      data: {
        title: 'Текст',
        text: '',
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.TELEGRAM_INPUT) {
    return {
      id,
      type: NodeType.TELEGRAM_INPUT,
      position,
      data: {
        title: 'Вход из Telegram',
        botId: '',
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.MODEL) {
    return {
      id,
      type: NodeType.MODEL,
      position,
      data: {
        title: 'Модель',
        provider: 'openai',
        model: defaultModel,
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 400,
        showIntermediateMeta: false,
        requireAllInputs: true,
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.DECISION) {
    return {
      id,
      type: NodeType.DECISION,
      position,
      data: {
        title: 'Решение (Да/Нет)',
        provider: 'openai',
        model: defaultModel,
        systemPrompt: '',
        temperature: 0.2,
        maxTokens: 24,
        showIntermediateMeta: false,
        requireAllInputs: true,
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.COUNTER) {
    return {
      id,
      type: NodeType.COUNTER,
      position,
      data: {
        title: 'Счётчик',
        passes: 3,
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.MERGE) {
    return {
      id,
      type: NodeType.MERGE,
      position,
      data: {
        title: 'Обьединить',
        mode: 'join_with_labels',
        separator: '\n\n',
        template: '[{{input-name-1}}]:\n{{input-value-1}}\n\n[{{input-name-2}}]:\n{{input-value-2}}\n\nВсего входов: {{count}}',
        requireAllInputs: true,
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.OUTPUT) {
    return {
      id,
      type: NodeType.OUTPUT,
      position,
      data: {
        title: 'Вывод',
        isActive: true
      }
    };
  }

  if (nodeType === NodeType.TELEGRAM_OUTPUT) {
    return {
      id,
      type: NodeType.TELEGRAM_OUTPUT,
      position,
      data: {
        title: 'Выход в Telegram',
        botId: '',
        isActive: true
      }
    };
  }

  return {
    id,
    type: NodeType.NOTE,
    position,
      data: {
        title: 'Заметка',
        content: '',
        isActive: true
      }
    };
  };

const nextSortOrder = (edges: FlowEdge[]): number => {
  if (edges.length === 0) {
    return 0;
  }

  return Math.max(...edges.map((edge) => edge.sortOrder)) + 1;
};

const resolveDefaultModel = (): string => {
  const models = useSettingsStore.getState().models;
  const firstModel = models[0]?.trim() ?? '';
  return firstModel.length > 0 ? firstModel : DEFAULT_OPENAI_MODEL;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  metadata: defaultMetadata(),
  selectedNodeId: null,
  locked: false,
  addNodeAtCanvasCenter: null,
  setAddNodeAtCanvasCenter: (handler) => set({ addNodeAtCanvasCenter: handler }),
  setLocked: (locked) => set({ locked }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  addNode: (nodeType, position = defaultNodePosition) => {
    const state = get();
    if (state.locked) {
      return null;
    }

    if (state.nodes.length >= LIMITS.maxNodes) {
      return null;
    }

    const nextNode = createNodeByType(nodeType, position, resolveDefaultModel());
    set((current) => ({
      nodes: [...current.nodes, nextNode],
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));
    return nextNode.id;
  },
  removeNode: (nodeId) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNodeId: current.selectedNodeId === nodeId ? null : current.selectedNodeId,
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));
  },
  updateNodeData: (nodeId, updater) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set((current) => ({
      nodes: current.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          data: updater(node.data)
        } as FlowNode;
      }),
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));
  },
  setNodes: (nodes) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set((current) => ({
      nodes,
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));
  },
  setEdges: (edges) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set((current) => ({
      edges,
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));
  },
  connectNodes: (connection) => {
    const state = get();
    if (state.locked) {
      return null;
    }

    if (state.edges.length >= LIMITS.maxEdges) {
      return null;
    }

    const edgeId = createId();
    const edge: FlowEdge = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      sortOrder: nextSortOrder(state.edges)
    };

    set((current) => ({
      edges: [...current.edges, edge],
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));

    return edgeId;
  },
  reconnectEdge: (edgeId, connection) => {
    const state = get();
    if (state.locked) {
      return false;
    }

    const hasTargetEdge = state.edges.some((edge) => edge.id === edgeId);
    if (!hasTargetEdge) {
      return false;
    }

    set((current) => ({
      edges: current.edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge;
        }

        return {
          ...edge,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle
        };
      }),
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));

    return true;
  },
  removeEdge: (edgeId) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set((current) => ({
      edges: current.edges.filter((edge) => edge.id !== edgeId),
      metadata: {
        ...current.metadata,
        updatedAt: now()
      }
    }));
  },
  clearSchema: () => {
    const state = get();
    if (state.locked) {
      return;
    }

    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      metadata: {
        ...defaultMetadata(),
        updatedAt: now()
      }
    });
  },
  loadSchema: (schema) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set({
      nodes: schema.nodes,
      edges: schema.edges,
      metadata: {
        ...schema.metadata,
        updatedAt: now()
      },
      selectedNodeId: null
    });
  },
  updateMetadata: (metadata) => {
    const state = get();
    if (state.locked) {
      return;
    }

    set((current) => ({
      metadata: {
        ...current.metadata,
        ...metadata,
        updatedAt: now()
      }
    }));
  },
  toSchema: () => {
    const state = get();
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      nodes: state.nodes,
      edges: state.edges,
      metadata: state.metadata
    };
  }
}));


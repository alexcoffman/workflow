import { CURRENT_SCHEMA_VERSION, type FlowSchema, type FlowSchemaMetadata } from '../../domain/schema';
import { createMergeInputHandle, parseMergeInputHandleIndex } from '../../domain/merge-input-handles';
import { NodeType } from '../../domain/node-types';
import type { FlowEdge } from '../../domain/edges';
import type { FlowNode } from '../../domain/nodes';
import type { ValidationIssue } from '../../domain/validation';

export type SchemaMigration = (schema: FlowSchema) => FlowSchema;

export const migrationRegistry: Record<string, SchemaMigration> = {
  [CURRENT_SCHEMA_VERSION]: (schema) => schema
};

const now = (): number => Date.now();

const createDefaultMetadata = (): FlowSchemaMetadata => ({
  name: 'Новый Workflow',
  maxIterations: null,
  createdAt: now(),
  updatedAt: now()
});

export const createEmptySchema = (): FlowSchema => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  metadata: createDefaultMetadata()
});

const isNodeType = (value: unknown): value is NodeType => {
  return (
    value === NodeType.START ||
    value === NodeType.TEXT ||
    value === NodeType.TELEGRAM_INPUT ||
    value === NodeType.MODEL ||
    value === NodeType.DECISION ||
    value === NodeType.COUNTER ||
    value === NodeType.MERGE ||
    value === NodeType.OUTPUT ||
    value === NodeType.TELEGRAM_OUTPUT ||
    value === NodeType.NOTE
  );
};

const isPosition = (value: unknown): value is { x: number; y: number } => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { x?: unknown; y?: unknown };
  return typeof candidate.x === 'number' && typeof candidate.y === 'number';
};

const isNode = (value: unknown): value is FlowNode => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { id?: unknown; type?: unknown; position?: unknown; data?: unknown };
  return (
    typeof candidate.id === 'string' &&
    isNodeType(candidate.type) &&
    isPosition(candidate.position) &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  );
};

const isEdge = (value: unknown): value is FlowEdge => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    source?: unknown;
    target?: unknown;
    sourceHandle?: unknown;
    targetHandle?: unknown;
    sortOrder?: unknown;
  };

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.target === 'string' &&
    (typeof candidate.sourceHandle === 'string' || candidate.sourceHandle === null) &&
    (typeof candidate.targetHandle === 'string' || candidate.targetHandle === null) &&
    typeof candidate.sortOrder === 'number'
  );
};

const normalizeEdges = (edges: FlowEdge[], nodes: FlowNode[]): FlowEdge[] => {
  let fallbackSortOrder = 0;
  const normalizedEdges = edges
    .map((edge) => {
      const sortOrder = Number.isFinite(edge.sortOrder) ? edge.sortOrder : fallbackSortOrder++;
      return {
        ...edge,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        sortOrder
      };
    });

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const groupedByMergeTarget = new Map<string, FlowEdge[]>();

  for (const edge of normalizedEdges) {
    const targetNode = nodeById.get(edge.target);
    if (!targetNode || targetNode.type !== NodeType.MERGE) {
      continue;
    }

    if (!groupedByMergeTarget.has(edge.target)) {
      groupedByMergeTarget.set(edge.target, []);
    }

    const group = groupedByMergeTarget.get(edge.target);
    if (!group) {
      continue;
    }

    group.push(edge);
  }

  for (const group of groupedByMergeTarget.values()) {
    group.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      if (a.source !== b.source) {
        return a.source.localeCompare(b.source);
      }
      return a.id.localeCompare(b.id);
    });

    const occupiedIndices = new Set<number>();
    let nextIndex = 1;

    for (const edge of group) {
      let index = parseMergeInputHandleIndex(edge.targetHandle);

      if (index === null || occupiedIndices.has(index)) {
        while (occupiedIndices.has(nextIndex)) {
          nextIndex += 1;
        }
        index = nextIndex;
      }

      occupiedIndices.add(index);
      edge.targetHandle = createMergeInputHandle(index);

      if (nextIndex <= index) {
        nextIndex = index + 1;
      }
    }
  }

  return normalizedEdges.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    return a.id.localeCompare(b.id);
  });
};

const normalizeMetadata = (metadata: FlowSchema['metadata'] | null | undefined): FlowSchemaMetadata => {
  if (!metadata) {
    return createDefaultMetadata();
  }

  return {
    name: metadata.name?.trim() || 'Новый Workflow',
    maxIterations: metadata.maxIterations ?? null,
    createdAt: Number.isFinite(metadata.createdAt) ? metadata.createdAt : now(),
    updatedAt: now()
  };
};

const normalizeNodes = (nodes: FlowNode[]): FlowNode[] => {
  return nodes.map((node) => {
    if (node.type !== NodeType.MERGE) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        requireAllInputs: typeof node.data.requireAllInputs === 'boolean' ? node.data.requireAllInputs : true
      }
    };
  });
};

export const normalizeSchema = (schema: FlowSchema): FlowSchema => {
  const normalizedNodes = normalizeNodes([...schema.nodes]);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: normalizedNodes,
    edges: normalizeEdges([...schema.edges], normalizedNodes),
    metadata: normalizeMetadata(schema.metadata)
  };
};

export const validateSchemaVersion = (schemaVersion: string): ValidationIssue[] => {
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return [
      {
        code: 'INVALID_SCHEMA_VERSION',
        message: `Неподдерживаемая schemaVersion: ${schemaVersion}. Ожидается ${CURRENT_SCHEMA_VERSION}.`,
        nodeId: null,
        edgeId: null,
        severity: 'error'
      }
    ];
  }
  return [];
};

export const parseAndNormalizeSchema = (
  source: string
): { schema: FlowSchema | null; issues: ValidationIssue[] } => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return {
      schema: null,
      issues: [
        {
          code: 'INVALID_SCHEMA_VERSION',
          message: 'Некорректный JSON. Не удалось распарсить схему.',
          nodeId: null,
          edgeId: null,
          severity: 'error'
        }
      ]
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      schema: null,
      issues: [
        {
          code: 'INVALID_SCHEMA_VERSION',
          message: 'Корень схемы должен быть объектом.',
          nodeId: null,
          edgeId: null,
          severity: 'error'
        }
      ]
    };
  }

  const candidate = parsed as {
    schemaVersion?: unknown;
    nodes?: unknown;
    edges?: unknown;
    metadata?: FlowSchema['metadata'];
  };

  if (typeof candidate.schemaVersion !== 'string') {
    return {
      schema: null,
      issues: [
        {
          code: 'INVALID_SCHEMA_VERSION',
          message: 'Поле schemaVersion обязательно.',
          nodeId: null,
          edgeId: null,
          severity: 'error'
        }
      ]
    };
  }

  const versionIssues = validateSchemaVersion(candidate.schemaVersion);
  if (versionIssues.length > 0) {
    return { schema: null, issues: versionIssues };
  }

  if (!Array.isArray(candidate.nodes) || !candidate.nodes.every((item) => isNode(item))) {
    return {
      schema: null,
      issues: [
        {
          code: 'INVALID_SCHEMA_VERSION',
          message: 'Поле nodes должно быть массивом корректных объектов блоков.',
          nodeId: null,
          edgeId: null,
          severity: 'error'
        }
      ]
    };
  }

  if (!Array.isArray(candidate.edges) || !candidate.edges.every((item) => isEdge(item))) {
    return {
      schema: null,
      issues: [
        {
          code: 'INVALID_SCHEMA_VERSION',
          message: 'Поле edges должно быть массивом корректных объектов связей.',
          nodeId: null,
          edgeId: null,
          severity: 'error'
        }
      ]
    };
  }

  const normalized = normalizeSchema({
    schemaVersion: candidate.schemaVersion,
    nodes: candidate.nodes,
    edges: candidate.edges,
    metadata: candidate.metadata ?? createDefaultMetadata()
  });

  return {
    schema: normalized,
    issues: []
  };
};

export const serializeSchema = (schema: FlowSchema): string => {
  return JSON.stringify(normalizeSchema(schema), null, 2);
};

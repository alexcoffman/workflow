import { HANDLE_IDS, LIMITS } from '../domain/constants';
import type { FlowEdge } from '../domain/edges';
import { isMergeInputHandle, parseMergeInputHandleIndex } from '../domain/merge-input-handles';
import { NodeType } from '../domain/node-types';
import { isNodeActive, type FlowNode } from '../domain/nodes';
import type { ValidationIssue, ValidationResult } from '../domain/validation';

import { analyzeCycles } from './cycle-analysis';

export interface RunValidationContext {
  hasApiKey: boolean;
  maxIterations: number | null;
  telegramBotIds?: Set<string>;
}

const pushIssue = (
  issues: ValidationIssue[],
  issue: Omit<ValidationIssue, 'severity'> & { severity?: ValidationIssue['severity'] }
): void => {
  issues.push({
    severity: issue.severity ?? 'error',
    ...issue
  });
};

const isExecutable = (node: FlowNode): boolean => node.type !== NodeType.NOTE;

const isDecisionOutputHandle = (handle: string | null): boolean => {
  return (
    handle === HANDLE_IDS.decisionOutputYes ||
    handle === HANDLE_IDS.decisionOutputNo ||
    handle === HANDLE_IDS.decisionOutputOther
  );
};

const isCounterOutputHandle = (handle: string | null): boolean => {
  return handle === HANDLE_IDS.counterOutputIntermediate || handle === HANDLE_IDS.counterOutputFinal;
};

const collectActiveNodeIds = (
  startNodeIds: string[],
  nodeById: Record<string, FlowNode>,
  outgoingByNode: Record<string, FlowEdge[]>
): Set<string> => {
  const activeNodeIds = new Set<string>();
  const queue = [...startNodeIds];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || activeNodeIds.has(nodeId)) {
      continue;
    }

    const node = nodeById[nodeId];
    if (!node || node.type === NodeType.NOTE) {
      continue;
    }

    activeNodeIds.add(nodeId);

    if (!isNodeActive(node)) {
      continue;
    }

    const outgoingEdges = outgoingByNode[nodeId] ?? [];
    for (const edge of outgoingEdges) {
      const targetNode = nodeById[edge.target];
      if (!targetNode || targetNode.type === NodeType.NOTE || activeNodeIds.has(targetNode.id)) {
        continue;
      }
      queue.push(targetNode.id);
    }
  }

  return activeNodeIds;
};

const validateEdge = (edge: FlowEdge, nodeById: Record<string, FlowNode>): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  const sourceNode = nodeById[edge.source];
  const targetNode = nodeById[edge.target];

  if (!sourceNode || !targetNode) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Связь указывает на несуществующий исходный или целевой блок.',
      nodeId: null,
      edgeId: edge.id
    });
    return issues;
  }

  if (sourceNode.type === NodeType.NOTE || targetNode.type === NodeType.NOTE) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Блоки NOTE не могут участвовать в исполняемых связях.',
      nodeId: null,
      edgeId: edge.id
    });
  }

  if (targetNode.type === NodeType.START || targetNode.type === NodeType.TELEGRAM_INPUT) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Блок СТАРТ и блок ВХОД ИЗ TELEGRAM не могут иметь входящих связей.',
      nodeId: targetNode.id,
      edgeId: edge.id
    });
  }

  if (targetNode.type === NodeType.TEXT && sourceNode.type !== NodeType.START) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Во вход TEXT можно подключать только блок СТАРТ.',
      nodeId: targetNode.id,
      edgeId: edge.id
    });
  }

  if (sourceNode.type === NodeType.TELEGRAM_OUTPUT) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Блок ВЫХОД В TELEGRAM не поддерживает исходящие связи.',
      nodeId: sourceNode.id,
      edgeId: edge.id
    });
  } else if (sourceNode.type === NodeType.DECISION) {
    if (!isDecisionOutputHandle(edge.sourceHandle)) {
      pushIssue(issues, {
        code: 'INVALID_EDGE',
        message: 'Для блока РЕШЕНИЕ sourceHandle должен быть одним из: decision-yes, decision-no, decision-other.',
        nodeId: sourceNode.id,
        edgeId: edge.id
      });
    }
  } else if (sourceNode.type === NodeType.COUNTER) {
    if (!isCounterOutputHandle(edge.sourceHandle)) {
      pushIssue(issues, {
        code: 'INVALID_EDGE',
        message: 'Для блока СЧЁТЧИК sourceHandle должен быть counter-intermediate или counter-final.',
        nodeId: sourceNode.id,
        edgeId: edge.id
      });
    }
  } else if (sourceNode.type === NodeType.TELEGRAM_INPUT) {
    if (edge.sourceHandle !== null && edge.sourceHandle !== HANDLE_IDS.defaultOutput) {
      pushIssue(issues, {
        code: 'INVALID_EDGE',
        message: 'Для блока ВХОД ИЗ TELEGRAM sourceHandle должен быть output или null.',
        nodeId: sourceNode.id,
        edgeId: edge.id
      });
    }
  } else if (edge.sourceHandle !== null && edge.sourceHandle !== HANDLE_IDS.defaultOutput) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Для обычных блоков sourceHandle должен быть output или null.',
      nodeId: sourceNode.id,
      edgeId: edge.id
    });
  }

  if (targetNode.type === NodeType.TEXT) {
    if (edge.targetHandle !== null && edge.targetHandle !== HANDLE_IDS.defaultInput) {
      pushIssue(issues, {
        code: 'INVALID_EDGE',
        message: 'Блок TEXT принимает только input или null.',
        nodeId: targetNode.id,
        edgeId: edge.id
      });
    }
  } else if (targetNode.type === NodeType.MERGE) {
    if (!isMergeInputHandle(edge.targetHandle)) {
      pushIssue(issues, {
        code: 'INVALID_EDGE',
        message: 'Блок ОБЬЕДИНИТЬ принимает только входы вида merge-input-1, merge-input-2 и т.д.',
        nodeId: targetNode.id,
        edgeId: edge.id
      });
    }
  } else if (
    targetNode.type === NodeType.MODEL ||
    targetNode.type === NodeType.DECISION ||
    targetNode.type === NodeType.COUNTER ||
    targetNode.type === NodeType.OUTPUT ||
    targetNode.type === NodeType.TELEGRAM_OUTPUT
  ) {
    if (edge.targetHandle !== null && edge.targetHandle !== HANDLE_IDS.defaultInput) {
      pushIssue(issues, {
        code: 'INVALID_EDGE',
        message: 'Целевой input-handle должен быть input или null.',
        nodeId: targetNode.id,
        edgeId: edge.id
      });
    }
  }

  if (!Number.isFinite(edge.sortOrder)) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Поле edge.sortOrder должно быть конечным числом.',
      nodeId: null,
      edgeId: edge.id
    });
  }

  if (!(typeof edge.sourceHandle === 'string' || edge.sourceHandle === null)) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Поле edge.sourceHandle должно быть строкой или null.',
      nodeId: null,
      edgeId: edge.id
    });
  }

  if (!(typeof edge.targetHandle === 'string' || edge.targetHandle === null)) {
    pushIssue(issues, {
      code: 'INVALID_EDGE',
      message: 'Поле edge.targetHandle должно быть строкой или null.',
      nodeId: null,
      edgeId: edge.id
    });
  }

  return issues;
};

export const validateGraphForRun = (
  nodes: FlowNode[],
  edges: FlowEdge[],
  context: RunValidationContext
): ValidationResult => {
  const telegramBotIds = context.telegramBotIds ?? new Set<string>();
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (nodes.length === 0) {
    pushIssue(errors, {
      code: 'GRAPH_EMPTY',
      message: 'Граф пуст. Добавьте блоки для запуска сценария.',
      nodeId: null,
      edgeId: null
    });
  }

  if (nodes.length > LIMITS.maxNodes) {
    pushIssue(errors, {
      code: 'MAX_NODES_EXCEEDED',
      message: `Превышен лимит блоков (${LIMITS.maxNodes}).`,
      nodeId: null,
      edgeId: null
    });
  }

  if (edges.length > LIMITS.maxEdges) {
    pushIssue(errors, {
      code: 'MAX_EDGES_EXCEEDED',
      message: `Превышен лимит связей (${LIMITS.maxEdges}).`,
      nodeId: null,
      edgeId: null
    });
  }

  const nodeById: Record<string, FlowNode> = {};
  for (const node of nodes) {
    nodeById[node.id] = node;
  }

  const incomingByNode: Record<string, FlowEdge[]> = {};
  const outgoingByNode: Record<string, FlowEdge[]> = {};

  for (const node of nodes) {
    incomingByNode[node.id] = [];
    outgoingByNode[node.id] = [];
  }

  for (const edge of edges) {
    if (incomingByNode[edge.target]) {
      incomingByNode[edge.target].push(edge);
    }

    if (outgoingByNode[edge.source]) {
      outgoingByNode[edge.source].push(edge);
    }
  }

  const startNodes = nodes.filter((node) => node.type === NodeType.START || node.type === NodeType.TELEGRAM_INPUT);
  const startExecutableNodeIds = startNodes
    .filter((node) => (incomingByNode[node.id]?.length ?? 0) === 0)
    .map((node) => node.id);

  const participatingStartNodeIds = startExecutableNodeIds.filter((nodeId) =>
    (outgoingByNode[nodeId] ?? []).some((edge) => {
      const targetNode = nodeById[edge.target];
      return targetNode !== undefined && targetNode.type !== NodeType.NOTE;
    })
  );

  const activeNodeIds = collectActiveNodeIds(participatingStartNodeIds, nodeById, outgoingByNode);

  const activeEdges = edges.filter((edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target));
  const edgesToValidate = activeEdges;

  for (const edge of edgesToValidate) {
    errors.push(...validateEdge(edge, nodeById));
  }

  let hasModelNode = false;

  for (const node of nodes) {
    if (!activeNodeIds.has(node.id)) {
      continue;
    }

    if (!isNodeActive(node)) {
      continue;
    }

    if (node.type === NodeType.START) {
      if (node.data.text.trim().length === 0) {
        pushIssue(errors, {
          code: 'EMPTY_START_NODE',
          message: 'Блок СТАРТ не может быть пустым.',
          nodeId: node.id,
          edgeId: null
        });
      }
    }

    if (node.type === NodeType.TEXT) {
      const incomingCount = incomingByNode[node.id]?.length ?? 0;
      if (node.data.text.trim().length === 0) {
        pushIssue(errors, {
          code: 'EMPTY_TEXT_NODE',
          message: 'Блок TEXT не может быть пустым.',
          nodeId: node.id,
          edgeId: null
        });
      }

      if ((incomingByNode[node.id]?.length ?? 0) === 0 && (outgoingByNode[node.id]?.length ?? 0) === 0) {
        pushIssue(errors, {
          code: 'ORPHAN_TEXT_NODE',
          message: 'Стартовый блок TEXT без исходящих связей блокирует запуск.',
          nodeId: node.id,
          edgeId: null
        });
      }

      if (incomingCount > 1) {
        pushIssue(errors, {
          code: 'INVALID_EDGE',
          message: 'Блок TEXT поддерживает только один вход от блока СТАРТ.',
          nodeId: node.id,
          edgeId: null
        });
      }

      if (node.data.text.length > LIMITS.maxTextLengthPerTextNode) {
        pushIssue(warnings, {
          code: 'EMPTY_TEXT_NODE',
          message: `Блок TEXT превышает рекомендуемый лимит длины (${LIMITS.maxTextLengthPerTextNode}).`,
          nodeId: node.id,
          edgeId: null,
          severity: 'warning'
        });
      }
    }

    if (node.type === NodeType.TELEGRAM_INPUT) {
      const botId = node.data.botId.trim();
      if (botId.length === 0) {
        pushIssue(errors, {
          code: 'TELEGRAM_INPUT_NODE_NO_BOT',
          message: 'Для блока ВХОД ИЗ TELEGRAM нужно выбрать бота.',
          nodeId: node.id,
          edgeId: null
        });
      } else if (!telegramBotIds.has(botId)) {
        pushIssue(errors, {
          code: 'TELEGRAM_BOT_NOT_FOUND',
          message: 'Выбранный Telegram-бот не найден в настройках API.',
          nodeId: node.id,
          edgeId: null
        });
      }
    }

    if (node.type === NodeType.MODEL || node.type === NodeType.DECISION) {
      hasModelNode = true;

      if (node.data.model.trim().length === 0) {
        pushIssue(errors, {
          code: 'MODEL_NODE_NO_MODEL',
          message: 'Для блока модели нужно выбрать модель.',
          nodeId: node.id,
          edgeId: null
        });
      }

      if ((incomingByNode[node.id]?.length ?? 0) === 0) {
        pushIssue(errors, {
          code: 'MODEL_NODE_NO_INPUT',
          message: 'Блоку модели нужна хотя бы одна входящая связь.',
          nodeId: node.id,
          edgeId: null
        });
      }
    }

    if (node.type === NodeType.COUNTER) {
      if ((incomingByNode[node.id]?.length ?? 0) === 0) {
        pushIssue(errors, {
          code: 'COUNTER_NODE_NO_INPUT',
          message: 'Блоку СЧЁТЧИК нужна хотя бы одна входящая связь.',
          nodeId: node.id,
          edgeId: null
        });
      }

      if (!Number.isFinite(node.data.passes) || node.data.passes < 1 || !Number.isInteger(node.data.passes)) {
        pushIssue(errors, {
          code: 'COUNTER_NODE_INVALID_PASSES',
          message: 'Для блока СЧЁТЧИК задайте целое число проходов не меньше 1.',
          nodeId: node.id,
          edgeId: null
        });
      }
    }

    if (node.type === NodeType.TELEGRAM_OUTPUT) {
      const botId = node.data.botId.trim();
      if (botId.length === 0) {
        pushIssue(errors, {
          code: 'TELEGRAM_OUTPUT_NODE_NO_BOT',
          message: 'Для блока ВЫХОД В TELEGRAM нужно выбрать бота.',
          nodeId: node.id,
          edgeId: null
        });
      } else if (!telegramBotIds.has(botId)) {
        pushIssue(errors, {
          code: 'TELEGRAM_BOT_NOT_FOUND',
          message: 'Выбранный Telegram-бот не найден в настройках API.',
          nodeId: node.id,
          edgeId: null
        });
      }

      const incomingCount = incomingByNode[node.id]?.length ?? 0;
      if (incomingCount === 0) {
        pushIssue(errors, {
          code: 'TELEGRAM_OUTPUT_NODE_NO_INPUT',
          message: 'Блоку ВЫХОД В TELEGRAM нужна входящая связь.',
          nodeId: node.id,
          edgeId: null
        });
      }

      if (incomingCount > 1) {
        pushIssue(errors, {
          code: 'TELEGRAM_OUTPUT_NODE_MULTIPLE_INPUTS',
          message: 'Блок ВЫХОД В TELEGRAM поддерживает только один вход.',
          nodeId: node.id,
          edgeId: null
        });
      }
    }

    if (node.type === NodeType.MERGE) {
      if ((incomingByNode[node.id]?.length ?? 0) === 0) {
        pushIssue(errors, {
          code: 'MERGE_NODE_NO_INPUT',
          message: 'Блоку ОБЬЕДИНИТЬ нужны входящие связи.',
          nodeId: node.id,
          edgeId: null
        });
      }

      const occupiedMergeHandles = new Set<number>();
      const incomingEdges = incomingByNode[node.id] ?? [];

      for (const edge of incomingEdges) {
        const handleIndex = parseMergeInputHandleIndex(edge.targetHandle);
        if (handleIndex === null) {
          continue;
        }

        if (occupiedMergeHandles.has(handleIndex)) {
          pushIssue(errors, {
            code: 'INVALID_EDGE',
            message: `Вход merge-input-${handleIndex} у блока ОБЬЕДИНИТЬ уже занят другой связью.`,
            nodeId: node.id,
            edgeId: edge.id
          });
        }

        occupiedMergeHandles.add(handleIndex);
      }

      if (node.data.mode === 'custom_template' && node.data.template.trim().length === 0) {
        pushIssue(errors, {
          code: 'EMPTY_CUSTOM_TEMPLATE',
          message: 'В режиме custom_template у блока MERGE шаблон не может быть пустым.',
          nodeId: node.id,
          edgeId: null
        });
      }
    }
  }

  for (const node of nodes) {
    if (!activeNodeIds.has(node.id)) {
      continue;
    }

    if (!isNodeActive(node)) {
      continue;
    }

    if (node.type !== NodeType.OUTPUT) {
      continue;
    }

    const incomingCount = incomingByNode[node.id]?.length ?? 0;

    if (incomingCount === 0) {
      pushIssue(errors, {
        code: 'OUTPUT_NODE_NO_INPUT',
        message: 'Блоку ВЫВОД нужна входящая связь.',
        nodeId: node.id,
        edgeId: null
      });
    }

    if (incomingCount > 1) {
      pushIssue(errors, {
        code: 'OUTPUT_NODE_MULTIPLE_INPUTS',
        message: 'Блок ВЫВОД поддерживает только один вход.',
        nodeId: node.id,
        edgeId: null
      });
    }
  }

  if (hasModelNode && !context.hasApiKey) {
    pushIssue(errors, {
      code: 'MISSING_API_KEY',
      message: 'Для запуска блоков модели требуется OpenAI API key.',
      nodeId: null,
      edgeId: null
    });
  }

  if (startExecutableNodeIds.length === 0) {
    pushIssue(errors, {
      code: 'NO_START_NODE',
      message: 'Для запуска схемы добавьте блок СТАРТ или блок ВХОД ИЗ TELEGRAM.',
      nodeId: null,
      edgeId: null
    });
  }

  const activeExecutableNodes = nodes.filter(
    (node): node is FlowNode => activeNodeIds.has(node.id) && isExecutable(node) && isNodeActive(node)
  );
  const activeExecutableNodeIds = new Set(activeExecutableNodes.map((node) => node.id));
  const activeExecutableEdges = activeEdges.filter(
    (edge) => activeExecutableNodeIds.has(edge.source) && activeExecutableNodeIds.has(edge.target)
  );

  const cycleAnalysis = analyzeCycles(activeExecutableNodes, activeExecutableEdges);
  const hasCycle = cycleAnalysis.cycleRelatedEdgeIds.size > 0;

  if (hasCycle && (context.maxIterations === null || context.maxIterations <= 0)) {
    pushIssue(errors, {
      code: 'CYCLE_WITHOUT_MAX_ITERATIONS',
      message: 'В графе есть цикл. Необходимо указать maxIterations.',
      nodeId: null,
      edgeId: null
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};




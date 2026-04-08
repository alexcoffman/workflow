import { useEffect, useMemo, useRef, type DragEvent as ReactDragEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodesChange
} from 'reactflow';

import type { FlowEdge } from '../../domain/edges';
import { parseMergeInputHandleIndex } from '../../domain/merge-input-handles';
import { NodeType } from '../../domain/node-types';
import type { FlowNode } from '../../domain/nodes';
import type { EdgeExecutionVisualState } from '../../domain/run';
import { useToast } from '../../components/ui/use-toast';
import { useEditorStore } from '../../stores/editor-store';
import { useRunStore } from '../../stores/run-store';

import { validateConnection } from './connection-rules';
import { NODE_DND_MIME, parseDraggedNodeType } from './dnd';
import { CurvedFlowEdge, type CurvedFlowEdgeData } from './edges/CurvedFlowEdge';
import { CounterFlowNode } from './nodes/CounterFlowNode';
import { DecisionFlowNode } from './nodes/DecisionFlowNode';
import { MergeFlowNode } from './nodes/MergeFlowNode';
import { ModelFlowNode } from './nodes/ModelFlowNode';
import { NoteFlowNode } from './nodes/NoteFlowNode';
import { OutputFlowNode } from './nodes/OutputFlowNode';
import { StartFlowNode } from './nodes/StartFlowNode';
import { TelegramInputFlowNode } from './nodes/TelegramInputFlowNode';
import { TelegramOutputFlowNode } from './nodes/TelegramOutputFlowNode';
import { TextFlowNode } from './nodes/TextFlowNode';

const nodeTypes = {
  [NodeType.START]: StartFlowNode,
  [NodeType.TEXT]: TextFlowNode,
  [NodeType.TELEGRAM_INPUT]: TelegramInputFlowNode,
  [NodeType.MODEL]: ModelFlowNode,
  [NodeType.DECISION]: DecisionFlowNode,
  [NodeType.COUNTER]: CounterFlowNode,
  [NodeType.MERGE]: MergeFlowNode,
  [NodeType.OUTPUT]: OutputFlowNode,
  [NodeType.TELEGRAM_OUTPUT]: TelegramOutputFlowNode,
  [NodeType.NOTE]: NoteFlowNode
};

const edgeTypes = {
  workflowCurved: CurvedFlowEdge
};

const EDGE_LANE_GAP = 18;
const EDGE_BASE_CURVATURE = 0.35;

const edgeStateVisual: Record<
  EdgeExecutionVisualState,
  {
    stroke: string;
    strokeWidth: number;
    markerColor: string;
    animated: boolean;
    filter?: string;
    strokeDasharray?: string;
  }
> = {
  idle: {
    stroke: '#94a3b8',
    strokeWidth: 2,
    markerColor: '#94a3b8',
    animated: false
  },
  running: {
    stroke: '#22d3ee',
    strokeWidth: 3.6,
    markerColor: '#22d3ee',
    animated: true,
    filter: 'drop-shadow(0 0 7px rgba(34, 211, 238, 0.72))'
  },
  completed: {
    stroke: '#38bdf8',
    strokeWidth: 2.8,
    markerColor: '#38bdf8',
    animated: false,
    filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.45))'
  },
  failed: {
    stroke: '#f43f5e',
    strokeWidth: 2.8,
    markerColor: '#f43f5e',
    animated: false,
    filter: 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.45))'
  },
  aborted: {
    stroke: '#fb923c',
    strokeWidth: 2.8,
    markerColor: '#fb923c',
    animated: false,
    filter: 'drop-shadow(0 0 6px rgba(251, 146, 60, 0.45))'
  },
  skipped: {
    stroke: '#f59e0b',
    strokeWidth: 2.8,
    markerColor: '#f59e0b',
    animated: false,
    filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.45))'
  }
};

const toReactFlowNodes = (nodes: FlowNode[]): Node[] => {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    draggable: true,
    selectable: true
  }));
};

const createLaneOffsetMap = (edges: FlowEdge[]): Map<string, number> => {
  const grouped = new Map<string, FlowEdge[]>();

  for (const edge of edges) {
    const sourceHandle = edge.sourceHandle ?? 'null';
    const targetHandle = edge.targetHandle ?? 'null';
    const groupKey = `${edge.source}::${edge.target}::${sourceHandle}::${targetHandle}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }

    const items = grouped.get(groupKey);
    if (!items) {
      continue;
    }

    items.push(edge);
  }

  const laneOffsets = new Map<string, number>();

  for (const itemGroup of grouped.values()) {
    const ordered = [...itemGroup].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.id.localeCompare(b.id);
    });

    const centerIndex = (ordered.length - 1) / 2;
    for (let index = 0; index < ordered.length; index += 1) {
      const edge = ordered[index];
      const laneIndex = index - centerIndex;
      laneOffsets.set(edge.id, laneIndex * EDGE_LANE_GAP);
    }
  }

  return laneOffsets;
};

const toReactFlowEdges = (
  edges: ReturnType<typeof useEditorStore.getState>['edges'],
  edgeExecutionState: Record<string, EdgeExecutionVisualState>,
  edgeAnimationTickById: Record<string, number>
): Array<Edge<CurvedFlowEdgeData>> => {
  const laneOffsets = createLaneOffsetMap(edges);

  return edges.map((edge) => {
    const state = edgeExecutionState[edge.id] ?? 'idle';
    const visual = edgeStateVisual[state];

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: 'workflowCurved',
      animated: visual.animated,
      data: {
        laneOffset: laneOffsets.get(edge.id) ?? 0,
        curvature: EDGE_BASE_CURVATURE,
        animationTick: edgeAnimationTickById[edge.id] ?? 0,
        animationDurationMs: 2000
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: visual.markerColor
      },
      style: {
        stroke: visual.stroke,
        strokeWidth: visual.strokeWidth,
        filter: visual.filter,
        strokeDasharray: visual.strokeDasharray
      }
    };
  });
};

const FlowCanvasInner = (): JSX.Element => {
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const locked = useEditorStore((state) => state.locked);
  const edgeExecutionState = useRunStore((state) => state.edgeExecutionState);
  const edgeAnimationTickById = useRunStore((state) => state.edgeAnimationTickById);
  const setNodes = useEditorStore((state) => state.setNodes);
  const connectNodes = useEditorStore((state) => state.connectNodes);
  const reconnectEdge = useEditorStore((state) => state.reconnectEdge);
  const addNode = useEditorStore((state) => state.addNode);
  const removeNode = useEditorStore((state) => state.removeNode);
  const removeEdge = useEditorStore((state) => state.removeEdge);
  const selectNode = useEditorStore((state) => state.selectNode);
  const setAddNodeAtCanvasCenter = useEditorStore((state) => state.setAddNodeAtCanvasCenter);
  const { screenToFlowPosition } = useReactFlow();

  const { toast } = useToast();
  const edgeReconnectSuccessful = useRef(true);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const rfNodes = useMemo(() => toReactFlowNodes(nodes), [nodes]);
  const rfEdges = useMemo(
    () => toReactFlowEdges(edges, edgeExecutionState, edgeAnimationTickById),
    [edges, edgeExecutionState, edgeAnimationTickById]
  );
  useEffect(() => {
    const addInCanvasCenter = (nodeType: NodeType): string | null => {
      const wrapper = canvasWrapperRef.current;
      if (!wrapper) {
        return addNode(nodeType);
      }

      const rect = wrapper.getBoundingClientRect();
      const centerPosition = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });

      const nodeId = addNode(nodeType, centerPosition);
      if (nodeId) {
        selectNode(nodeId);
      }

      return nodeId;
    };

    setAddNodeAtCanvasCenter(addInCanvasCenter);

    return () => {
      setAddNodeAtCanvasCenter(null);
    };
  }, [addNode, screenToFlowPosition, selectNode, setAddNodeAtCanvasCenter]);

  const hasOutputInputLimitViolation = (targetNode: FlowNode | undefined, ignoredEdgeId?: string): boolean => {
    if (!targetNode || (targetNode.type !== NodeType.OUTPUT && targetNode.type !== NodeType.TELEGRAM_OUTPUT)) {
      return false;
    }

    const incomingEdges = edges.filter((edge) => edge.target === targetNode.id && edge.id !== ignoredEdgeId);
    return incomingEdges.length >= 1;
  };

  const hasMergeInputLimitViolation = (
    targetNode: FlowNode | undefined,
    targetHandle: string | null,
    ignoredEdgeId?: string
  ): boolean => {
    if (!targetNode || targetNode.type !== NodeType.MERGE) {
      return false;
    }

    const targetIndex = parseMergeInputHandleIndex(targetHandle);
    if (targetIndex === null) {
      return false;
    }

    return edges.some((edge) => {
      if (edge.target !== targetNode.id || edge.id === ignoredEdgeId) {
        return false;
      }
      return parseMergeInputHandleIndex(edge.targetHandle) === targetIndex;
    });
  };

  const onNodesChange: OnNodesChange = (changes: NodeChange[]) => {
    if (locked) {
      return;
    }

    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    for (const nodeId of removed) {
      removeNode(nodeId);
    }

    const positionChanges = new Map<string, { x: number; y: number }>();
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        positionChanges.set(change.id, change.position);
      }
      if (change.type === 'select') {
        if (change.selected) {
          selectNode(change.id);
        } else {
          const hasAnySelected = changes.some((item) => item.type === 'select' && item.selected);
          if (!hasAnySelected) {
            selectNode(null);
          }
        }
      }
    }

    if (positionChanges.size > 0) {
      const updatedNodes = nodes.map((node) => {
        const nextPosition = positionChanges.get(node.id);
        if (!nextPosition) {
          return node;
        }

        return {
          ...node,
          position: {
            x: nextPosition.x,
            y: nextPosition.y
          }
        };
      });

      setNodes(updatedNodes);
    }
  };

  const onDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (locked) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (locked) {
      toast({
        title: 'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ',
        description: 'РћСЃС‚Р°РЅРѕРІРёС‚Рµ РІС‹РїРѕР»РЅРµРЅРёРµ, С‡С‚РѕР±С‹ РґРѕР±Р°РІР»СЏС‚СЊ РЅРѕРІС‹Рµ Р±Р»РѕРєРё.',
        variant: 'error'
      });
      return;
    }

    event.preventDefault();

    const rawNodeType = event.dataTransfer.getData(NODE_DND_MIME) || event.dataTransfer.getData('text/plain');
    const nodeType = parseDraggedNodeType(rawNodeType);
    if (!nodeType) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    const nodeId = addNode(nodeType, position);
    if (!nodeId) {
      toast({
        title: 'РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ Р±Р»РѕРє',
        description: 'Р”РѕСЃС‚РёРіРЅСѓС‚ Р»РёРјРёС‚ Р±Р»РѕРєРѕРІ РёР»Рё СЂРµРґР°РєС‚РѕСЂ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ.',
        variant: 'error'
      });
      return;
    }

    selectNode(nodeId);
  };

  const onConnect = (connection: Connection) => {
    if (locked) {
      toast({
        title: 'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ',
        description: 'РћСЃС‚Р°РЅРѕРІРёС‚Рµ РІС‹РїРѕР»РЅРµРЅРёРµ, С‡С‚РѕР±С‹ РјРµРЅСЏС‚СЊ СЃС‚СЂСѓРєС‚СѓСЂСѓ РіСЂР°С„Р°.',
        variant: 'error'
      });
      return;
    }

    if (!connection.source || !connection.target) {
      return;
    }

    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);

    if (hasOutputInputLimitViolation(targetNode)) {
      toast({
        title: 'Ограничение блока ВЫВОД',
        description: 'Блок ВЫВОД принимает только одну входящую связь.',
        variant: 'error'
      });
      return;
    }

    if (hasMergeInputLimitViolation(targetNode, connection.targetHandle ?? null)) {
      toast({
        title: 'Вход уже занят',
        description: 'У блока ОБЬЕДИНИТЬ каждый вход принимает только одну связь.',
        variant: 'error'
      });
      return;
    }

    const validation = validateConnection(
      sourceNode,
      targetNode,
      connection.sourceHandle ?? null,
      connection.targetHandle ?? null
    );

    if (!validation.isValid) {
      toast({
        title: 'РќРµРґРѕРїСѓСЃС‚РёРјРѕРµ СЃРѕРµРґРёРЅРµРЅРёРµ',
        description: validation.reason ?? 'РўР°РєРѕРµ СЃРѕРµРґРёРЅРµРЅРёРµ РЅРµ СЂР°Р·СЂРµС€РµРЅРѕ.',
        variant: 'error'
      });
      return;
    }

    const edgeId = connectNodes({
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null
    });

    if (!edgeId) {
      toast({
        title: 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ СЃРІСЏР·СЊ',
        description: 'Р”РѕСЃС‚РёРіРЅСѓС‚ Р»РёРјРёС‚ СЃРІСЏР·РµР№ РёР»Рё СЂРµРґР°РєС‚РѕСЂ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ.',
        variant: 'error'
      });
    }
  };

  const onReconnectStart = () => {
    edgeReconnectSuccessful.current = false;
  };

  const onReconnect = (oldEdge: Edge, connection: Connection) => {
    if (locked) {
      return;
    }

    if (!connection.source || !connection.target) {
      return;
    }

    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);

    if (hasOutputInputLimitViolation(targetNode, oldEdge.id)) {
      toast({
        title: 'Ограничение блока ВЫВОД',
        description: 'Блок ВЫВОД принимает только одну входящую связь.',
        variant: 'error'
      });
      return;
    }

    if (hasMergeInputLimitViolation(targetNode, connection.targetHandle ?? null, oldEdge.id)) {
      toast({
        title: 'Вход уже занят',
        description: 'У блока ОБЬЕДИНИТЬ каждый вход принимает только одну связь.',
        variant: 'error'
      });
      return;
    }

    const validation = validateConnection(
      sourceNode,
      targetNode,
      connection.sourceHandle ?? null,
      connection.targetHandle ?? null
    );

    if (!validation.isValid) {
      toast({
        title: 'РќРµРґРѕРїСѓСЃС‚РёРјРѕРµ СЃРѕРµРґРёРЅРµРЅРёРµ',
        description: validation.reason ?? 'РўР°РєРѕРµ СЃРѕРµРґРёРЅРµРЅРёРµ РЅРµ СЂР°Р·СЂРµС€РµРЅРѕ.',
        variant: 'error'
      });
      return;
    }

    const updated = reconnectEdge(oldEdge.id, {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null
    });

    if (!updated) {
      toast({
        title: 'РќРµ СѓРґР°Р»РѕСЃСЊ РёР·РјРµРЅРёС‚СЊ СЃРІСЏР·СЊ',
        description: 'РЎРІСЏР·СЊ РЅРµ РЅР°Р№РґРµРЅР° РёР»Рё СЂРµРґР°РєС‚РѕСЂ СЃРµР№С‡Р°СЃ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ.',
        variant: 'error'
      });
      return;
    }

    edgeReconnectSuccessful.current = true;
  };

  const onReconnectEnd = (event: MouseEvent | TouchEvent, edge: Edge) => {
    if (locked) {
      return;
    }

    const dropTarget = event.target;
    const droppedIntoPane =
      dropTarget instanceof Element && Boolean(dropTarget.closest('.react-flow__pane'));

    if (!edgeReconnectSuccessful.current && droppedIntoPane) {
      removeEdge(edge.id);
      toast({
        title: 'РЎРІСЏР·СЊ СѓРґР°Р»РµРЅР°',
        description: 'РЎРІСЏР·СЊ Р±С‹Р»Р° СѓРґР°Р»РµРЅР°, РїРѕС‚РѕРјСѓ С‡С‚Рѕ РІС‹ РѕС‚РїСѓСЃС‚РёР»Рё РµС‘ РІ РїСѓСЃС‚РѕРј РјРµСЃС‚Рµ.',
        variant: 'default'
      });
    }

    edgeReconnectSuccessful.current = true;
  };

  return (
    <div ref={canvasWrapperRef} className="h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        style={{ background: 'linear-gradient(180deg, #172334 0%, #132033 100%)' }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => {
          if (locked) {
            return;
          }

          for (const change of changes) {
            if (change.type === 'remove') {
              removeEdge(change.id);
            }
          }
        }}
        onConnect={onConnect}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        edgesUpdatable={!locked}
        elementsSelectable
        deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
        fitView
        minZoom={0.25}
        maxZoom={1.8}
        defaultEdgeOptions={{
          type: 'workflowCurved',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: '#94a3b8'
          }
        }}
      >
        <Background color="#40556f" gap={22} size={1} />
        <Controls showInteractive={false} />
        <Panel
          position="top-right"
          className="rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-panel backdrop-blur-sm"
        >
          {locked ? 'Режим выполнения: редактор заблокирован' : 'Режим редактирования'}
        </Panel>
      </ReactFlow>
    </div>
  );
};

export const FlowCanvas = (): JSX.Element => {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
};




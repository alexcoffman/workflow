import { memo, useEffect, useMemo } from 'react';
import { Position, useUpdateNodeInternals, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import { createMergeInputHandle, parseMergeInputHandleIndex } from '../../../domain/merge-input-handles';
import type { MergeNodeData } from '../../../domain/nodes';
import { useEditorStore } from '../../../stores/editor-store';
import { useRunStore } from '../../../stores/run-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const MergeFlowNode = memo((props: NodeProps<MergeNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const edges = useEditorStore((state) => state.edges);
  const updateNodeInternals = useUpdateNodeInternals();
  const isActive = props.data.isActive !== false;

  const inputHandleCount = useMemo(() => {
    const incomingEdges = edges.filter((edge) => edge.target === props.id);
    if (incomingEdges.length === 0) {
      return 1;
    }

    const maxIndex = incomingEdges.reduce((maxValue, edge) => {
      const handleIndex = parseMergeInputHandleIndex(edge.targetHandle) ?? 1;
      return Math.max(maxValue, handleIndex);
    }, 1);

    return maxIndex + 1;
  }, [edges, props.id]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      updateNodeInternals(props.id);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [inputHandleCount, props.id, updateNodeInternals]);

  return (
    <>
      {Array.from({ length: inputHandleCount }).map((_, index) => {
        const inputIndex = index + 1;
        const top = ((inputIndex * 100) / (inputHandleCount + 1)).toFixed(2);

        return (
          <LabeledHandle
            key={`merge-input-${inputIndex}`}
            type="target"
            id={createMergeInputHandle(inputIndex)}
            position={Position.Left}
            tooltip={`Вход ${inputIndex}: источник для объединения`}
            style={{ top: `${top}%` }}
            className="!h-2.5 !w-2.5 !bg-slate-500"
          />
        );
      })}

      <NodeShell
        title={props.data.title || 'Обьединить'}
        tag="ОБЬЕДИНИТЬ"
        summary=""
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />

      <LabeledHandle
        type="source"
        id={HANDLE_IDS.defaultOutput}
        position={Position.Right}
        tooltip="Выход: объединенный результат"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
    </>
  );
});

MergeFlowNode.displayName = 'MergeFlowNode';

import { memo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { ModelNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const ModelFlowNode = memo((props: NodeProps<ModelNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const modelLabel = props.data.model || 'не выбрана';
  const isActive = props.data.isActive !== false;

  return (
    <>
      <LabeledHandle
        type="target"
        id={HANDLE_IDS.defaultInput}
        position={Position.Left}
        tooltip="Вход: текст от предыдущих блоков"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
      <NodeShell
        title={props.data.title || 'Модель'}
        tag="МОДЕЛЬ"
        summary={`Модель: ${modelLabel}`}
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.defaultOutput}
        position={Position.Right}
        tooltip="Выход: ответ модели"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
    </>
  );
});

ModelFlowNode.displayName = 'ModelFlowNode';

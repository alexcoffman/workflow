import { memo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { OutputNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const OutputFlowNode = memo((props: NodeProps<OutputNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const isActive = props.data.isActive !== false;

  return (
    <>
      <LabeledHandle
        type="target"
        id={HANDLE_IDS.defaultInput}
        position={Position.Left}
        tooltip="Вход: итоговый текст"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.defaultOutput}
        position={Position.Right}
        tooltip="Выход: передача текста дальше"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
      <NodeShell
        title={props.data.title || 'Вывод'}
        tag="ВЫВОД"
        summary=""
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
    </>
  );
});

OutputFlowNode.displayName = 'OutputFlowNode';

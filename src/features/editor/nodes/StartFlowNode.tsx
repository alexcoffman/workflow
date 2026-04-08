import { memo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { StartNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const StartFlowNode = memo((props: NodeProps<StartNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const isActive = props.data.isActive !== false;

  return (
    <>
      <NodeShell
        title={props.data.title || 'Старт'}
        tag="СТАРТ"
        summary={props.data.text.trim().length > 0 ? props.data.text : ''}
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.defaultOutput}
        position={Position.Right}
        tooltip="Выход: запускает следующую цепочку"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
    </>
  );
});

StartFlowNode.displayName = 'StartFlowNode';

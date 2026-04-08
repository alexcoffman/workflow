import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { NoteNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';

import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const NoteFlowNode = memo((props: NodeProps<NoteNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const isActive = props.data.isActive !== false;

  return (
    <NodeShell
      title={props.data.title || 'Заметка'}
      tag="ЗАМЕТКА"
      summary=""
      executionState={executionState}
      selected={props.selected}
      isActive={isActive}
      action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
    />
  );
});

NoteFlowNode.displayName = 'NoteFlowNode';

import { memo, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { CounterNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const CounterFlowNode = memo((props: NodeProps<CounterNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const runStatus = useRunStore((state) => state.runStatus);
  const counterProgress = useRunStore((state) => state.counterProgressByNodeId[props.id]);
  const isActive = props.data.isActive !== false;

  const title = useMemo(() => {
    const baseTitle = props.data.title?.trim() || 'Счетчик';

    if (runStatus !== 'running' || !counterProgress || counterProgress.total <= 0) {
      return baseTitle;
    }

    return `${baseTitle} ${counterProgress.remaining}/${counterProgress.total}`;
  }, [counterProgress, props.data.title, runStatus]);

  return (
    <>
      <LabeledHandle
        type="target"
        id={HANDLE_IDS.defaultInput}
        position={Position.Left}
        tooltip="Вход: сообщение для счетчика"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
      <NodeShell
        title={title}
        tag="СЧЕТЧИК"
        summary=""
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.counterOutputIntermediate}
        position={Position.Right}
        tooltip="Выход промежуточный: пока проходы не закончились"
        className="!h-2.5 !w-2.5 !bg-sky-500"
        style={{ top: '36%' }}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.counterOutputFinal}
        position={Position.Right}
        tooltip="Выход финальный: когда счетчик достиг нуля"
        className="!h-2.5 !w-2.5 !bg-emerald-500"
        style={{ top: '64%' }}
      />
    </>
  );
});

CounterFlowNode.displayName = 'CounterFlowNode';

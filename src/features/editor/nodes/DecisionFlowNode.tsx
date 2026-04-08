import { memo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { DecisionNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const DecisionFlowNode = memo((props: NodeProps<DecisionNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const isActive = props.data.isActive !== false;

  return (
    <>
      <LabeledHandle
        type="target"
        id={HANDLE_IDS.defaultInput}
        position={Position.Left}
        tooltip="Вход: текст для принятия решения"
        className="!h-2.5 !w-2.5 !bg-slate-500"
      />
      <NodeShell
        title={props.data.title || 'Решение (Да/Нет)'}
        tag="РЕШЕНИЕ"
        summary={`Модель: ${props.data.model || 'не выбрана'}`}
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.decisionOutputYes}
        position={Position.Right}
        tooltip="Выход ДА: когда ответ модели = Да"
        className="!h-2.5 !w-2.5 !bg-emerald-500"
        style={{ top: '28%' }}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.decisionOutputNo}
        position={Position.Right}
        tooltip="Выход НЕТ: когда ответ модели = Нет"
        className="!h-2.5 !w-2.5 !bg-rose-500"
        style={{ top: '50%' }}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.decisionOutputOther}
        position={Position.Right}
        tooltip="Выход ДРУГОЕ: когда ответ не Да и не Нет"
        className="!h-2.5 !w-2.5 !bg-slate-500"
        style={{ top: '72%' }}
      />
    </>
  );
});

DecisionFlowNode.displayName = 'DecisionFlowNode';

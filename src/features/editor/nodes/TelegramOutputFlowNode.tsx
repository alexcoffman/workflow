import { memo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { TelegramOutputNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';
import { useSettingsStore } from '../../../stores/settings-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const TelegramOutputFlowNode = memo((props: NodeProps<TelegramOutputNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const telegramBots = useSettingsStore((state) => state.telegramBots);
  const isActive = props.data.isActive !== false;

  const botName =
    telegramBots.find((bot) => bot.id === props.data.botId)?.name ??
    (props.data.botId.trim().length > 0 ? 'Бот не найден' : 'Не выбран');

  return (
    <>
      <LabeledHandle
        type="target"
        id={HANDLE_IDS.defaultInput}
        position={Position.Left}
        tooltip="Вход: текст для отправки в Telegram"
        className="!h-2.5 !w-2.5 !bg-cyan-400"
      />
      <NodeShell
        title={props.data.title || 'Выход в Telegram'}
        tag="TELEGRAM ВЫХОД"
        summary={`Бот: ${botName}`}
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
    </>
  );
});

TelegramOutputFlowNode.displayName = 'TelegramOutputFlowNode';

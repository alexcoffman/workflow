import { memo } from 'react';
import { Position, type NodeProps } from 'reactflow';

import { HANDLE_IDS } from '../../../domain/constants';
import type { TelegramInputNodeData } from '../../../domain/nodes';
import { useRunStore } from '../../../stores/run-store';
import { useSettingsStore } from '../../../stores/settings-store';

import { LabeledHandle } from './labeled-handle';
import { NodeActivationToggle } from './node-activation-toggle';
import { NodeShell } from './node-shell';

export const TelegramInputFlowNode = memo((props: NodeProps<TelegramInputNodeData>) => {
  const executionState = useRunStore((state) => state.nodeExecutionState[props.id] ?? 'idle');
  const telegramBots = useSettingsStore((state) => state.telegramBots);
  const isActive = props.data.isActive !== false;

  const botName =
    telegramBots.find((bot) => bot.id === props.data.botId)?.name ??
    (props.data.botId.trim().length > 0 ? 'Бот не найден' : 'Не выбран');

  return (
    <>
      <NodeShell
        title={props.data.title || 'Вход из Telegram'}
        tag="TELEGRAM ВХОД"
        summary={`Бот: ${botName}`}
        executionState={executionState}
        selected={props.selected}
        isActive={isActive}
        action={<NodeActivationToggle nodeId={props.id} data={props.data} />}
      />
      <LabeledHandle
        type="source"
        id={HANDLE_IDS.defaultOutput}
        position={Position.Right}
        tooltip="Выход: текст сообщения из Telegram"
        className="!h-2.5 !w-2.5 !bg-cyan-400"
      />
    </>
  );
});

TelegramInputFlowNode.displayName = 'TelegramInputFlowNode';

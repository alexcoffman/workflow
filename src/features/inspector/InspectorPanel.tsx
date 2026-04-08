import { Trash2 } from 'lucide-react';

import { SectionPanel } from '../../components/layout/section-panel';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { APP_VERSION, LIMITS } from '../../domain/constants';
import { supportsTemperatureParameter } from '../../domain/model-capabilities';
import { NodeType } from '../../domain/node-types';
import type {
  CounterNode,
  DecisionNode,
  MergeNode,
  ModelNode,
  NoteNode,
  OutputNode,
  StartNode,
  TelegramInputNode,
  TelegramOutputNode,
  TextNode
} from '../../domain/nodes';
import { useEditorStore } from '../../stores/editor-store';
import { useRunStore } from '../../stores/run-store';
import { useSettingsStore } from '../../stores/settings-store';

const TextNodeInspector = ({ node, disabled }: { node: TextNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="text-title">Название</Label>
        <Input
          id="text-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as TextNode['data']),
              title: value
            }));
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="text-value">Текст</Label>
        <Textarea
          id="text-value"
          rows={8}
          value={node.data.text}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value.slice(0, LIMITS.maxTextLengthPerTextNode);
            updateNodeData(node.id, (current) => ({
              ...(current as TextNode['data']),
              text: value
            }));
          }}
        />
        <p className="text-xs text-muted-foreground">
          {node.data.text.length}/{LIMITS.maxTextLengthPerTextNode}
        </p>
      </div>
    </div>
  );
};

const StartNodeInspector = ({ node, disabled }: { node: StartNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="start-title">Название</Label>
        <Input
          id="start-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as StartNode['data']),
              title: value
            }));
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="start-text">Текст старта</Label>
        <Textarea
          id="start-text"
          rows={6}
          value={node.data.text}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value.slice(0, LIMITS.maxTextLengthPerTextNode);
            updateNodeData(node.id, (current) => ({
              ...(current as StartNode['data']),
              text: value
            }));
          }}
        />
        <p className="text-xs text-muted-foreground">
          {node.data.text.length}/{LIMITS.maxTextLengthPerTextNode}
        </p>
      </div>
    </div>
  );
};

const ModelNodeInspector = ({ node, disabled }: { node: ModelNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const models = useSettingsStore((state) => state.models);
  const isTemperatureSupported = supportsTemperatureParameter(node.data.model);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="model-title">Название</Label>
        <Input
          id="model-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as ModelNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label>Модель</Label>
        <Select
          value={node.data.model}
          onValueChange={(value) => {
            updateNodeData(node.id, (current) => ({
              ...(current as ModelNode['data']),
              model: value
            }));
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите модель" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="system-prompt">Системный промпт (instructions)</Label>
        <Textarea
          id="system-prompt"
          rows={4}
          value={node.data.systemPrompt}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as ModelNode['data']),
              systemPrompt: value
            }));
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {isTemperatureSupported ? (
          <div className="space-y-1">
            <Label htmlFor="temperature">Температура</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={node.data.temperature}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateNodeData(node.id, (current) => ({
                  ...(current as ModelNode['data']),
                  temperature: Number.isFinite(value) ? value : 0.7
                }));
              }}
            />
          </div>
        ) : null}
        <div className={isTemperatureSupported ? 'space-y-1' : 'col-span-2 space-y-1'}>
          <Label htmlFor="max-tokens">Макс. токенов</Label>
          <Input
            id="max-tokens"
            type="number"
            min={1}
            max={4096}
            value={node.data.maxTokens}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              updateNodeData(node.id, (current) => ({
                ...(current as ModelNode['data']),
                maxTokens: Number.isFinite(value) ? value : 400
              }));
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={node.data.requireAllInputs}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.checked;
              updateNodeData(node.id, (current) => ({
                ...(current as ModelNode['data']),
                requireAllInputs: value
              }));
            }}
          />
          Требовать все входы
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={node.data.showIntermediateMeta}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.checked;
              updateNodeData(node.id, (current) => ({
                ...(current as ModelNode['data']),
                showIntermediateMeta: value
              }));
            }}
          />
          Показывать метаданные ответа
        </label>
      </div>
    </div>
  );
};

const DecisionNodeInspector = ({ node, disabled }: { node: DecisionNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const models = useSettingsStore((state) => state.models);
  const isTemperatureSupported = supportsTemperatureParameter(node.data.model);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="decision-title">Название</Label>
        <Input
          id="decision-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as DecisionNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label>Модель</Label>
        <Select
          value={node.data.model}
          onValueChange={(value) => {
            updateNodeData(node.id, (current) => ({
              ...(current as DecisionNode['data']),
              model: value
            }));
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите модель" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="decision-system-prompt">Системный промпт (instructions)</Label>
        <Textarea
          id="decision-system-prompt"
          rows={4}
          value={node.data.systemPrompt}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as DecisionNode['data']),
              systemPrompt: value
            }));
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {isTemperatureSupported ? (
          <div className="space-y-1">
            <Label htmlFor="decision-temperature">Температура</Label>
            <Input
              id="decision-temperature"
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={node.data.temperature}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateNodeData(node.id, (current) => ({
                  ...(current as DecisionNode['data']),
                  temperature: Number.isFinite(value) ? value : 0.2
                }));
              }}
            />
          </div>
        ) : null}
        <div className={isTemperatureSupported ? 'space-y-1' : 'col-span-2 space-y-1'}>
          <Label htmlFor="decision-max-tokens">Макс. токенов</Label>
          <Input
            id="decision-max-tokens"
            type="number"
            min={1}
            max={4096}
            value={node.data.maxTokens}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              updateNodeData(node.id, (current) => ({
                ...(current as DecisionNode['data']),
                maxTokens: Number.isFinite(value) ? value : 24
              }));
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={node.data.requireAllInputs}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.checked;
              updateNodeData(node.id, (current) => ({
                ...(current as DecisionNode['data']),
                requireAllInputs: value
              }));
            }}
          />
          Требовать все входы
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={node.data.showIntermediateMeta}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.checked;
              updateNodeData(node.id, (current) => ({
                ...(current as DecisionNode['data']),
                showIntermediateMeta: value
              }));
            }}
          />
          Показывать метаданные ответа
        </label>
      </div>

      <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        Маршрутизация выхода: если первый токен ответа модели «да/yes», то выход ДА; если «нет/no», то выход НЕТ; иначе выход
        ДРУГОЕ.
      </div>
    </div>
  );
};

const CounterNodeInspector = ({ node, disabled }: { node: CounterNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="counter-title">Название</Label>
        <Input
          id="counter-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as CounterNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="counter-passes">Количество проходов</Label>
        <Input
          id="counter-passes"
          type="number"
          min={1}
          step={1}
          value={node.data.passes}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            const nextValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
            updateNodeData(node.id, (current) => ({
              ...(current as CounterNode['data']),
              passes: nextValue
            }));
          }}
        />
      </div>

      <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        Каждый вход уменьшает счётчик на 1 и передаёт тот же текст дальше. Пока счётчик больше 0, используется промежуточный выход.
        Когда счётчик дошёл до 0, используется финальный выход.
      </div>
    </div>
  );
};

const MergeNodeInspector = ({ node, disabled }: { node: MergeNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="merge-title">Название</Label>
        <Input
          id="merge-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as MergeNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label>Режим объединения</Label>
        <Select
          value={node.data.mode}
          onValueChange={(value) => {
            updateNodeData(node.id, (current) => ({
              ...(current as MergeNode['data']),
              mode: value as MergeNode['data']['mode']
            }));
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain_join">Обычное объединение</SelectItem>
            <SelectItem value="join_with_labels">С метками источников</SelectItem>
            <SelectItem value="custom_template">Пользовательский шаблон</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={node.data.requireAllInputs}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.checked;
            updateNodeData(node.id, (current) => ({
              ...(current as MergeNode['data']),
              requireAllInputs: value
            }));
          }}
        />
        Дожидаться всех входов
      </label>

      <div className="space-y-1">
        <Label htmlFor="separator">Разделитель</Label>
        <Input
          id="separator"
          value={node.data.separator}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as MergeNode['data']),
              separator: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="template">Шаблон</Label>
        <Textarea
          id="template"
          rows={5}
          value={node.data.template}
          disabled={disabled || node.data.mode !== 'custom_template'}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as MergeNode['data']),
              template: value
            }));
          }}
        />
        <p className="text-xs text-muted-foreground">
          Используйте плейсхолдеры: {'{{count}}'}, {'{{input-name-1}}'}, {'{{input-value-1}}'}, {'{{input-name-2}}'},{' '}
          {'{{input-value-2}}'} и т.д.
        </p>
      </div>
    </div>
  );
};

const NoteNodeInspector = ({ node, disabled }: { node: NoteNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="note-title">Название</Label>
        <Input
          id="note-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as NoteNode['data']),
              title: value
            }));
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="note-content">Содержимое</Label>
        <Textarea
          id="note-content"
          rows={7}
          value={node.data.content}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as NoteNode['data']),
              content: value
            }));
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Блоки NOTE сериализуются, но пропускаются движком выполнения.</p>
    </div>
  );
};

const OutputNodeInspector = ({ node, disabled }: { node: OutputNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const outputValue = useRunStore((state) => state.nodeOutputByNodeId[node.id] ?? '');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="output-title">Название</Label>
        <Input
          id="output-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as OutputNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="output-value">Текущее значение</Label>
        <Textarea
          id="output-value"
          rows={7}
          value={outputValue}
          readOnly
          disabled
          placeholder="После запуска здесь появится итоговый результат."
        />
        <p className="text-xs text-muted-foreground">Блок ВЫВОД копирует входящее сообщение и может передавать его дальше.</p>
      </div>
    </div>
  );
};

const TelegramInputNodeInspector = ({ node, disabled }: { node: TelegramInputNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const telegramBots = useSettingsStore((state) => state.telegramBots);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="telegram-input-title">Название</Label>
        <Input
          id="telegram-input-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as TelegramInputNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label>Бот Telegram</Label>
        <Select
          value={node.data.botId || '__none__'}
          onValueChange={(value) => {
            updateNodeData(node.id, (current) => ({
              ...(current as TelegramInputNode['data']),
              botId: value === '__none__' ? '' : value
            }));
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите Telegram-бота" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Не выбран</SelectItem>
            {telegramBots.map((bot) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Когда в выбранного бота приходит сообщение, этот блок запускает схему и передаёт текст на свой выход.
      </p>
    </div>
  );
};

const TelegramOutputNodeInspector = ({ node, disabled }: { node: TelegramOutputNode; disabled: boolean }): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const telegramBots = useSettingsStore((state) => state.telegramBots);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="telegram-output-title">Название</Label>
        <Input
          id="telegram-output-title"
          value={node.data.title}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            updateNodeData(node.id, (current) => ({
              ...(current as TelegramOutputNode['data']),
              title: value
            }));
          }}
        />
      </div>

      <div className="space-y-1">
        <Label>Бот Telegram</Label>
        <Select
          value={node.data.botId || '__none__'}
          onValueChange={(value) => {
            updateNodeData(node.id, (current) => ({
              ...(current as TelegramOutputNode['data']),
              botId: value === '__none__' ? '' : value
            }));
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите Telegram-бота" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Не выбран</SelectItem>
            {telegramBots.map((bot) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Этот блок отправляет входящий текст в чат Telegram, из которого был запущен текущий запуск.
      </p>
    </div>
  );
};

export const InspectorPanel = (): JSX.Element => {
  const nodes = useEditorStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const locked = useEditorStore((state) => state.locked);
  const removeNode = useEditorStore((state) => state.removeNode);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  if (!selectedNode) {
    return (
      <SectionPanel title="Инспектор" className="h-full">
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Выберите блок на canvas, чтобы редактировать его свойства.
        </div>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel
      title="Инспектор"
      className="h-full"
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={locked}
          onClick={() => {
            removeNode(selectedNode.id);
          }}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Удалить
        </Button>
      }
    >
      {locked ? (
        <div className="mb-3 rounded-md border border-amber-500/35 bg-amber-500/12 px-3 py-2 text-xs text-amber-100">
          Редактирование заблокировано во время выполнения.
        </div>
      ) : null}

      {selectedNode.type === NodeType.START ? <StartNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.TEXT ? <TextNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.TELEGRAM_INPUT ? <TelegramInputNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.MODEL ? <ModelNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.DECISION ? <DecisionNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.COUNTER ? <CounterNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.MERGE ? <MergeNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.OUTPUT ? <OutputNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.TELEGRAM_OUTPUT ? <TelegramOutputNodeInspector node={selectedNode} disabled={locked} /> : null}
      {selectedNode.type === NodeType.NOTE ? <NoteNodeInspector node={selectedNode} disabled={locked} /> : null}

      <div className="pt-4 text-left text-[10px] text-muted-foreground">v. {APP_VERSION}</div>
    </SectionPanel>
  );
};

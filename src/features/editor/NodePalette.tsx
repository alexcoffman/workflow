import { useState, type JSX } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Download, FileText, GitBranch, GitMerge, Hash, MessageSquare, Plus, Send, StickyNote, Webhook } from 'lucide-react';

import { SectionPanel } from '../../components/layout/section-panel';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';
import { NodeType } from '../../domain/node-types';
import { useEditorStore } from '../../stores/editor-store';

interface PaletteItem {
  type: NodeType;
  label: string;
  Icon: LucideIcon;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: NodeType.TEXT, label: 'Текст', Icon: FileText },
  { type: NodeType.START, label: 'Старт', Icon: MessageSquare },
  { type: NodeType.TELEGRAM_INPUT, label: 'Вход из Telegram', Icon: Webhook },
  { type: NodeType.MODEL, label: 'Модель', Icon: MessageSquare },
  { type: NodeType.DECISION, label: 'Решение (Да/Нет)', Icon: GitBranch },
  { type: NodeType.COUNTER, label: 'Счётчик', Icon: Hash },
  { type: NodeType.MERGE, label: 'Обьединить', Icon: GitMerge },
  { type: NodeType.OUTPUT, label: 'Вывод', Icon: Download },
  { type: NodeType.TELEGRAM_OUTPUT, label: 'Выход в Telegram', Icon: Send },
  { type: NodeType.NOTE, label: 'Заметка', Icon: StickyNote }
];

export const NodePalette = (): JSX.Element => {
  const [selectedType, setSelectedType] = useState('');

  const locked = useEditorStore((state) => state.locked);
  const nodes = useEditorStore((state) => state.nodes);
  const addNode = useEditorStore((state) => state.addNode);
  const selectNode = useEditorStore((state) => state.selectNode);
  const clearSchema = useEditorStore((state) => state.clearSchema);
  const { toast } = useToast();

  return (
    <SectionPanel title="Блоки" className="h-full">
      <p className="mb-3 text-xs text-muted-foreground">Нажмите «+ Добавить блок» и выберите тип блока из выпадающего списка.</p>

      <Select
        value={selectedType}
        disabled={locked}
        onValueChange={(value) => {
          const selectedItem = PALETTE_ITEMS.find((item) => item.type === value);
          if (!selectedItem) {
            setSelectedType('');
            return;
          }

          const nextIndex = nodes.length;
          const nodeId = addNode(selectedItem.type, {
            x: 120 + (nextIndex % 5) * 44,
            y: 120 + Math.floor(nextIndex / 5) * 38
          });

          if (!nodeId) {
            toast({
              title: 'Не удалось создать блок',
              description: 'Достигнут лимит блоков или редактор сейчас заблокирован.',
              variant: 'error'
            });
            setSelectedType('');
            return;
          }

          selectNode(nodeId);
          toast({
            title: 'Блок добавлен',
            description: `Добавлен блок: ${selectedItem.label}.`,
            variant: 'success'
          });
          setSelectedType('');
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-lg border-border bg-secondary/45 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <SelectValue placeholder="+ Добавить блок" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {PALETTE_ITEMS.map((item) => (
            <SelectItem key={item.type} value={item.type}>
              <span className="inline-flex items-center gap-2">
                <item.Icon className="h-4 w-4" />
                {item.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <Button
          variant="outline"
          className="w-full"
          disabled={locked}
          onClick={() => {
            clearSchema();
            toast({ title: 'Схема очищена', variant: 'default' });
          }}
        >
          Очистить схему
        </Button>
        <p className="text-xs text-muted-foreground">Блоки NOTE сохраняются в схеме, но игнорируются движком выполнения.</p>
      </div>
    </SectionPanel>
  );
};



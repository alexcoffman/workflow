import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { useToast } from '../../components/ui/use-toast';
import { parseAndNormalizeSchema } from '../../lib/schema';
import { readSavedSchemas, removeSavedSchema, type SavedSchemaRecord, writeSchemaDraft } from '../../lib/storage';
import { useEditorStore } from '../../stores/editor-store';
import { useUiStore } from '../../stores/ui-store';

import { listDemoSchemas, loadDemoSchema } from '../demo-schemas/demo-loader';

type LoadableSchemaItem =
  | {
      id: string;
      source: 'saved';
      title: string;
      description: string;
      savedAt: number;
      record: SavedSchemaRecord;
    }
  | {
      id: string;
      source: 'demo';
      title: string;
      description: string;
      savedAt: null;
      demoId: string;
    };

const formatSavedAt = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const buildLoadableItems = (): LoadableSchemaItem[] => {
  const savedItems: LoadableSchemaItem[] = readSavedSchemas().map((record) => ({
    id: `saved:${record.id}`,
    source: 'saved',
    title: record.name,
    description: `Сохранено: ${formatSavedAt(record.savedAt)}`,
    savedAt: record.savedAt,
    record
  }));

  const demoItems: LoadableSchemaItem[] = listDemoSchemas().map((demo) => ({
    id: `demo:${demo.id}`,
    source: 'demo',
    title: demo.title,
    description: demo.description,
    savedAt: null,
    demoId: demo.id
  }));

  return [...savedItems, ...demoItems];
};

export const LoadSchemaDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isLoadSchemaDialogOpen);
  const setOpen = useUiStore((state) => state.setLoadSchemaDialogOpen);

  const locked = useEditorStore((state) => state.locked);
  const loadSchema = useEditorStore((state) => state.loadSchema);

  const [items, setItems] = useState<LoadableSchemaItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextItems = buildLoadableItems();
    setItems(nextItems);
    setSelectedId((current) => {
      if (current && nextItems.some((item) => item.id === current)) {
        return current;
      }
      return nextItems[0]?.id ?? '';
    });
  }, [open]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  const deleteItem = (item: LoadableSchemaItem): void => {
    if (item.source === 'saved') {
      removeSavedSchema(item.record.id);
    }

    const nextItems = buildLoadableItems().filter((next) => next.id !== item.id || item.source === 'saved');
    setItems(nextItems);
    setSelectedId((current) => {
      if (current === item.id) {
        return nextItems[0]?.id ?? '';
      }
      if (nextItems.some((next) => next.id === current)) {
        return current;
      }
      return nextItems[0]?.id ?? '';
    });

    toast({
      title: 'Схема удалена',
      description:
        item.source === 'saved'
          ? `Удалена схема: ${item.title}.`
          : `Схема «${item.title}» удалена из текущего списка.`,
      variant: 'default'
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузить схему</DialogTitle>
          <DialogDescription>
            Выберите сохраненную или демо-схему из списка и нажмите «Открыть».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Список схем пуст.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {items.map((item) => {
                const active = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    className={[
                      'flex items-start gap-2 rounded-md border px-2 py-2 transition',
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-background/80 hover:bg-secondary/45'
                    ].join(' ')}
                  >
                    <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                        <span
                          className={[
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                            item.source === 'saved' ? 'bg-sky-500/22 text-sky-100' : 'bg-emerald-500/22 text-emerald-100'
                          ].join(' ')}
                        >
                          {item.source === 'saved' ? 'Сохраненная' : 'Демо'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-rose-300 hover:bg-rose-500/20 hover:text-rose-100"
                      disabled={locked}
                      title={item.source === 'saved' ? 'Удалить схему' : 'Убрать демо-схему из списка'}
                      aria-label={item.source === 'saved' ? 'Удалить схему' : 'Убрать демо-схему из списка'}
                      onClick={() => {
                        deleteItem(item);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={locked || !selectedItem}
              onClick={() => {
                if (!selectedItem) {
                  toast({ title: 'Схема не выбрана', variant: 'error' });
                  return;
                }

                if (selectedItem.source === 'saved') {
                  const parsed = parseAndNormalizeSchema(selectedItem.record.schemaJson);
                  if (!parsed.schema) {
                    toast({
                      title: 'Ошибка загрузки',
                      description: parsed.issues.map((issue) => issue.message).join(' | '),
                      variant: 'error'
                    });
                    return;
                  }

                  loadSchema(parsed.schema);
                  writeSchemaDraft(parsed.schema);
                } else {
                  const result = loadDemoSchema(selectedItem.demoId);
                  if (!result.schema) {
                    toast({
                      title: 'Ошибка загрузки',
                      description: result.issues.map((issue) => issue.message).join(' | '),
                      variant: 'error'
                    });
                    return;
                  }

                  loadSchema(result.schema);
                  writeSchemaDraft(result.schema);
                }

                toast({
                  title: 'Схема открыта',
                  description: `Загружена схема: ${selectedItem.title}.`,
                  variant: 'success'
                });
                setOpen(false);
              }}
            >
              Открыть
            </Button>

            <Button variant="outline" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

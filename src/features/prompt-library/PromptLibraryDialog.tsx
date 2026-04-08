import { useEffect, useMemo, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/ui/use-toast';
import {
  createPromptLibraryRecord,
  readPromptLibrary,
  removePromptLibraryRecord,
  type PromptLibraryRecord
} from '../../lib/storage';
import { useUiStore } from '../../stores/ui-store';

const UI_TEXT = {
  title: '\u0411\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430 \u043f\u0440\u043e\u043c\u043f\u0442\u043e\u0432',
  description:
    '\u0425\u0440\u0430\u043d\u0438\u0442\u0435 \u0437\u0430\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u043c\u043f\u0442\u044b: \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u043d\u043e\u0432\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438 \u0438 \u0443\u0434\u0430\u043b\u044f\u0439\u0442\u0435 \u043d\u0435\u043d\u0443\u0436\u043d\u044b\u0435.',
  list: '\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u0440\u043e\u043c\u043f\u0442\u043e\u0432',
  empty: '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u043f\u0440\u043e\u043c\u043f\u0442\u043e\u0432.',
  updatedAt: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e',
  create: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u043c\u043f\u0442',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  promptText: '\u0422\u0435\u043a\u0441\u0442 \u043f\u0440\u043e\u043c\u043f\u0442\u0430',
  namePlaceholder: '\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440, \u0410\u043d\u0430\u043b\u0438\u0437 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439',
  textPlaceholder: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043a\u0441\u0442 \u043f\u0440\u043e\u043c\u043f\u0442\u0430...',
  add: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0443',
  clear: '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043f\u043e\u043b\u044f',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  deleted: '\u041f\u0440\u043e\u043c\u043f\u0442 \u0443\u0434\u0430\u043b\u0451\u043d',
  saved: '\u041f\u0440\u043e\u043c\u043f\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d',
  copied: '\u041f\u0440\u043e\u043c\u043f\u0442 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d',
  copyLabel: '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u043e\u043c\u043f\u0442',
  copyErrorTitle: '\u041e\u0448\u0438\u0431\u043a\u0430 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f',
  copyErrorFallback:
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043a\u0441\u0442 \u043f\u0440\u043e\u043c\u043f\u0442\u0430.',
  saveErrorTitle: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f',
  saveErrorFallback: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043f\u0442.'
} as const;

const formatUpdatedAt = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const fallbackCopyText = (value: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
};

export const PromptLibraryDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isPromptLibraryDialogOpen);
  const setOpen = useUiStore((state) => state.setPromptLibraryDialogOpen);

  const [records, setRecords] = useState<PromptLibraryRecord[]>([]);
  const [name, setName] = useState('');
  const [promptText, setPromptText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }
    setRecords(readPromptLibrary());
  }, [open]);

  const hasDraft = useMemo(() => name.trim().length > 0 || promptText.trim().length > 0, [name, promptText]);

  const copyPromptText = async (value: string): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const copied = fallbackCopyText(value);
        if (!copied) {
          throw new Error(UI_TEXT.copyErrorFallback);
        }
      }

      toast({ title: UI_TEXT.copied, variant: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : UI_TEXT.copyErrorFallback;
      toast({ title: UI_TEXT.copyErrorTitle, description: message, variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{UI_TEXT.title}</DialogTitle>
          <DialogDescription>{UI_TEXT.description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">
              {UI_TEXT.list} ({records.length})
            </div>
            {records.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
                {UI_TEXT.empty}
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {records.map((record) => (
                  <div key={record.id} className="rounded-md border border-border bg-background/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{record.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {UI_TEXT.updatedAt}: {formatUpdatedAt(record.updatedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-sky-200 hover:bg-sky-500/20 hover:text-sky-100"
                          title={UI_TEXT.copyLabel}
                          aria-label={UI_TEXT.copyLabel}
                          onClick={() => {
                            void copyPromptText(record.promptText);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-rose-300 hover:bg-rose-500/20 hover:text-rose-100"
                          onClick={() => {
                            removePromptLibraryRecord(record.id);
                            setRecords(readPromptLibrary());
                            toast({ title: UI_TEXT.deleted, variant: 'default' });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 line-clamp-5 whitespace-pre-wrap text-xs text-muted-foreground">{record.promptText}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
            <div className="text-sm font-medium text-foreground">{UI_TEXT.create}</div>
            <div className="space-y-1">
              <Label htmlFor="prompt-library-name">{UI_TEXT.name}</Label>
              <Input
                id="prompt-library-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={UI_TEXT.namePlaceholder}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prompt-library-text">{UI_TEXT.promptText}</Label>
              <Textarea
                id="prompt-library-text"
                rows={12}
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder={UI_TEXT.textPlaceholder}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  try {
                    createPromptLibraryRecord(name, promptText);
                    setRecords(readPromptLibrary());
                    setName('');
                    setPromptText('');
                    toast({ title: UI_TEXT.saved, variant: 'success' });
                  } catch (error) {
                    const message = error instanceof Error ? error.message : UI_TEXT.saveErrorFallback;
                    toast({ title: UI_TEXT.saveErrorTitle, description: message, variant: 'error' });
                  }
                }}
              >
                {UI_TEXT.add}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!hasDraft}
                onClick={() => {
                  setName('');
                  setPromptText('');
                }}
              >
                {UI_TEXT.clear}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {UI_TEXT.close}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

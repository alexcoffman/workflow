import { useState } from 'react';

import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/ui/use-toast';
import { parseAndNormalizeSchema } from '../../lib/schema';
import { useEditorStore } from '../../stores/editor-store';
import { useUiStore } from '../../stores/ui-store';

const placeholderText = '{\n  "schemaVersion": "1.0.0",\n  "nodes": [],\n  "edges": [],\n  "metadata": {}\n}';

export const ImportJsonDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isImportDialogOpen);
  const setOpen = useUiStore((state) => state.setImportDialogOpen);
  const loadSchema = useEditorStore((state) => state.loadSchema);
  const [value, setValue] = useState('');
  const { toast } = useToast();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setValue('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Импорт схемы из JSON</DialogTitle>
          <DialogDescription>Вставьте JSON, затем выполните проверку, нормализацию и загрузку.</DialogDescription>
        </DialogHeader>

        <Textarea
          rows={16}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono text-xs"
          placeholder={placeholderText}
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              const parsed = parseAndNormalizeSchema(value);
              if (!parsed.schema) {
                toast({
                  title: 'Некорректный импорт',
                  description: parsed.issues.map((issue) => `[${issue.code}] ${issue.message}`).join(' | '),
                  variant: 'error'
                });
                return;
              }

              loadSchema(parsed.schema);
              toast({ title: 'Импорт выполнен', variant: 'success' });
              setOpen(false);
            }}
          >
            Проверить и загрузить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from 'react';

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
import { useToast } from '../../components/ui/use-toast';
import { saveNamedSchema, writeSchemaDraft } from '../../lib/storage';
import { useEditorStore } from '../../stores/editor-store';
import { useUiStore } from '../../stores/ui-store';

export const SaveSchemaDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isSaveSchemaDialogOpen);
  const setOpen = useUiStore((state) => state.setSaveSchemaDialogOpen);

  const locked = useEditorStore((state) => state.locked);
  const toSchema = useEditorStore((state) => state.toSchema);
  const metadataName = useEditorStore((state) => state.metadata.name);
  const updateMetadata = useEditorStore((state) => state.updateMetadata);

  const [name, setName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(metadataName.trim());
  }, [open, metadataName]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сохранить схему</DialogTitle>
          <DialogDescription>
            Укажите название. Если схема с таким именем уже существует, она будет перезаписана.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="save-schema-name">Название схемы</Label>
            <Input
              id="save-schema-name"
              value={name}
              disabled={locked}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Диалог с ветвлением"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-400 hover:to-blue-400"
              disabled={locked}
              onClick={() => {
                const trimmedName = name.trim();
                if (!trimmedName) {
                  toast({
                    title: 'Название не задано',
                    description: 'Введите название схемы перед сохранением.',
                    variant: 'error'
                  });
                  return;
                }

                const currentSchema = toSchema();
                const schemaToSave = {
                  ...currentSchema,
                  metadata: {
                    ...currentSchema.metadata,
                    name: trimmedName,
                    updatedAt: Date.now()
                  }
                };

                saveNamedSchema(trimmedName, schemaToSave);
                writeSchemaDraft(schemaToSave);
                updateMetadata({ name: trimmedName });
                toast({ title: 'Схема сохранена', variant: 'success' });
                setOpen(false);
              }}
            >
              Сохранить
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

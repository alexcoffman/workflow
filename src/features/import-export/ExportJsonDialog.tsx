import { useMemo } from 'react';

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
import { serializeSchema } from '../../lib/schema';
import { useEditorStore } from '../../stores/editor-store';
import { useUiStore } from '../../stores/ui-store';

export const ExportJsonDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isExportDialogOpen);
  const setOpen = useUiStore((state) => state.setExportDialogOpen);
  const toSchema = useEditorStore((state) => state.toSchema);
  const { toast } = useToast();

  const payload = useMemo(() => serializeSchema(toSchema()), [toSchema]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Экспорт схемы в JSON</DialogTitle>
          <DialogDescription>Скопируйте сериализованную схему workflow. API-ключ в экспорт не включается.</DialogDescription>
        </DialogHeader>

        <Textarea readOnly value={payload} rows={16} className="font-mono text-xs" />

        <div className="flex justify-end">
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(payload);
              toast({ title: 'JSON скопирован в буфер обмена', variant: 'success' });
            }}
          >
            Скопировать JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

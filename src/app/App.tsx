import { useEffect } from 'react';

import { Toaster } from '../components/ui/toaster';
import { ApiSettingsDialog } from '../features/api-settings/ApiSettingsDialog';
import { FlowCanvas } from '../features/editor/FlowCanvas';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { RunLogPanel } from '../features/logs/RunLogPanel';
import { PromptLibraryDialog } from '../features/prompt-library/PromptLibraryDialog';
import { ExportJsonDialog } from '../features/import-export/ExportJsonDialog';
import { ImportJsonDialog } from '../features/import-export/ImportJsonDialog';
import { LoadSchemaDialog } from '../features/toolbar/LoadSchemaDialog';
import { SaveSchemaDialog } from '../features/toolbar/SaveSchemaDialog';
import { TopToolbar } from '../features/toolbar/TopToolbar';
import { parseAndNormalizeSchema } from '../lib/schema';
import { readSchemaDraft } from '../lib/storage';
import { useEditorStore } from '../stores/editor-store';
import { useToastStore } from '../stores/toast-store';

import { useSchemaAutosave } from './use-schema-autosave';
import { useTelegramBridge } from './use-telegram-bridge';

export const App = (): JSX.Element => {
  const loadSchema = useEditorStore((state) => state.loadSchema);
  const pushToast = useToastStore((state) => state.pushToast);

  useSchemaAutosave();
  useTelegramBridge();

  useEffect(() => {
    const raw = readSchemaDraft();
    if (!raw) {
      return;
    }

    const parsed = parseAndNormalizeSchema(raw);
    if (!parsed.schema) {
      pushToast({
        title: 'Автосохранение повреждено',
        description: 'Не удалось загрузить сохраненную схему. Запустите работу с пустого холста.',
        variant: 'error'
      });
      return;
    }

    loadSchema(parsed.schema);
  }, [loadSchema, pushToast]);

  return (
    <div className="h-full w-full p-3">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-3">
        <TopToolbar />

        <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(560px,1fr)_460px] gap-3">
          <div className="min-h-0 overflow-auto">
            <InspectorPanel />
          </div>

          <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-background/95 shadow-panel">
            <FlowCanvas />
          </div>

          <div className="min-h-0 overflow-hidden">
            <RunLogPanel />
          </div>
        </div>
      </div>

      <ApiSettingsDialog />
      <ImportJsonDialog />
      <ExportJsonDialog />
      <SaveSchemaDialog />
      <LoadSchemaDialog />
      <PromptLibraryDialog />
      <Toaster />
    </div>
  );
};

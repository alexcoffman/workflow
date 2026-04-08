import { useEffect } from 'react';

import { Toaster } from '../components/ui/toaster';
import { ApiSettingsDialog } from '../features/api-settings/ApiSettingsDialog';
import { AuthScreen } from '../features/auth/AuthScreen';
import { UserSettingsDialog } from '../features/auth/UserSettingsDialog';
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
import { useAuthStore } from '../stores/auth-store';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { useToastStore } from '../stores/toast-store';

import { useSchemaAutosave } from './use-schema-autosave';
import { useTelegramBridge } from './use-telegram-bridge';

const AuthenticatedApp = (): JSX.Element => {
  const loadSchema = useEditorStore((state) => state.loadSchema);
  const pushToast = useToastStore((state) => state.pushToast);
  const session = useAuthStore((state) => state.session);
  const hydrateSettings = useSettingsStore((state) => state.hydrateFromServer);

  useSchemaAutosave();
  useTelegramBridge();

  useEffect(() => {
    if (!session) {
      return;
    }

    void hydrateSettings(session.token);
  }, [hydrateSettings, session]);

  useEffect(() => {
    const raw = readSchemaDraft();
    if (!raw) {
      useEditorStore.getState().clearSchema();
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
  }, [loadSchema, pushToast, session?.userId]);

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
      <UserSettingsDialog />
      <Toaster />
    </div>
  );
};

export const App = (): JSX.Element => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!initialized) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Загрузка...</div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen />
        <Toaster />
      </>
    );
  }

  return <AuthenticatedApp />;
};

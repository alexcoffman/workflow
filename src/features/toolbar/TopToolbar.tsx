import { useState } from 'react';
import {
  BookText,
  ChevronDown,
  Download,
  KeyRound,
  LogOut,
  Play,
  Plus,
  Save,
  Settings,
  Square,
  Trash2,
  Upload
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';
import { NodeType } from '../../domain/node-types';
import { useAuthStore } from '../../stores/auth-store';
import { useEditorStore } from '../../stores/editor-store';
import { useRunStore } from '../../stores/run-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';

interface ToolbarNodeOption {
  type: NodeType;
  label: string;
}

const TOOLBAR_NODE_OPTIONS: ToolbarNodeOption[] = [
  { type: NodeType.TEXT, label: 'Текст' },
  { type: NodeType.START, label: 'Старт' },
  { type: NodeType.TELEGRAM_INPUT, label: 'Вход из Telegram' },
  { type: NodeType.MODEL, label: 'Модель' },
  { type: NodeType.DECISION, label: 'Решение (Да/Нет)' },
  { type: NodeType.COUNTER, label: 'Счётчик' },
  { type: NodeType.MERGE, label: 'Обьединить' },
  { type: NodeType.OUTPUT, label: 'Вывод' },
  { type: NodeType.TELEGRAM_OUTPUT, label: 'Выход в Telegram' },
  { type: NodeType.NOTE, label: 'Заметка' }
];

const TOOLBAR_NEUTRAL_ACTION_CLASS =
  'border border-border bg-secondary/35 text-foreground hover:bg-secondary/75';

const TOOLBAR_DANGER_ACTION_CLASS =
  'border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20';

export const TopToolbar = (): JSX.Element => {
  const [selectedNodeType, setSelectedNodeType] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const metadata = useEditorStore((state) => state.metadata);
  const updateMetadata = useEditorStore((state) => state.updateMetadata);
  const addNodeAtCanvasCenter = useEditorStore((state) => state.addNodeAtCanvasCenter);
  const addNode = useEditorStore((state) => state.addNode);
  const clearSchema = useEditorStore((state) => state.clearSchema);
  const selectNode = useEditorStore((state) => state.selectNode);
  const locked = useEditorStore((state) => state.locked);

  const runStatus = useRunStore((state) => state.runStatus);
  const validationResult = useRunStore((state) => state.validationResult);
  const startRun = useRunStore((state) => state.startRun);
  const stopRun = useRunStore((state) => state.stopRun);

  const setApiSettingsOpen = useUiStore((state) => state.setApiSettingsOpen);
  const setImportDialogOpen = useUiStore((state) => state.setImportDialogOpen);
  const setExportDialogOpen = useUiStore((state) => state.setExportDialogOpen);
  const setSaveSchemaDialogOpen = useUiStore((state) => state.setSaveSchemaDialogOpen);
  const setLoadSchemaDialogOpen = useUiStore((state) => state.setLoadSchemaDialogOpen);
  const setPromptLibraryDialogOpen = useUiStore((state) => state.setPromptLibraryDialogOpen);
  const setUserSettingsDialogOpen = useUiStore((state) => state.setUserSettingsDialogOpen);

  const userSession = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const resetSettings = useSettingsStore((state) => state.resetState);

  const { toast } = useToast();

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow-panel backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_NEUTRAL_ACTION_CLASS}
            disabled={locked}
            onClick={() => {
              setSaveSchemaDialogOpen(true);
            }}
          >
            <Save className="mr-2 h-4 w-4" /> Сохранить
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_NEUTRAL_ACTION_CLASS}
            disabled={locked}
            onClick={() => {
              setLoadSchemaDialogOpen(true);
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Загрузить
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_NEUTRAL_ACTION_CLASS}
            disabled={locked}
            onClick={() => setExportDialogOpen(true)}
            title="Экспорт JSON"
            aria-label="Экспорт JSON"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_NEUTRAL_ACTION_CLASS}
            disabled={locked}
            onClick={() => setImportDialogOpen(true)}
            title="Импорт JSON"
            aria-label="Импорт JSON"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_NEUTRAL_ACTION_CLASS}
            onClick={() => setApiSettingsOpen(true)}
          >
            <KeyRound className="mr-2 h-4 w-4" /> Настройки API
          </Button>

          <Select
            value={selectedNodeType}
            disabled={locked}
            onValueChange={(value) => {
              const selectedOption = TOOLBAR_NODE_OPTIONS.find((item) => item.type === value);
              if (!selectedOption) {
                setSelectedNodeType('');
                return;
              }

              const nodeId = addNodeAtCanvasCenter
                ? addNodeAtCanvasCenter(selectedOption.type)
                : addNode(selectedOption.type);

              if (!nodeId) {
                toast({
                  title: 'Не удалось создать блок',
                  description: 'Достигнут лимит блоков или редактор сейчас заблокирован.',
                  variant: 'error'
                });
                setSelectedNodeType('');
                return;
              }

              selectNode(nodeId);
              toast({
                title: 'Блок добавлен',
                description: `Добавлен блок: ${selectedOption.label}.`,
                variant: 'success'
              });
              setSelectedNodeType('');
            }}
          >
            <SelectTrigger className="h-10 w-[170px] min-w-[170px] max-w-[170px] rounded-lg border-border bg-secondary/45 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <SelectValue placeholder="Добавить блок" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {TOOLBAR_NODE_OPTIONS.map((item) => (
                <SelectItem key={item.type} value={item.type}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_NEUTRAL_ACTION_CLASS}
            onClick={() => setPromptLibraryDialogOpen(true)}
          >
            <BookText className="mr-2 h-4 w-4" /> Библиотека промптов
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={TOOLBAR_DANGER_ACTION_CLASS}
            disabled={locked}
            onClick={() => {
              clearSchema();
              toast({ title: 'Схема очищена', variant: 'default' });
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Очистить схему
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400"
            onClick={async () => {
              const started = await startRun();
              if (!started) {
                toast({
                  title: 'Запуск заблокирован',
                  description: 'Исправьте ошибки валидации перед выполнением.',
                  variant: 'error'
                });
                return;
              }

              toast({
                title: 'Запуск начат',
                description: 'Трассировка выполнения отображается в правой панели.',
                variant: 'success'
              });
            }}
            disabled={runStatus === 'running'}
          >
            <Play className="mr-2 h-4 w-4" /> Запустить
          </Button>

          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-2 py-1">
            <Label htmlFor="topbar-max-iterations" className="text-xs text-muted-foreground">
              Макс. итераций
            </Label>
            <Input
              id="topbar-max-iterations"
              type="number"
              min={1}
              step={1}
              value={metadata.maxIterations ?? ''}
              disabled={locked}
              className="h-8 w-24"
              onChange={(event) => {
                const raw = event.target.value;
                if (!raw) {
                  updateMetadata({ maxIterations: null });
                  return;
                }

                const parsed = Number(raw);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  updateMetadata({ maxIterations: null });
                  return;
                }

                updateMetadata({ maxIterations: Math.floor(parsed) });
              }}
            />
          </div>

          <Button
            variant="secondary"
            className="bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/30 hover:from-rose-400 hover:to-red-400"
            onClick={() => {
              stopRun();
              toast({ title: 'Выполнение остановлено', description: 'Активный запуск прерван.', variant: 'default' });
            }}
            disabled={runStatus !== 'running'}
          >
            <Square className="mr-2 h-4 w-4" /> Остановить
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              className={TOOLBAR_NEUTRAL_ACTION_CLASS}
              onClick={() => setIsUserMenuOpen((current) => !current)}
            >
              {userSession?.login ?? 'Пользователь'} <ChevronDown className="ml-2 h-4 w-4" />
            </Button>

            {isUserMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-border bg-background p-1 shadow-panel">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/60"
                  onClick={() => {
                    setUserSettingsDialogOpen(true);
                    setIsUserMenuOpen(false);
                  }}
                >
                  <Settings className="h-4 w-4" /> Настройки
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/20"
                  onClick={() => {
                    stopRun();
                    useRunStore.getState().clearLog();
                    useEditorStore.getState().clearSchema();
                    resetSettings();
                    signOut();
                    toast({ title: 'Вы вышли из аккаунта', variant: 'default' });
                    setIsUserMenuOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" /> Выйти
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {validationResult && validationResult.errors.length > 0 ? (
        <div className="rounded-md border border-rose-500/35 bg-rose-500/12 p-3 text-sm text-rose-100">
          <p className="mb-1 font-semibold">Ошибки валидации ({validationResult.errors.length})</p>
          <ul className="space-y-1 text-xs">
            {validationResult.errors.map((issue) => (
              <li key={`${issue.code}-${issue.nodeId ?? 'none'}-${issue.edgeId ?? 'none'}`}>
                [{issue.code}] {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

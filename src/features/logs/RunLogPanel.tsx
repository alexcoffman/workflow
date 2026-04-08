import { useMemo } from 'react';
import { Download, Trash2 } from 'lucide-react';

import { SectionPanel } from '../../components/layout/section-panel';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/use-toast';
import { NodeType } from '../../domain/node-types';
import { useRunStore } from '../../stores/run-store';

import { LogEventCard } from './LogEventCard';

const statusLabel = {
  idle: 'ожидание',
  running: 'выполняется',
  paused: 'пауза',
  stopped: 'остановлен',
  error: 'ошибка'
} as const;

const exportDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const downloadTextFile = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const RunLogPanel = (): JSX.Element => {
  const runHistory = useRunStore((state) => state.runHistory);
  const logViewMode = useRunStore((state) => state.logViewMode);
  const setLogViewMode = useRunStore((state) => state.setLogViewMode);
  const runStatus = useRunStore((state) => state.runStatus);
  const clearLog = useRunStore((state) => state.clearLog);
  const { toast } = useToast();

  const groupedRuns = useMemo(() => {
    return runHistory.map((run) => {
      const byIteration = new Map<number, typeof run.events>();
      for (const event of run.events) {
        if (!byIteration.has(event.iteration)) {
          byIteration.set(event.iteration, []);
        }
        byIteration.get(event.iteration)?.push(event);
      }

      const iterations = [...byIteration.entries()].sort((a, b) => a[0] - b[0]);
      return {
        ...run,
        iterations
      };
    });
  }, [runHistory]);

  const compactEvents = useMemo(() => {
    return runHistory.flatMap((run) =>
      [...run.events]
        .sort((a, b) => {
          if (a.startedAt !== b.startedAt) {
            return a.startedAt - b.startedAt;
          }

          if (a.iteration !== b.iteration) {
            return a.iteration - b.iteration;
          }

          return a.eventId.localeCompare(b.eventId);
        })
        .filter((event) => event.outputText.trim().length > 0 && event.nodeType !== NodeType.COUNTER)
    );
  }, [runHistory]);

  const exportChatAsTxt = (): void => {
    const orderedRuns = [...runHistory].reverse();
    const modelEvents = orderedRuns
      .flatMap((run) =>
        [...run.events].sort((a, b) => {
          if (a.startedAt !== b.startedAt) {
            return a.startedAt - b.startedAt;
          }

          if (a.iteration !== b.iteration) {
            return a.iteration - b.iteration;
          }

          return a.eventId.localeCompare(b.eventId);
        })
      )
      .filter((event) => {
        const isModelNode = event.nodeType === NodeType.MODEL || event.nodeType === NodeType.DECISION;
        return isModelNode && event.status === 'completed' && event.outputText.trim().length > 0;
      });

    if (modelEvents.length === 0) {
      toast({
        title: 'Нет данных для экспорта',
        description: 'В логе пока нет завершённых ответов модели.',
        variant: 'error'
      });
      return;
    }

    const content = modelEvents
      .map((event) => {
        const modelName = event.nodeTitle.trim().length > 0 ? event.nodeTitle : 'Без названия';
        const timestamp = event.finishedAt ?? event.startedAt;
        const dateTime = exportDateTimeFormatter.format(timestamp);
        return `${modelName} (${dateTime})\n${event.outputText.trim()}`;
      })
      .join('\n\n');

    const fileName = `чат-лог-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
    downloadTextFile(fileName, content);

    toast({
      title: 'TXT экспортирован',
      description: 'Файл диалога успешно сохранён.',
      variant: 'success'
    });
  };

  return (
    <SectionPanel
      title=""
      actions={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 border border-sky-500/30 bg-sky-500/10 p-0 text-sky-200 hover:bg-sky-500/20"
              onClick={exportChatAsTxt}
              title="Экспортировать чат в TXT"
              aria-label="Экспортировать чат в TXT"
            >
              <Download className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
              onClick={() => {
                clearLog();
                toast({ title: 'Лог очищен', description: 'История запусков в памяти сброшена.' });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Очистить лог
            </Button>
          </div>

          <div className="inline-flex items-end border-b border-border">
            <button
              type="button"
              className={
                logViewMode === 'compact'
                  ? '-mb-px rounded-t-md border border-border border-b-background bg-background px-3 py-1.5 text-xs font-semibold text-foreground'
                  : '-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground'
              }
              onClick={() => setLogViewMode('compact')}
            >
              Компактно
            </button>
            <button
              type="button"
              className={
                logViewMode === 'detailed'
                  ? '-mb-px rounded-t-md border border-border border-b-background bg-background px-3 py-1.5 text-xs font-semibold text-foreground'
                  : '-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground'
              }
              onClick={() => setLogViewMode('detailed')}
            >
              Подробно
            </button>
          </div>
        </div>
      }
      className="flex h-full min-h-0 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col p-4"
    >
      {logViewMode === 'detailed' ? (
        <div className="mb-3 rounded-md border border-border bg-secondary/55 px-3 py-2 text-xs text-muted-foreground">
          Статус выполнения: <span className="font-semibold text-foreground">{statusLabel[runStatus]}</span>
        </div>
      ) : null}

      {groupedRuns.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Пока нет запусков. Соберите цепочку и нажмите «Запустить», чтобы увидеть структурированный лог.
        </div>
      ) : logViewMode === 'compact' ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {compactEvents.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              В текущем логе пока нет выходных сообщений.
            </div>
          ) : (
            compactEvents.map((event) => <LogEventCard key={event.eventId} event={event} detailed={false} />)
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          {groupedRuns.map((run) => (
            <section key={run.runId} className="space-y-2 rounded-md border border-border bg-secondary/35 p-3">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Запуск {run.runId}</p>
                  <p className="text-xs text-muted-foreground">Статус: {statusLabel[run.status]}</p>
                </div>
                <p className="text-xs text-muted-foreground">Событий: {run.events.length}</p>
              </header>

              {run.iterations.map(([iteration, events]) => (
                <div key={`${run.runId}-iter-${iteration}`} className="space-y-2 rounded-md border border-border bg-background/90 p-2">
                  <p className="text-xs font-semibold text-foreground">Итерация {iteration}</p>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <LogEventCard key={event.eventId} event={event} detailed={logViewMode === 'detailed'} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </SectionPanel>
  );
};

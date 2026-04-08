import { useState } from 'react';
import { Clock3, Copy } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/use-toast';
import { LIMITS } from '../../domain/constants';
import type { ExecutionLogEvent } from '../../domain/logs';
import { cn } from '../../lib/cn';

interface LogEventCardProps {
  event: ExecutionLogEvent;
  detailed: boolean;
}

const statusLabel: Record<ExecutionLogEvent['status'], string> = {
  queued: 'в очереди',
  started: 'запущен',
  completed: 'завершен',
  failed: 'ошибка',
  skipped: 'пропущен',
  aborted: 'прерван'
};

const statusVariant: Record<ExecutionLogEvent['status'], 'default' | 'success' | 'error' | 'outline'> = {
  queued: 'outline',
  started: 'default',
  completed: 'success',
  failed: 'error',
  skipped: 'outline',
  aborted: 'error'
};

const getPreviewText = (value: string, maxPreviewLength: number): string => {
  if (value.length <= maxPreviewLength) {
    return value;
  }

  return value.slice(0, maxPreviewLength);
};

interface ExpandableTextProps {
  label?: string;
  value: string;
  maxPreviewLength?: number;
}

const ExpandableText = ({ label, value, maxPreviewLength = LIMITS.maxRenderedPreviewLength }: ExpandableTextProps): JSX.Element | null => {
  const [expanded, setExpanded] = useState(false);

  if (!value) {
    return null;
  }

  const isLong = value.length > maxPreviewLength;
  const textToRender = expanded || !isLong ? value : getPreviewText(value, maxPreviewLength);

  return (
    <div className="space-y-1">
      {label ? <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p> : null}
      <pre className="whitespace-pre-wrap rounded-md border border-border bg-secondary/45 p-2 text-xs text-foreground">{textToRender}</pre>
      {isLong ? (
        <button
          type="button"
          className="text-xs font-medium text-sky-300 transition-colors hover:text-sky-200"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Свернуть' : 'Развернуть'}
        </button>
      ) : null}
    </div>
  );
};

export const LogEventCard = ({ event, detailed }: LogEventCardProps): JSX.Element | null => {
  const { toast } = useToast();
  const duration = event.durationMs !== null ? `${event.durationMs} ms` : '-';
  const canCopyOutput = event.outputText.trim().length > 0;

  if (!detailed) {
    if (event.outputText.trim().length === 0) {
      return null;
    }

    return (
      <article className="rounded-md border border-border bg-background/90 p-3">
        <header className="mb-2 flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{event.nodeTitle}:</p>
          {canCopyOutput ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-[11px]"
              title="Скопировать выход"
              aria-label="Скопировать выход"
              onClick={async () => {
                try {
                  if (!navigator.clipboard?.writeText) {
                    throw new Error('clipboard not available');
                  }

                  await navigator.clipboard.writeText(event.outputText);
                  toast({
                    title: 'Выход модели скопирован',
                    description: 'Скопирован только текст из поля «Выход».',
                    variant: 'success'
                  });
                } catch {
                  toast({
                    title: 'Не удалось скопировать',
                    description: 'Браузер не дал доступ к буферу обмена.',
                    variant: 'error'
                  });
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </header>

        <ExpandableText value={event.outputText} maxPreviewLength={300} />
      </article>
    );
  }

  return (
    <article
      className={cn(
        'rounded-md border border-border bg-background/90 p-3',
        event.status === 'failed' ? 'border-rose-400/45 bg-rose-500/10' : ''
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{event.nodeTitle}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {event.nodeType} - итерация {event.iteration}
            </p>
            {canCopyOutput ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[11px]"
                title="Скопировать выход"
                aria-label="Скопировать выход"
                onClick={async () => {
                  try {
                    if (!navigator.clipboard?.writeText) {
                      throw new Error('clipboard not available');
                    }

                    await navigator.clipboard.writeText(event.outputText);
                    toast({
                      title: 'Выход модели скопирован',
                      description: 'Скопирован только текст из поля «Выход».',
                      variant: 'success'
                    });
                  } catch {
                    toast({
                      title: 'Не удалось скопировать',
                      description: 'Браузер не дал доступ к буферу обмена.',
                      variant: 'error'
                    });
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[event.status]}>{statusLabel[event.status]}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3 w-3" /> {duration}
          </span>
        </div>
      </header>

      <div className="space-y-2">
        <ExpandableText label="Вход" value={event.inputText} />
        <ExpandableText label="Выход" value={event.outputText} />

        {event.modelMeta ? (
          <div className="rounded-md border border-sky-400/30 bg-sky-500/12 p-2 text-xs">
            <p className="font-medium text-sky-100">Метаданные модели</p>
            <p className="text-sky-100">Провайдер: {event.modelMeta.provider}</p>
            <p className="text-sky-100">Модель: {event.modelMeta.model}</p>
            <p className="text-sky-100">
              Токены: вход {event.modelMeta.usage.inputTokens ?? 'нет'} / выход {event.modelMeta.usage.outputTokens ?? 'нет'} / всего{' '}
              {event.modelMeta.usage.totalTokens ?? 'нет'}
            </p>
            <p className="text-sky-100">Причина завершения: {event.modelMeta.finishReason ?? 'нет'}</p>
            {event.modelMeta.rawResponsePreview ? (
              <details>
                <summary className="cursor-pointer text-sky-100">Предпросмотр сырого ответа</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded border border-sky-300/25 bg-sky-950/40 p-2 text-[11px] text-sky-50">
                  {event.modelMeta.rawResponsePreview}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {event.attemptCount > 0 ? (
          <div className="rounded-md border border-border bg-secondary/45 p-2 text-xs">
            <p className="font-medium text-foreground">Попытки: {event.attemptCount}</p>
            {event.attempts.map((attempt) => (
              <p key={`${event.eventId}-attempt-${attempt.attemptNumber}`} className="text-muted-foreground">
                #{attempt.attemptNumber}: {statusLabel[attempt.status]} ({attempt.durationMs} ms)
                {attempt.errorMessage ? ` - ${attempt.errorMessage}` : ''}
              </p>
            ))}
          </div>
        ) : null}

        {event.errorMessage ? <p className="text-xs text-destructive">{event.errorMessage}</p> : null}
      </div>
    </article>
  );
};

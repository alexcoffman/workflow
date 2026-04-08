import type { ReactNode } from 'react';

import type { NodeExecutionVisualState } from '../../../domain/run';
import { cn } from '../../../lib/cn';

interface NodeShellProps {
  title: string;
  tag: string;
  summary: string;
  executionState: NodeExecutionVisualState;
  selected: boolean;
  isActive?: boolean;
  footer?: ReactNode;
  action?: ReactNode;
}

const stateClass: Record<NodeExecutionVisualState, string> = {
  idle: 'border-border bg-background/95',
  queued: 'border-sky-300/80 bg-sky-500/18 ring-1 ring-sky-300/35',
  running:
    'border-cyan-300 bg-cyan-500/20 ring-4 ring-cyan-300/55 shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_0_30px_rgba(34,211,238,0.35)] motion-safe:animate-[pulse_1.25s_ease-in-out_infinite]',
  completed: 'border-emerald-300/90 bg-emerald-500/18 ring-2 ring-emerald-300/35',
  failed: 'border-rose-400/80 bg-rose-500/12',
  aborted: 'border-amber-400/80 bg-amber-500/14',
  skipped: 'border-slate-500/70 bg-slate-500/12'
};

export const NodeShell = ({
  title,
  tag,
  summary,
  executionState,
  selected,
  isActive = true,
  footer,
  action
}: NodeShellProps): JSX.Element => {
  const hasFooterRow = Boolean(footer) || Boolean(action);
  const hasSummary = summary.trim().length > 0;

  return (
    <div
      className={cn(
        'w-[220px] rounded-md border px-3 py-2 text-xs shadow-panel transition-all',
        stateClass[executionState],
        !isActive ? 'border-dashed border-slate-500/80 opacity-70 saturate-75' : '',
        selected ? 'ring-2 ring-primary/30' : ''
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
          {tag}
        </span>
      </div>
      {hasSummary ? <p className="line-clamp-4 whitespace-pre-wrap text-[11px] text-muted-foreground">{summary}</p> : null}
      {hasFooterRow ? (
        <div className="mt-2 border-t border-border pt-1">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">{footer}</div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

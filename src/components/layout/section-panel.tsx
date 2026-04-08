import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface SectionPanelProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const SectionPanel = ({ title, actions, children, className, bodyClassName }: SectionPanelProps): JSX.Element => {
  return (
    <section className={cn('rounded-xl border border-border bg-background/95 shadow-panel backdrop-blur-sm', className)}>
      <header className="flex items-center justify-between border-b border-border bg-secondary/25 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {actions ? <div>{actions}</div> : null}
      </header>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
};

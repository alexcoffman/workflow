import type { ComponentProps } from 'react';
import { Handle } from 'reactflow';

import { cn } from '../../../lib/cn';

type TooltipSide = 'left' | 'right';

type BaseHandleProps = ComponentProps<typeof Handle>;

interface LabeledHandleProps extends BaseHandleProps {
  tooltip: string;
  tooltipSide?: TooltipSide;
}

export const LabeledHandle = ({
  tooltip,
  tooltipSide,
  className,
  ...handleProps
}: LabeledHandleProps): JSX.Element => {
  const side = tooltipSide ?? (handleProps.type === 'target' ? 'left' : 'right');

  return (
    <Handle
      {...handleProps}
      title={tooltip}
      aria-label={tooltip}
      data-handle-tooltip={tooltip}
      data-handle-placement={side}
      className={cn('flow-handle', className)}
    />
  );
};

import { X } from 'lucide-react';
import * as ToastPrimitive from '@radix-ui/react-toast';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from './toast';
import { useToastStore } from '../../stores/toast-store';
import { cn } from '../../lib/cn';

const variantClassName = {
  default: 'border-border bg-background/95',
  success: 'border-success/35 bg-success/18',
  error: 'border-destructive/35 bg-destructive/18'
} as const;

export const Toaster = (): JSX.Element => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <ToastProvider duration={3500} swipeDirection="right">
      {toasts.map((toast) => (
        <ToastPrimitive.Root
          key={toast.id}
          open
          onOpenChange={(open) => {
            if (!open) {
              removeToast(toast.id);
            }
          }}
          asChild
        >
          <Toast className={cn(variantClassName[toast.variant])}>
            <div className="grid gap-1">
              <ToastTitle>{toast.title}</ToastTitle>
              {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
            </div>
            <ToastClose className="rounded-sm p-1 text-muted-foreground hover:bg-secondary">
              <X className="h-4 w-4" />
            </ToastClose>
          </Toast>
        </ToastPrimitive.Root>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
};

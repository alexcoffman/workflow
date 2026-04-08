import type { ToastVariant } from '../../stores/toast-store';
import { useToastStore } from '../../stores/toast-store';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export const useToast = () => {
  const pushToast = useToastStore((state) => state.pushToast);

  return {
    toast: ({ title, description, variant = 'default' }: ToastInput) => {
      pushToast({ title, description, variant });
    }
  };
};

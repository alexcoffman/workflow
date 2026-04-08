import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';
import { useAuthStore } from '../../stores/auth-store';
import { useUiStore } from '../../stores/ui-store';

export const UserSettingsDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isUserSettingsDialogOpen);
  const setOpen = useUiStore((state) => state.setUserSettingsDialogOpen);
  const changePassword = useAuthStore((state) => state.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setCurrentPassword('');
          setNextPassword('');
          setConfirmPassword('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Настройки пользователя</DialogTitle>
          <DialogDescription>Смена пароля для текущей учетной записи.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="next-password">Новый пароль</Label>
            <Input
              id="next-password"
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-next-password">Подтверждение пароля</Label>
            <Input
              id="confirm-next-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <Button
            className="w-full"
            disabled={submitting}
            onClick={async () => {
              if (nextPassword !== confirmPassword) {
                toast({ title: 'Пароли не совпадают', variant: 'error' });
                return;
              }

              setSubmitting(true);
              try {
                const result = await changePassword(currentPassword, nextPassword);
                if (!result.ok) {
                  toast({ title: 'Не удалось сменить пароль', description: result.message, variant: 'error' });
                  return;
                }

                toast({ title: 'Пароль изменен', variant: 'success' });
                setOpen(false);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Сменить пароль
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

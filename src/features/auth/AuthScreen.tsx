import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';
import { useAuthStore } from '../../stores/auth-store';

export const AuthScreen = (): JSX.Element => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const signIn = useAuthStore((state) => state.signIn);
  const register = useAuthStore((state) => state.register);
  const { toast } = useToast();

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <Card className="w-full max-w-md border-border bg-background/95 p-6 shadow-panel">
        <div className="mb-5 space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Workflow Builder</h1>
          <p className="text-sm text-muted-foreground">Войдите или создайте учетную запись (логин + пароль).</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button variant={mode === 'login' ? 'default' : 'outline'} onClick={() => setMode('login')}>
            <LogIn className="mr-2 h-4 w-4" /> Вход
          </Button>
          <Button variant={mode === 'register' ? 'default' : 'outline'} onClick={() => setMode('register')}>
            <UserPlus className="mr-2 h-4 w-4" /> Регистрация
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="auth-login">Логин</Label>
            <Input
              id="auth-login"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Введите логин"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="auth-password">Пароль</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Минимум 6 символов"
              disabled={submitting}
            />
          </div>

          {mode === 'register' ? (
            <div className="space-y-1">
              <Label htmlFor="auth-confirm-password">Подтвердите пароль</Label>
              <Input
                id="auth-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите пароль"
                disabled={submitting}
              />
            </div>
          ) : null}
        </div>

        <Button
          className="mt-5 w-full"
          disabled={submitting}
          onClick={async () => {
            if (mode === 'register' && password !== confirmPassword) {
              toast({
                title: 'Пароли не совпадают',
                description: 'Проверьте пароль и подтверждение.',
                variant: 'error'
              });
              return;
            }

            setSubmitting(true);
            try {
              const result =
                mode === 'login' ? await signIn(login.trim(), password) : await register(login.trim(), password);

              if (!result.ok) {
                toast({
                  title: mode === 'login' ? 'Ошибка входа' : 'Ошибка регистрации',
                  description: result.message,
                  variant: 'error'
                });
                return;
              }

              toast({
                title: mode === 'login' ? 'Вход выполнен' : 'Аккаунт создан',
                description: `Добро пожаловать, ${login.trim()}.`,
                variant: 'success'
              });
              setPassword('');
              setConfirmPassword('');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </Button>
      </Card>
    </div>
  );
};

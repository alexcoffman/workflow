import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/ui/use-toast';
import { DEFAULT_MODELS } from '../../domain/constants';
import type { TelegramBotConfig } from '../../domain/telegram';
import { createId } from '../../lib/id';
import { useAuthStore } from '../../stores/auth-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';

const toMultiline = (models: string[]): string => models.join('\n');

const parseModels = (input: string): string[] => {
  return input
    .split(/[\n,]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item, index, arr) => arr.indexOf(item) === index);
};

const maskToken = (token: string): string => {
  if (token.length <= 8) {
    return '********';
  }

  return `${token.slice(0, 5)}...${token.slice(-3)}`;
};

const normalizeBots = (bots: TelegramBotConfig[]): TelegramBotConfig[] => {
  return bots
    .map((bot) => ({
      id: bot.id.trim(),
      name: bot.name.trim(),
      token: bot.token.trim()
    }))
    .filter((bot) => bot.id.length > 0 && bot.name.length > 0 && bot.token.length > 0)
    .filter((bot, index, arr) => arr.findIndex((item) => item.id === bot.id) === index);
};

export const ApiSettingsDialog = (): JSX.Element => {
  const open = useUiStore((state) => state.isApiSettingsOpen);
  const setOpen = useUiStore((state) => state.setApiSettingsOpen);

  const apiKey = useSettingsStore((state) => state.apiKey);
  const models = useSettingsStore((state) => state.models);
  const telegramBots = useSettingsStore((state) => state.telegramBots);
  const settingsLoading = useSettingsStore((state) => state.settingsLoading);
  const settingsSyncedAt = useSettingsStore((state) => state.settingsSyncedAt);
  const saveApiSettings = useSettingsStore((state) => state.saveApiSettings);
  const hydrateFromServer = useSettingsStore((state) => state.hydrateFromServer);
  const session = useAuthStore((state) => state.session);

  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [draftModels, setDraftModels] = useState(toMultiline(models));
  const [draftBots, setDraftBots] = useState<TelegramBotConfig[]>(telegramBots);
  const [newBotName, setNewBotName] = useState('');
  const [newBotToken, setNewBotToken] = useState('');

  const hasKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);
  const maskedSavedKey = useMemo(() => {
    if (!hasKey) {
      return '';
    }
    return maskToken(apiKey);
  }, [apiKey, hasKey]);
  const { toast } = useToast();
  useEffect(() => {
    if (!open || settingsLoading) {
      return;
    }

    setDraftApiKey(apiKey);
    setDraftModels(toMultiline(models));
    setDraftBots(telegramBots);
  }, [apiKey, models, open, settingsLoading, telegramBots]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDraftApiKey(apiKey);
          setDraftModels(toMultiline(models));
          setDraftBots(telegramBots);
          setNewBotName('');
          setNewBotToken('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Настройки API</DialogTitle>
          <DialogDescription>Ключ OpenAI API и список моделей сохраняются на сервере для текущего пользователя.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-sky-500/35 bg-sky-500/12 p-3 text-sm text-sky-100">
            Серверное хранение включено: ключ и модели не записываются в localStorage браузера.
          </div>

          <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
            <p>
              Синхронизация с сервером:{' '}
              {settingsSyncedAt ? (
                <span className="text-emerald-300">успешно ({new Date(settingsSyncedAt).toLocaleString('ru-RU')})</span>
              ) : (
                <span className="text-amber-300">нет подтвержденной синхронизации</span>
              )}
            </p>
            <p className="mt-1">
              Сохранено сейчас: ключ {hasKey ? 'есть' : 'не задан'}, моделей {models.length}, Telegram-ботов {telegramBots.length}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">Ключ OpenAI API</Label>
            <Input
              id="api-key"
              type="password"
              value={draftApiKey}
              onChange={(event) => setDraftApiKey(event.target.value)}
              placeholder="sk-..."
              disabled={settingsLoading}
            />
            <p className="text-xs text-muted-foreground">Статус ключа: {hasKey ? 'настроен' : 'отсутствует'}</p>
            {hasKey ? (
              <p className="text-xs text-emerald-300">Сохраненный ключ: {maskedSavedKey}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Ключ не сохранен на сервере.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="models-list">Список моделей (по одной на строку или через запятую)</Label>
            <Textarea
              id="models-list"
              rows={8}
              value={draftModels}
              onChange={(event) => setDraftModels(event.target.value)}
              placeholder="gpt-4.1-mini"
              disabled={settingsLoading}
            />
            <p className="text-xs text-muted-foreground">Список сохраняется на сервере без авто-изменений до следующего ручного редактирования.</p>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-secondary/25 p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Telegram-боты</p>
              <p className="text-xs text-muted-foreground">
                Добавьте один или несколько ботов. Затем выберите нужного бота в блоках «Вход из Telegram» и «Выход в Telegram».
              </p>
            </div>

            {draftBots.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Пока нет добавленных Telegram-ботов.
              </div>
            ) : (
              <div className="space-y-2">
                {draftBots.map((bot) => (
                  <div key={bot.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{bot.name}</p>
                      <p className="truncate text-xs text-muted-foreground">Токен: {maskToken(bot.token)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-rose-300 hover:bg-rose-500/20 hover:text-rose-100"
                      title="Удалить бота"
                      onClick={() => {
                        setDraftBots((current) => current.filter((item) => item.id !== bot.id));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input value={newBotName} onChange={(event) => setNewBotName(event.target.value)} placeholder="Название бота" />
              <Input
                value={newBotToken}
                onChange={(event) => setNewBotToken(event.target.value)}
                placeholder="Токен бота Telegram"
                type="password"
              />
              <Button
                type="button"
                onClick={() => {
                  const name = newBotName.trim();
                  const token = newBotToken.trim();

                  if (!name || !token) {
                    toast({
                      title: 'Не удалось добавить бота',
                      description: 'Укажите и название, и токен Telegram-бота.',
                      variant: 'error'
                    });
                    return;
                  }

                  setDraftBots((current) => [
                    ...current,
                    {
                      id: createId(),
                      name,
                      token
                    }
                  ]);

                  setNewBotName('');
                  setNewBotToken('');
                }}
              >
                Добавить бота
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={settingsLoading}
              onClick={() => {
                void (async () => {
                  const result = await saveApiSettings(draftApiKey.trim(), parseModels(draftModels), normalizeBots(draftBots));
                  if (!result.ok) {
                    toast({
                      title: 'Не удалось сохранить настройки API',
                      description: result.message,
                      variant: 'error'
                    });
                    return;
                  }

                  toast({ title: 'Настройки API сохранены', description: 'Ключ, модели и Telegram-боты сохранены на сервере.', variant: 'success' });
                  setOpen(false);
                })();
              }}
            >
              {settingsLoading ? 'Сохранение...' : 'Сохранить настройки'}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={settingsLoading || !session}
              onClick={() => {
                if (!session) {
                  return;
                }

                void (async () => {
                  await hydrateFromServer(session.token);
                  const state = useSettingsStore.getState();
                  toast({
                    title: 'Настройки перечитаны с сервера',
                    description: `Ключ: ${state.apiKey ? 'есть' : 'нет'}, моделей: ${state.models.length}, ботов: ${state.telegramBots.length}.`,
                    variant: 'default'
                  });
                })();
              }}
            >
              Обновить с сервера
            </Button>
            <Button
              variant="outline"
              disabled={settingsLoading}
              onClick={() => {
                void (async () => {
                  const result = await saveApiSettings('', parseModels(draftModels), normalizeBots(draftBots));
                  if (!result.ok) {
                    toast({
                      title: 'Не удалось удалить API-ключ',
                      description: result.message,
                      variant: 'error'
                    });
                    return;
                  }

                  setDraftApiKey('');
                  toast({ title: 'API-ключ удален', variant: 'default' });
                })();
              }}
            >
              Удалить API-ключ
            </Button>
            <Button
              variant="secondary"
              disabled={settingsLoading}
              onClick={() => {
                setDraftModels(toMultiline(DEFAULT_MODELS));
                toast({ title: 'Список моделей обновлен до актуального', variant: 'default' });
              }}
            >
              Подставить актуальные модели
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};






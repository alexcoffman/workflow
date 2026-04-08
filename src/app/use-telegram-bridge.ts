import { useEffect, useMemo, useRef, useState } from 'react';

import { NodeType } from '../domain/node-types';
import { fetchTelegramUpdates } from '../lib/telegram-api';
import { readTelegramPollingOffsets, writeTelegramPollingOffsets } from '../lib/storage';
import { useEditorStore } from '../stores/editor-store';
import { useRunStore, type TelegramRunTrigger } from '../stores/run-store';
import { useSettingsStore } from '../stores/settings-store';
import { useToastStore } from '../stores/toast-store';

const TELEGRAM_POLL_INTERVAL_MS = 3500;
const TELEGRAM_ERROR_TOAST_COOLDOWN_MS = 15_000;

export const useTelegramBridge = (): void => {
  const nodes = useEditorStore((state) => state.nodes);
  const runStatus = useRunStore((state) => state.runStatus);
  const startTelegramTriggeredRun = useRunStore((state) => state.startTelegramTriggeredRun);
  const telegramBots = useSettingsStore((state) => state.telegramBots);
  const pushToast = useToastStore((state) => state.pushToast);

  const [queueVersion, setQueueVersion] = useState(0);
  const queuedTriggersRef = useRef<TelegramRunTrigger[]>([]);
  const pollingOffsetsRef = useRef(readTelegramPollingOffsets());
  const bootstrappedBotIdsRef = useRef(new Set<string>());
  const pollingLocksRef = useRef<Record<string, boolean>>({});
  const lastErrorToastAtByBotRef = useRef<Record<string, number>>({});

  const activeTelegramInputNodesByBot = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.type !== NodeType.TELEGRAM_INPUT) {
        continue;
      }

      if (node.data.isActive === false) {
        continue;
      }

      const botId = node.data.botId.trim();
      if (!botId) {
        continue;
      }

      if (!map.has(botId)) {
        map.set(botId, []);
      }

      map.get(botId)?.push(node.id);
    }

    return map;
  }, [nodes]);

  const activeBots = useMemo(() => {
    return telegramBots.filter((bot) => activeTelegramInputNodesByBot.has(bot.id));
  }, [activeTelegramInputNodesByBot, telegramBots]);

  useEffect(() => {
    if (activeBots.length === 0) {
      return;
    }

    let cancelled = false;

    const enqueueTriggers = (items: TelegramRunTrigger[]): void => {
      if (items.length === 0) {
        return;
      }

      queuedTriggersRef.current.push(...items);
      setQueueVersion((current) => current + 1);
    };

    const pollBot = async (botId: string): Promise<void> => {
      if (cancelled) {
        return;
      }

      if (pollingLocksRef.current[botId]) {
        return;
      }

      const bot = activeBots.find((item) => item.id === botId);
      if (!bot) {
        return;
      }

      pollingLocksRef.current[botId] = true;
      try {
        const configuredNodeIds = activeTelegramInputNodesByBot.get(bot.id) ?? [];
        if (configuredNodeIds.length === 0) {
          return;
        }

        const nextOffset = pollingOffsetsRef.current[bot.id] ?? null;
        const updates = await fetchTelegramUpdates(bot, nextOffset);

        if (updates.length === 0) {
          if (!bootstrappedBotIdsRef.current.has(bot.id)) {
            bootstrappedBotIdsRef.current.add(bot.id);
          }
          return;
        }

        const maxUpdateId = updates.reduce((maxValue, item) => Math.max(maxValue, item.updateId), updates[0]?.updateId ?? 0);
        pollingOffsetsRef.current[bot.id] = maxUpdateId + 1;
        writeTelegramPollingOffsets(pollingOffsetsRef.current);

        const shouldSkipBacklog = !bootstrappedBotIdsRef.current.has(bot.id) && nextOffset === null;
        bootstrappedBotIdsRef.current.add(bot.id);
        if (shouldSkipBacklog) {
          return;
        }

        const nextTriggers: TelegramRunTrigger[] = [];
        for (const update of updates) {
          for (const nodeId of configuredNodeIds) {
            nextTriggers.push({
              nodeId,
              text: update.text,
              context: update.context
            });
          }
        }

        enqueueTriggers(nextTriggers);
      } catch (error) {
        const now = Date.now();
        const lastToastAt = lastErrorToastAtByBotRef.current[bot.id] ?? 0;
        if (now - lastToastAt >= TELEGRAM_ERROR_TOAST_COOLDOWN_MS) {
          lastErrorToastAtByBotRef.current[bot.id] = now;

          const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
          pushToast({
            title: `Ошибка Telegram (${bot.name})`,
            description: message,
            variant: 'error'
          });
        }
      } finally {
        pollingLocksRef.current[botId] = false;
      }
    };

    const pollAllBots = async (): Promise<void> => {
      for (const bot of activeBots) {
        if (cancelled) {
          return;
        }
        await pollBot(bot.id);
      }
    };

    const intervalId = window.setInterval(() => {
      void pollAllBots();
    }, TELEGRAM_POLL_INTERVAL_MS);

    void pollAllBots();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeBots, activeTelegramInputNodesByBot, pushToast]);

  useEffect(() => {
    if (runStatus !== 'idle') {
      return;
    }

    const nextTrigger = queuedTriggersRef.current.shift();
    if (!nextTrigger) {
      return;
    }

    void startTelegramTriggeredRun(nextTrigger).then((started) => {
      if (!started) {
        pushToast({
          title: 'Запуск из Telegram не выполнен',
          description: 'Цепочка не стартовала из-за ошибок валидации или блокировки выполнения.',
          variant: 'error'
        });
      }

      setQueueVersion((current) => current + 1);
    });
  }, [queueVersion, runStatus, startTelegramTriggeredRun, pushToast]);
};

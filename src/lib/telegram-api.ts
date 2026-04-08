import type { TelegramBotConfig, TelegramIncomingUpdate } from '../domain/telegram';

interface TelegramUpdatePayload {
  update_id: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    chat?: {
      id?: number;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    from?: {
      id?: number;
    };
  };
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

const telegramApiUrl = (token: string, method: string): string => `https://api.telegram.org/bot${token}/${method}`;

const parseTelegramUpdate = (botId: string, payload: TelegramUpdatePayload): TelegramIncomingUpdate | null => {
  const updateId = payload.update_id;
  const message = payload.message;
  const text = message?.text;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;

  if (typeof updateId !== 'number' || !Number.isFinite(updateId)) {
    return null;
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  if (typeof chatId !== 'number' || !Number.isFinite(chatId)) {
    return null;
  }

  if (typeof messageId !== 'number' || !Number.isFinite(messageId)) {
    return null;
  }

  const fullName = [message?.chat?.first_name, message?.chat?.last_name]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();
  const chatTitle = message?.chat?.title ?? message?.chat?.username ?? (fullName.length > 0 ? fullName : null);

  return {
    updateId,
    botId,
    text: text.trim(),
    dateUnix: typeof message?.date === 'number' && Number.isFinite(message.date) ? message.date : Math.floor(Date.now() / 1000),
    context: {
      botId,
      chatId,
      chatTitle,
      fromUserId: typeof message?.from?.id === 'number' && Number.isFinite(message.from.id) ? message.from.id : null,
      telegramMessageId: messageId
    }
  };
};

export const fetchTelegramUpdates = async (
  bot: TelegramBotConfig,
  offset: number | null,
  signal?: AbortSignal
): Promise<TelegramIncomingUpdate[]> => {
  const params = new URLSearchParams();
  params.set('timeout', '0');
  if (offset !== null) {
    params.set('offset', String(offset));
  }

  const response = await fetch(`${telegramApiUrl(bot.token, 'getUpdates')}?${params.toString()}`, {
    method: 'GET',
    signal
  });

  if (!response.ok) {
    throw new Error(`Telegram API вернул HTTP ${response.status} при чтении обновлений.`);
  }

  const payload = (await response.json()) as TelegramApiResponse<TelegramUpdatePayload[]>;
  if (!payload.ok) {
    throw new Error(payload.description || 'Telegram API вернул ошибку при чтении обновлений.');
  }

  const updates: TelegramIncomingUpdate[] = [];
  for (const item of payload.result) {
    const parsed = parseTelegramUpdate(bot.id, item);
    if (parsed) {
      updates.push(parsed);
    }
  }

  return updates;
};

export const sendTelegramMessage = async (
  bot: TelegramBotConfig,
  chatId: number,
  text: string,
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(telegramApiUrl(bot.token, 'sendMessage'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Telegram API вернул HTTP ${response.status} при отправке сообщения.`);
  }

  const payload = (await response.json()) as TelegramApiResponse<unknown>;
  if (!payload.ok) {
    throw new Error(payload.description || 'Telegram API вернул ошибку при отправке сообщения.');
  }
};

export interface TelegramBotConfig {
  id: string;
  name: string;
  token: string;
}

export interface TelegramChatContext {
  botId: string;
  chatId: number;
  chatTitle: string | null;
  fromUserId: number | null;
  telegramMessageId: number;
}

export interface TelegramIncomingUpdate {
  updateId: number;
  botId: string;
  text: string;
  dateUnix: number;
  context: TelegramChatContext;
}

export interface TelegramPollingOffsets {
  [botId: string]: number;
}

import type { TelegramChatContext } from './telegram';

export interface FlowMessageMetadata {
  telegram: TelegramChatContext | null;
}

export interface FlowMessage {
  messageId: string;
  text: string;
  sourceNodeId: string;
  sourceNodeTitle: string;
  iteration: number;
  createdAt: number;
  metadata: FlowMessageMetadata;
}

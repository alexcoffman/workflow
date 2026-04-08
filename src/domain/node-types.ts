export enum NodeType {
  START = 'START',
  TEXT = 'TEXT',
  TELEGRAM_INPUT = 'TELEGRAM_INPUT',
  MODEL = 'MODEL',
  DECISION = 'DECISION',
  COUNTER = 'COUNTER',
  MERGE = 'MERGE',
  OUTPUT = 'OUTPUT',
  TELEGRAM_OUTPUT = 'TELEGRAM_OUTPUT',
  NOTE = 'NOTE'
}

export type ExecutableNodeType =
  | NodeType.START
  | NodeType.TEXT
  | NodeType.TELEGRAM_INPUT
  | NodeType.MODEL
  | NodeType.DECISION
  | NodeType.COUNTER
  | NodeType.MERGE
  | NodeType.OUTPUT
  | NodeType.TELEGRAM_OUTPUT;

export const EXECUTABLE_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  NodeType.START,
  NodeType.TEXT,
  NodeType.TELEGRAM_INPUT,
  NodeType.MODEL,
  NodeType.DECISION,
  NodeType.COUNTER,
  NodeType.MERGE,
  NodeType.OUTPUT,
  NodeType.TELEGRAM_OUTPUT
]);

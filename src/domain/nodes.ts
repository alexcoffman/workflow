import { NodeType } from './node-types';

export interface NodePosition {
  x: number;
  y: number;
}

interface NodeBase<TType extends NodeType, TData> {
  id: string;
  type: TType;
  position: NodePosition;
  data: TData;
}

export interface ActivatableNodeData {
  isActive?: boolean;
}

export interface StartNodeData extends ActivatableNodeData {
  title: string;
  text: string;
}

export interface TextNodeData extends ActivatableNodeData {
  title: string;
  text: string;
}

export interface TelegramInputNodeData extends ActivatableNodeData {
  title: string;
  botId: string;
}

export interface ModelNodeData extends ActivatableNodeData {
  title: string;
  provider: 'openai';
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  showIntermediateMeta: boolean;
  requireAllInputs: boolean;
}

export interface DecisionNodeData extends ActivatableNodeData {
  title: string;
  provider: 'openai';
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  showIntermediateMeta: boolean;
  requireAllInputs: boolean;
}

export interface CounterNodeData extends ActivatableNodeData {
  title: string;
  passes: number;
}

export type MergeMode = 'plain_join' | 'join_with_labels' | 'custom_template';

export interface MergeNodeData extends ActivatableNodeData {
  title: string;
  mode: MergeMode;
  separator: string;
  template: string;
  requireAllInputs: boolean;
}

export interface OutputNodeData extends ActivatableNodeData {
  title: string;
}

export interface TelegramOutputNodeData extends ActivatableNodeData {
  title: string;
  botId: string;
}

export interface NoteNodeData extends ActivatableNodeData {
  title: string;
  content: string;
}

export type StartNode = NodeBase<NodeType.START, StartNodeData>;
export type TextNode = NodeBase<NodeType.TEXT, TextNodeData>;
export type TelegramInputNode = NodeBase<NodeType.TELEGRAM_INPUT, TelegramInputNodeData>;
export type ModelNode = NodeBase<NodeType.MODEL, ModelNodeData>;
export type DecisionNode = NodeBase<NodeType.DECISION, DecisionNodeData>;
export type MergeNode = NodeBase<NodeType.MERGE, MergeNodeData>;
export type CounterNode = NodeBase<NodeType.COUNTER, CounterNodeData>;
export type OutputNode = NodeBase<NodeType.OUTPUT, OutputNodeData>;
export type TelegramOutputNode = NodeBase<NodeType.TELEGRAM_OUTPUT, TelegramOutputNodeData>;
export type NoteNode = NodeBase<NodeType.NOTE, NoteNodeData>;

export type FlowNode =
  | StartNode
  | TextNode
  | TelegramInputNode
  | ModelNode
  | DecisionNode
  | CounterNode
  | MergeNode
  | OutputNode
  | TelegramOutputNode
  | NoteNode;
export type ExecutableFlowNode =
  | StartNode
  | TextNode
  | TelegramInputNode
  | ModelNode
  | DecisionNode
  | CounterNode
  | MergeNode
  | OutputNode
  | TelegramOutputNode;

export const isExecutableNode = (node: FlowNode): node is ExecutableFlowNode => {
  return node.type !== NodeType.NOTE;
};

export const isModelNode = (node: FlowNode): node is ModelNode => node.type === NodeType.MODEL;

export const isDecisionNode = (node: FlowNode): node is DecisionNode => node.type === NodeType.DECISION;

export const isCounterNode = (node: FlowNode): node is CounterNode => node.type === NodeType.COUNTER;

export const isMergeNode = (node: FlowNode): node is MergeNode => node.type === NodeType.MERGE;

export const isTextNode = (node: FlowNode): node is TextNode => node.type === NodeType.TEXT;

export const isStartNode = (node: FlowNode): node is StartNode => node.type === NodeType.START;

export const isTelegramInputNode = (node: FlowNode): node is TelegramInputNode => node.type === NodeType.TELEGRAM_INPUT;

export const isOutputNode = (node: FlowNode): node is OutputNode => node.type === NodeType.OUTPUT;

export const isTelegramOutputNode = (node: FlowNode): node is TelegramOutputNode => node.type === NodeType.TELEGRAM_OUTPUT;

export const isNoteNode = (node: FlowNode): node is NoteNode => node.type === NodeType.NOTE;

export const isNodeDataActive = (data: ActivatableNodeData): boolean => data.isActive !== false;

export const isNodeActive = (node: FlowNode): boolean => isNodeDataActive(node.data);

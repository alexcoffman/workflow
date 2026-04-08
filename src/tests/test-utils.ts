import { DEFAULT_OPENAI_MODEL } from '../domain/constants';
import type { FlowEdge } from '../domain/edges';
import { NodeType } from '../domain/node-types';
import type { CounterNode, DecisionNode, FlowNode, MergeNode, ModelNode, NoteNode, OutputNode, StartNode, TextNode } from '../domain/nodes';
import type { FlowSchema } from '../domain/schema';
import type { LlmGenerateRequest, LlmGenerateResponse, LlmProvider } from '../providers/types';

export const makeTextNode = (id: string, text: string, title = id): TextNode => ({
  id,
  type: NodeType.TEXT,
  position: { x: 0, y: 0 },
  data: {
    title,
    text,
    isActive: true
  }
});

export const makeStartNode = (id: string, text: string, title = id): StartNode => ({
  id,
  type: NodeType.START,
  position: { x: 0, y: 0 },
  data: {
    title,
    text,
    isActive: true
  }
});

export const makeModelNode = (
  id: string,
  overrides: Partial<ModelNode['data']> = {},
  title = id
): ModelNode => ({
  id,
  type: NodeType.MODEL,
  position: { x: 0, y: 0 },
  data: {
    title,
    provider: 'openai',
    model: DEFAULT_OPENAI_MODEL,
    systemPrompt: '',
    temperature: 0.5,
    maxTokens: 128,
    showIntermediateMeta: false,
    requireAllInputs: true,
    isActive: true,
    ...overrides
  }
});

export const makeMergeNode = (
  id: string,
  overrides: Partial<MergeNode['data']> = {},
  title = id
): MergeNode => ({
  id,
  type: NodeType.MERGE,
  position: { x: 0, y: 0 },
  data: {
    title,
    mode: 'join_with_labels',
    separator: '\n\n',
    template:
      '[{{input-name-1}}]:\n{{input-value-1}}\n\n[{{input-name-2}}]:\n{{input-value-2}}\n\nTotal inputs: {{count}}',
    requireAllInputs: true,
    isActive: true,
    ...overrides
  }
});

export const makeDecisionNode = (
  id: string,
  overrides: Partial<DecisionNode['data']> = {},
  title = id
): DecisionNode => ({
  id,
  type: NodeType.DECISION,
  position: { x: 0, y: 0 },
  data: {
    title,
    provider: 'openai',
    model: DEFAULT_OPENAI_MODEL,
    systemPrompt: '',
    temperature: 0.2,
    maxTokens: 24,
    showIntermediateMeta: false,
    requireAllInputs: true,
    isActive: true,
    ...overrides
  }
});

export const makeCounterNode = (
  id: string,
  overrides: Partial<CounterNode['data']> = {},
  title = id
): CounterNode => ({
  id,
  type: NodeType.COUNTER,
  position: { x: 0, y: 0 },
  data: {
    title,
    passes: 3,
    isActive: true,
    ...overrides
  }
});

export const makeNoteNode = (id: string, content = ''): NoteNode => ({
  id,
  type: NodeType.NOTE,
  position: { x: 0, y: 0 },
  data: {
    title: id,
    content,
    isActive: true
  }
});

export const makeOutputNode = (id: string, title = id): OutputNode => ({
  id,
  type: NodeType.OUTPUT,
  position: { x: 0, y: 0 },
  data: {
    title,
    isActive: true
  }
});

export const makeEdge = (
  id: string,
  source: string,
  target: string,
  sortOrder: number,
  sourceHandle: string | null = 'output',
  targetHandle: string | null = 'input'
): FlowEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  sortOrder
});

export const makeSchema = (nodes: FlowNode[], edges: FlowEdge[]): FlowSchema => ({
  schemaVersion: '1.0.0',
  nodes,
  edges,
  metadata: {
    name: 'test',
    maxIterations: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
});

export class ScriptedProvider implements LlmProvider {
  public readonly id = 'openai';

  public readonly calls: LlmGenerateRequest[] = [];

  private readonly script: (request: LlmGenerateRequest, index: number) => Promise<LlmGenerateResponse>;

  constructor(script: (request: LlmGenerateRequest, index: number) => Promise<LlmGenerateResponse>) {
    this.script = script;
  }

  async generateText(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    this.calls.push(request);
    return this.script(request, this.calls.length - 1);
  }
}

export const makeProviderResponse = (outputText: string): LlmGenerateResponse => ({
  outputText,
  usage: {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null
  },
  finishReason: null,
  rawResponse: { output_text: outputText }
});

import { HANDLE_IDS, LIMITS } from '../domain/constants';
import type { FlowEdge } from '../domain/edges';
import type { AttemptRecord, ExecutionLogEvent, ModelEventMeta } from '../domain/logs';
import type { FlowMessage } from '../domain/messages';
import { parseMergeInputHandleIndex } from '../domain/merge-input-handles';
import { supportsTemperatureParameter } from '../domain/model-capabilities';
import { NodeType } from '../domain/node-types';
import {
  isNodeActive,
  type CounterNode,
  type DecisionNode,
  type ExecutableFlowNode,
  type FlowNode,
  type MergeNode,
  type ModelNode,
  type TelegramOutputNode
} from '../domain/nodes';
import type { RunStatus } from '../domain/run';
import { getErrorMessage, isTransientNetworkError } from '../lib/error-utils';
import { createId } from '../lib/id';
import { truncateWithSuffix } from '../lib/text';
import type { LlmProvider } from '../providers/types';

import { formatLabeledInputs, mergeMessages, type MergeInputItem } from './merge';
import type {
  EngineCallbacks,
  EngineRunConfig,
  NodeInputBundle,
  QueuedNodeExecution,
  ReadyNodeContext,
  RunSnapshot
} from './types';

interface ExecutionEngineDeps {
  snapshot: RunSnapshot;
  config: EngineRunConfig;
  resolveProvider: (provider: 'openai') => LlmProvider;
  callbacks: EngineCallbacks;
}

interface ModelExecutionResult {
  outputText: string;
  meta: ModelEventMeta;
  attempts: AttemptRecord[];
}

type ModelLikeNode = ModelNode | DecisionNode;

type DecisionRoute = 'yes' | 'no' | 'other';

class ModelExecutionFailure extends Error {
  constructor(
    message: string,
    public readonly attempts: AttemptRecord[],
    public readonly status: 'failed' | 'aborted'
  ) {
    super(message);
  }
}

export class ExecutionEngine {
  private readonly snapshot: RunSnapshot;

  private readonly config: EngineRunConfig;

  private readonly callbacks: EngineCallbacks;

  private readonly resolveProvider: (provider: 'openai') => LlmProvider;

  private readonly triggerInputByNodeId: Record<
    string,
    {
      text: string;
      telegramContext: FlowMessage['metadata']['telegram'];
    }
  >;

  private readonly queue: QueuedNodeExecution[] = [];

  private readonly inboxByNodeId = new Map<string, Map<number, Map<string, FlowMessage[]>>>();

  private readonly messagesById = new Map<string, FlowMessage>();

  private readonly processedFingerprints = new Set<string>();

  private readonly queuedFingerprints = new Set<string>();

  private readonly runningFingerprints = new Set<string>();

  private readonly eventsById = new Map<string, ExecutionLogEvent>();

  private readonly visitedCycleComponents = new Set<string>();

  private readonly remainingCounterPassesByNodeId = new Map<string, number>();

  private readyOrderCounter = 0;

  private status: RunStatus = 'idle';

  private stopRequested = false;

  private activeAbortController: AbortController | null = null;

  constructor(deps: ExecutionEngineDeps) {
    this.snapshot = deps.snapshot;
    this.config = deps.config;
    this.resolveProvider = deps.resolveProvider;
    this.callbacks = deps.callbacks;
    this.triggerInputByNodeId = deps.config.triggerInputByNodeId ?? {};
  }

  public async run(): Promise<RunStatus> {
    this.status = 'running';
    this.callbacks.onRunStatus('running');

    const runStartNodeIds = this.config.startNodeIdsOverride ?? this.snapshot.startNodeIds;

    this.enqueueReadyNodes(
      runStartNodeIds.map((nodeId) => ({
        nodeId,
        iteration: 1,
        parentEventId: null
      }))
    );

    while (this.queue.length > 0) {
      if (this.stopRequested) {
        return this.status;
      }

      const queued = this.queue.shift();
      if (!queued) {
        break;
      }

      this.queuedFingerprints.delete(queued.fingerprint);
      await this.executeQueuedNode(queued);

      if ((this.status as RunStatus) === 'error' || (this.status as RunStatus) === 'stopped') {
        return this.status;
      }
    }

    if (this.status === 'running') {
      this.status = 'idle';
      this.callbacks.onRunStatus('idle');
    }

    return this.status;
  }

  public stop(): void {
    if (this.status !== 'running' && this.status !== 'paused') {
      return;
    }

    this.stopRequested = true;
    this.queue.length = 0;

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }

    this.status = 'stopped';
    this.callbacks.onRunStatus('stopped');
  }

  private enqueueReadyNodes(contexts: ReadyNodeContext[]): void {
    const sorted = [...contexts].sort((a, b) => {
      if (a.nodeId !== b.nodeId) {
        return a.nodeId.localeCompare(b.nodeId);
      }
      return a.iteration - b.iteration;
    });

    for (const context of sorted) {
      this.enqueueNodeIfReady(context);
    }
  }

  private enqueueNodeIfReady(context: ReadyNodeContext): void {
    if (this.stopRequested) {
      return;
    }

    const node = this.snapshot.nodeById[context.nodeId];
    if (!node || node.type === NodeType.NOTE) {
      return;
    }

    if (node.type === NodeType.START && (context.iteration !== 1 || context.parentEventId !== null)) {
      return;
    }

    if (node.type === NodeType.TELEGRAM_INPUT && (context.iteration !== 1 || context.parentEventId !== null)) {
      return;
    }

    if (node.type === NodeType.TEXT && context.iteration !== 1) {
      return;
    }

    const bundle = this.getNodeInputBundle(context.nodeId, context.iteration);
    if (!this.isNodeReady(node, bundle, context.iteration)) {
      return;
    }

    const inputMessageIds = bundle.messages.map((message) => message.messageId);
    const mergeInputItems = node.type === NodeType.MERGE ? this.buildMergeInputItems(bundle.inputMessagesByEdge) : [];
    const fingerprint = this.createFingerprint(context.nodeId, context.iteration, inputMessageIds);

    if (
      this.processedFingerprints.has(fingerprint) ||
      this.queuedFingerprints.has(fingerprint) ||
      this.runningFingerprints.has(fingerprint)
    ) {
      return;
    }

    const eventId = createId();
    const inputText = this.createEventInputText(node, bundle.messages);

    const queueItem: QueuedNodeExecution = {
      ...context,
      eventId,
      fingerprint,
      readyOrder: this.readyOrderCounter,
      inputMessageIds,
      inputText,
      mergeInputItems
    };

    this.readyOrderCounter += 1;
    this.queue.push(queueItem);
    this.queuedFingerprints.add(fingerprint);

    const queuedEvent: ExecutionLogEvent = {
      runId: this.snapshot.runId,
      eventId,
      parentEventId: context.parentEventId,
      nodeId: node.id,
      nodeTitle: node.data.title,
      nodeType: node.type,
      status: 'queued',
      iteration: context.iteration,
      inputText,
      outputText: '',
      errorMessage: null,
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: null,
      attemptCount: 0,
      attempts: [],
      modelMeta: null
    };

    this.pushEvent(queuedEvent);
    this.callbacks.onNodeState(node.id, 'queued');
  }

  private getNodeInputBundle(nodeId: string, iteration: number): NodeInputBundle {
    const node = this.snapshot.nodeById[nodeId];
    const incomingEdgesRaw = this.getEffectiveIncomingEdges(nodeId, iteration);
    const incomingEdges =
      node?.type === NodeType.MERGE
        ? [...incomingEdgesRaw].sort((a, b) => {
            const leftIndex = parseMergeInputHandleIndex(a.targetHandle) ?? Number.MAX_SAFE_INTEGER;
            const rightIndex = parseMergeInputHandleIndex(b.targetHandle) ?? Number.MAX_SAFE_INTEGER;

            if (leftIndex !== rightIndex) {
              return leftIndex - rightIndex;
            }

            if (a.sortOrder !== b.sortOrder) {
              return a.sortOrder - b.sortOrder;
            }

            if (a.source !== b.source) {
              return a.source.localeCompare(b.source);
            }

            return a.id.localeCompare(b.id);
          })
        : incomingEdgesRaw;

    if (incomingEdges.length === 0) {
      return {
        messages: [],
        expectedInputCount: 0,
        availableInputCount: 0,
        inputMessagesByEdge: []
      };
    }

    const messages: FlowMessage[] = [];
    let availableInputCount = 0;
    const inputMessagesByEdge: Array<{ edge: FlowEdge; messages: FlowMessage[] }> = [];

    for (const edge of incomingEdges) {
      const edgeMessages = this.readInboxMessages(nodeId, iteration, edge.id);
      if (edgeMessages.length > 0) {
        availableInputCount += 1;
      }
      messages.push(...edgeMessages);
      inputMessagesByEdge.push({
        edge,
        messages: edgeMessages
      });
    }

    return {
      messages,
      expectedInputCount: incomingEdges.length,
      availableInputCount,
      inputMessagesByEdge
    };
  }

  private getEffectiveIncomingEdges(nodeId: string, iteration: number): FlowEdge[] {
    const incomingEdges = this.snapshot.incomingEdgesByNode[nodeId] ?? [];

    if (iteration <= 1) {
      return incomingEdges;
    }

    return incomingEdges.filter((edge) => {
      const sourceNode = this.snapshot.nodeById[edge.source];
      return (
        sourceNode?.type !== NodeType.TEXT &&
        sourceNode?.type !== NodeType.START &&
        sourceNode?.type !== NodeType.TELEGRAM_INPUT
      );
    });
  }

  private isNodeReady(node: ExecutableFlowNode, bundle: NodeInputBundle, iteration: number): boolean {
    if (node.type === NodeType.START) {
      return iteration === 1;
    }

    if (node.type === NodeType.TELEGRAM_INPUT) {
      return iteration === 1 && this.getTriggerInput(node.id) !== null;
    }

    if (node.type === NodeType.TEXT) {
      if (iteration !== 1) {
        return false;
      }

      if (bundle.expectedInputCount === 0) {
        return true;
      }

      if (bundle.messages.length === 0) {
        return false;
      }

      return bundle.messages.some((message) => this.snapshot.nodeById[message.sourceNodeId]?.type === NodeType.START);
    }

    if (node.type === NodeType.MODEL || node.type === NodeType.DECISION) {
      if (bundle.expectedInputCount === 0) {
        return false;
      }

      if (node.data.requireAllInputs) {
        if (bundle.messages.length === 0) {
          return false;
        }

        if (this.hasMessagesOnAllRequiredModelEdges(node.id, iteration)) {
          return true;
        }

        return this.canBootstrapCyclicModel(node.id, iteration);
      }

      return bundle.messages.length > 0;
    }

    if (node.type === NodeType.MERGE) {
      if (bundle.expectedInputCount === 0) {
        return false;
      }

      if (node.data.requireAllInputs) {
        return bundle.availableInputCount === bundle.expectedInputCount && bundle.messages.length > 0;
      }

      return bundle.messages.length > 0;
    }

    if (node.type === NodeType.OUTPUT) {
      if (bundle.expectedInputCount === 0) {
        return false;
      }

      return bundle.availableInputCount === bundle.expectedInputCount && bundle.messages.length > 0;
    }

    if (node.type === NodeType.TELEGRAM_OUTPUT) {
      if (bundle.expectedInputCount === 0) {
        return false;
      }

      return bundle.messages.length > 0;
    }

    if (node.type === NodeType.COUNTER) {
      if (bundle.expectedInputCount === 0) {
        return false;
      }

      return bundle.messages.length > 0;
    }

    if (bundle.expectedInputCount === 0) {
      return false;
    }

    return bundle.availableInputCount === bundle.expectedInputCount && bundle.messages.length > 0;
  }

  private hasMessagesOnAllRequiredModelEdges(nodeId: string, iteration: number): boolean {
    const requiredEdges = this.getRequiredModelIncomingEdges(nodeId, iteration);
    if (requiredEdges.length === 0) {
      return false;
    }

    for (const edge of requiredEdges) {
      const edgeMessages = this.readInboxMessages(nodeId, iteration, edge.id);
      if (edgeMessages.length === 0) {
        return false;
      }
    }

    return true;
  }

  private getRequiredModelIncomingEdges(nodeId: string, iteration: number): FlowEdge[] {
    const incomingEdges = this.getEffectiveIncomingEdges(nodeId, iteration);
    if (incomingEdges.length === 0) {
      return [];
    }

    // For cyclic nodes after the first wave, strict readiness should rely on cyclic feedback edges.
    if (iteration <= 1) {
      return incomingEdges;
    }

    const analysis = this.snapshot.cycleAnalysis;
    const nodeComponent = analysis.componentByNodeId[nodeId];
    if (!nodeComponent || !analysis.cycleComponentIds.has(nodeComponent)) {
      return incomingEdges;
    }

    const cycleEdges = incomingEdges.filter((edge) => {
      if (!analysis.cycleRelatedEdgeIds.has(edge.id)) {
        return false;
      }
      const sourceComponent = analysis.componentByNodeId[edge.source];
      const targetComponent = analysis.componentByNodeId[edge.target];
      return sourceComponent === nodeComponent && targetComponent === nodeComponent;
    });

    return cycleEdges.length > 0 ? cycleEdges : incomingEdges;
  }

  private canBootstrapCyclicModel(nodeId: string, iteration: number): boolean {
    if (iteration !== 1) {
      return false;
    }

    const incomingEdges = this.snapshot.incomingEdgesByNode[nodeId] ?? [];
    if (incomingEdges.length === 0) {
      return false;
    }

    const analysis = this.snapshot.cycleAnalysis;
    const nodeComponent = analysis.componentByNodeId[nodeId];
    if (!nodeComponent || !analysis.cycleComponentIds.has(nodeComponent)) {
      return false;
    }

    let hasAnyInputMessage = false;

    for (const edge of incomingEdges) {
      const edgeMessages = this.readInboxMessages(nodeId, iteration, edge.id);
      if (edgeMessages.length > 0) {
        hasAnyInputMessage = true;
        continue;
      }

      const sourceComponent = analysis.componentByNodeId[edge.source];
      const targetComponent = analysis.componentByNodeId[edge.target];
      const isInternalCycleEdge =
        analysis.cycleRelatedEdgeIds.has(edge.id) &&
        sourceComponent === nodeComponent &&
        targetComponent === nodeComponent;

      if (!isInternalCycleEdge) {
        return false;
      }
    }

    return hasAnyInputMessage;
  }

  private getTriggerInput(nodeId: string): { text: string; telegramContext: FlowMessage['metadata']['telegram'] } | null {
    const trigger = this.triggerInputByNodeId[nodeId];
    if (!trigger) {
      return null;
    }

    const text = trigger.text.trim();
    if (text.length === 0) {
      return null;
    }

    return {
      text,
      telegramContext: trigger.telegramContext ?? null
    };
  }

  private createFingerprint(nodeId: string, iteration: number, inputMessageIds: string[]): string {
    const stableInputIds = [...inputMessageIds].sort((a, b) => a.localeCompare(b));
    return `${nodeId}::${iteration}::${stableInputIds.join('|')}`;
  }

  private createEventInputText(node: FlowNode, messages: FlowMessage[]): string {
    if (node.type === NodeType.TEXT || node.type === NodeType.START || node.type === NodeType.TELEGRAM_INPUT) {
      return '';
    }

    return formatLabeledInputs(messages);
  }

  private buildMergeInputItems(
    inputMessagesByEdge: Array<{
      edge: FlowEdge;
      messages: FlowMessage[];
    }>
  ): MergeInputItem[] {
    const items: MergeInputItem[] = [];

    for (const entry of inputMessagesByEdge) {
      const latestMessage = entry.messages[entry.messages.length - 1];
      if (!latestMessage) {
        continue;
      }

      items.push({
        index: items.length + 1,
        sourceNodeId: latestMessage.sourceNodeId,
        sourceNodeTitle: latestMessage.sourceNodeTitle,
        value: latestMessage.text
      });
    }

    return items;
  }

  private readInboxMessages(nodeId: string, iteration: number, edgeId: string): FlowMessage[] {
    const perIteration = this.inboxByNodeId.get(nodeId);
    if (!perIteration) {
      return [];
    }

    const perEdge = perIteration.get(iteration);
    if (!perEdge) {
      return [];
    }

    const messages = perEdge.get(edgeId) ?? [];
    return [...messages].sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.messageId.localeCompare(b.messageId);
    });
  }

  private writeInboxMessage(nodeId: string, iteration: number, edgeId: string, message: FlowMessage): void {
    if (!this.inboxByNodeId.has(nodeId)) {
      this.inboxByNodeId.set(nodeId, new Map<number, Map<string, FlowMessage[]>>());
    }

    const perIteration = this.inboxByNodeId.get(nodeId);
    if (!perIteration) {
      return;
    }

    if (!perIteration.has(iteration)) {
      perIteration.set(iteration, new Map<string, FlowMessage[]>());
    }

    const perEdge = perIteration.get(iteration);
    if (!perEdge) {
      return;
    }

    if (!perEdge.has(edgeId)) {
      perEdge.set(edgeId, []);
    }

    const messages = perEdge.get(edgeId);
    if (!messages) {
      return;
    }

    messages.push(message);
    this.messagesById.set(message.messageId, message);
  }

  private async executeQueuedNode(queued: QueuedNodeExecution): Promise<void> {
    if (this.stopRequested || this.status !== 'running') {
      return;
    }

    const node = this.snapshot.nodeById[queued.nodeId];
    if (!node || node.type === NodeType.NOTE) {
      return;
    }

    if (!isNodeActive(node)) {
      const now = Date.now();
      this.patchEvent(queued.eventId, {
        status: 'skipped',
        outputText: '',
        errorMessage: 'Блок деактивирован. Выполнение ветки остановлено на этом блоке.',
        finishedAt: now,
        durationMs: 0,
        attemptCount: 0,
        attempts: [],
        modelMeta: null
      });
      this.callbacks.onNodeState(node.id, 'skipped');
      this.processedFingerprints.add(queued.fingerprint);
      return;
    }

    this.runningFingerprints.add(queued.fingerprint);

    const inputMessages = queued.inputMessageIds
      .map((messageId) => this.messagesById.get(messageId))
      .filter((message): message is FlowMessage => Boolean(message));

    const startedAt = Date.now();
    this.patchEvent(queued.eventId, {
      status: 'started',
      startedAt
    });
    this.callbacks.onNodeState(node.id, 'running');

    try {
      const result = await this.executeNode(node, inputMessages, queued.inputText, queued.mergeInputItems);

      const finishedAt = Date.now();
      const completedEventPatch: Partial<ExecutionLogEvent> = {
        status: 'completed',
        outputText: result.outputText,
        errorMessage: null,
        finishedAt,
        durationMs: finishedAt - startedAt,
        attemptCount: result.attempts.length,
        attempts: result.attempts,
        modelMeta: result.modelMeta
      };

      this.patchEvent(queued.eventId, completedEventPatch);
      this.callbacks.onNodeState(node.id, 'completed');
      this.processedFingerprints.add(queued.fingerprint);

      await this.forwardOutput(
        node,
        queued.iteration,
        result.outputText,
        result.outputMetadata,
        queued.eventId,
        result.selectedOutputHandle
      );
    } catch (error) {
      const finishedAt = Date.now();

      if (error instanceof ModelExecutionFailure && error.status === 'aborted') {
        this.patchEvent(queued.eventId, {
          status: 'aborted',
          errorMessage: error.message,
          finishedAt,
          durationMs: finishedAt - startedAt,
          attemptCount: error.attempts.length,
          attempts: error.attempts,
          modelMeta: null
        });
        this.callbacks.onNodeState(node.id, 'aborted');
      } else {
        const attempts = error instanceof ModelExecutionFailure ? error.attempts : [];
        this.patchEvent(queued.eventId, {
          status: 'failed',
          errorMessage: getErrorMessage(error),
          finishedAt,
          durationMs: finishedAt - startedAt,
          attemptCount: attempts.length,
          attempts,
          modelMeta: null
        });
        this.callbacks.onNodeState(node.id, 'failed');

        if ((this.status as RunStatus) !== 'stopped') {
          this.status = 'error';
          this.callbacks.onRunStatus('error');
        }
      }

      this.processedFingerprints.add(queued.fingerprint);
      this.queue.length = 0;
    } finally {
      this.runningFingerprints.delete(queued.fingerprint);
    }
  }

  private async executeNode(
    node: ExecutableFlowNode,
    inputMessages: FlowMessage[],
    inputText: string,
    mergeInputItems: MergeInputItem[]
  ): Promise<{
    outputText: string;
    outputMetadata: FlowMessage['metadata'];
    attempts: AttemptRecord[];
    modelMeta: ModelEventMeta | null;
    selectedOutputHandle: string | null;
  }> {
    if (node.type === NodeType.START) {
      return {
        outputText: node.data.text,
        outputMetadata: {
          telegram: null
        },
        attempts: [],
        modelMeta: null,
        selectedOutputHandle: null
      };
    }

    if (node.type === NodeType.TELEGRAM_INPUT) {
      const triggerInput = this.getTriggerInput(node.id);
      if (!triggerInput) {
        throw new Error('Для блока ВХОД ИЗ TELEGRAM не найден входящий триггер.');
      }

      return {
        outputText: triggerInput.text,
        outputMetadata: {
          telegram: triggerInput.telegramContext
        },
        attempts: [],
        modelMeta: null,
        selectedOutputHandle: null
      };
    }

    if (node.type === NodeType.TEXT) {
      return {
        outputText: node.data.text,
        outputMetadata: {
          telegram: null
        },
        attempts: [],
        modelMeta: null,
        selectedOutputHandle: null
      };
    }

    if (node.type === NodeType.MERGE) {
      if (inputMessages.length === 0) {
        throw new Error('Блок ОБЬЕДИНИТЬ не может выполняться без входящих сообщений.');
      }

      const outputText = mergeMessages(node as MergeNode, mergeInputItems);
      return {
        outputText,
        outputMetadata: this.pickOutputMetadata(inputMessages),
        attempts: [],
        modelMeta: null,
        selectedOutputHandle: null
      };
    }

    if (node.type === NodeType.OUTPUT) {
      if (inputMessages.length === 0) {
        throw new Error('Блок ВЫВОД не может выполняться без входящего сообщения.');
      }

      const latestMessage = inputMessages[inputMessages.length - 1];
      const outputText = latestMessage?.text ?? '';

      return {
        outputText,
        outputMetadata: this.pickOutputMetadata(inputMessages),
        attempts: [],
        modelMeta: null,
        selectedOutputHandle: null
      };
    }

    if (node.type === NodeType.TELEGRAM_OUTPUT) {
      if (inputMessages.length === 0) {
        throw new Error('Блок ВЫХОД В TELEGRAM не может выполняться без входящего сообщения.');
      }

      const latestMessage = inputMessages[inputMessages.length - 1];
      const outputText = latestMessage?.text ?? '';
      const metadata = this.pickOutputMetadata(inputMessages);
      const telegramContext = metadata.telegram;

      if (!telegramContext) {
        throw new Error('Для отправки в Telegram не найден контекст чата (нет входа из Telegram).');
      }

      await this.sendTelegramOutput(node as TelegramOutputNode, telegramContext.chatId, outputText);

      return {
        outputText,
        outputMetadata: metadata,
        attempts: [],
        modelMeta: null,
        selectedOutputHandle: null
      };
    }

    if (node.type === NodeType.COUNTER) {
      if (inputMessages.length === 0) {
        throw new Error('Блок СЧЁТЧИК не может выполняться без входящего сообщения.');
      }

      const latestMessage = inputMessages[inputMessages.length - 1];
      const outputText = latestMessage?.text ?? '';
      const selectedOutputHandle = this.resolveCounterOutputHandle(node);

      return {
        outputText,
        outputMetadata: this.pickOutputMetadata(inputMessages),
        attempts: [],
        modelMeta: null,
        selectedOutputHandle
      };
    }

    if (inputMessages.length === 0 || inputText.trim().length === 0) {
      throw new Error('Блок модели не может выполняться с пустым входом.');
    }

    const modelResult = await this.executeModelNode(node as ModelLikeNode, inputText);

    if (node.type === NodeType.DECISION) {
      const route = this.classifyDecisionRoute(modelResult.outputText);
      return {
        outputText: modelResult.outputText,
        outputMetadata: this.pickOutputMetadata(inputMessages),
        attempts: modelResult.attempts,
        modelMeta: modelResult.meta,
        selectedOutputHandle: this.mapRouteToHandle(route)
      };
    }

    return {
      outputText: modelResult.outputText,
      outputMetadata: this.pickOutputMetadata(inputMessages),
      attempts: modelResult.attempts,
      modelMeta: modelResult.meta,
      selectedOutputHandle: null
    };
  }
  private async executeModelNode(node: ModelLikeNode, inputText: string): Promise<ModelExecutionResult> {
    const provider = this.resolveProvider(node.data.provider);
    const attempts: AttemptRecord[] = [];
    const maxAttempts = 1 + LIMITS.retryCount;

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
      const attemptStartedAt = Date.now();
      const controller = new AbortController();
      this.activeAbortController = controller;

      let timedOut = false;
      const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, LIMITS.requestTimeoutMs);

      try {
        const response = await provider.generateText({
          model: node.data.model,
          input: inputText,
          instructions: node.data.systemPrompt.trim() ? node.data.systemPrompt : undefined,
          temperature: supportsTemperatureParameter(node.data.model) ? node.data.temperature : undefined,
          maxOutputTokens: node.data.maxTokens,
          signal: controller.signal
        });

        globalThis.clearTimeout(timeoutId);
        this.activeAbortController = null;

        const attemptFinishedAt = Date.now();
        attempts.push({
          attemptNumber,
          startedAt: attemptStartedAt,
          finishedAt: attemptFinishedAt,
          durationMs: attemptFinishedAt - attemptStartedAt,
          errorMessage: null,
          status: 'completed'
        });

        const rawPreview = node.data.showIntermediateMeta
          ? this.createRawPreview(response.rawResponse)
          : null;

        return {
          outputText: response.outputText,
          attempts,
          meta: {
            provider: 'openai',
            model: node.data.model,
            usage: response.usage,
            finishReason: response.finishReason,
            rawResponsePreview: rawPreview
          }
        };
      } catch (error) {
        globalThis.clearTimeout(timeoutId);
        this.activeAbortController = null;

        const attemptFinishedAt = Date.now();
        const abortedByStop = this.stopRequested;
        const message = timedOut ? 'Превышен таймаут запроса (60 секунд).' : getErrorMessage(error);

        attempts.push({
          attemptNumber,
          startedAt: attemptStartedAt,
          finishedAt: attemptFinishedAt,
          durationMs: attemptFinishedAt - attemptStartedAt,
          errorMessage: message,
          status: abortedByStop ? 'aborted' : 'failed'
        });

        if (abortedByStop) {
          throw new ModelExecutionFailure(message, attempts, 'aborted');
        }

        const hasRetryLeft = attemptNumber < maxAttempts;
        const canRetry = hasRetryLeft && (timedOut || isTransientNetworkError(error));

        if (canRetry) {
          continue;
        }

        throw new ModelExecutionFailure(message, attempts, 'failed');
      }
    }

    throw new ModelExecutionFailure('Блок модели исчерпал попытки повтора.', attempts, 'failed');
  }

  private classifyDecisionRoute(text: string): DecisionRoute {
    const normalized = text.trim().toLowerCase();
    if (!normalized) {
      return 'other';
    }

    const tokenMatch = normalized.match(/[a-zа-яё]+/i);
    const token = tokenMatch ? tokenMatch[0] : normalized;

    if (token === 'да' || token === 'yes') {
      return 'yes';
    }

    if (token === 'нет' || token === 'no') {
      return 'no';
    }

    return 'other';
  }

  private mapRouteToHandle(route: DecisionRoute): string {
    if (route === 'yes') {
      return HANDLE_IDS.decisionOutputYes;
    }

    if (route === 'no') {
      return HANDLE_IDS.decisionOutputNo;
    }

    return HANDLE_IDS.decisionOutputOther;
  }

  private pickOutputMetadata(inputMessages: FlowMessage[]): FlowMessage['metadata'] {
    for (const message of inputMessages) {
      if (message.metadata.telegram) {
        return {
          telegram: message.metadata.telegram
        };
      }
    }

    return {
      telegram: null
    };
  }

  private async sendTelegramOutput(node: TelegramOutputNode, chatId: number, text: string): Promise<void> {
    if (!this.callbacks.onTelegramOutput) {
      throw new Error('Канал отправки в Telegram не инициализирован.');
    }

    const botId = node.data.botId.trim();
    if (!botId) {
      throw new Error('У блока ВЫХОД В TELEGRAM не выбран бот.');
    }

    const controller = new AbortController();
    this.activeAbortController = controller;

    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, LIMITS.requestTimeoutMs);

    try {
      await this.callbacks.onTelegramOutput({
        nodeId: node.id,
        botId,
        chatId,
        text,
        signal: controller.signal
      });
    } catch (error) {
      if (this.stopRequested) {
        throw new Error('Отправка в Telegram была прервана пользователем.');
      }

      if (timedOut) {
        throw new Error('Превышен таймаут отправки в Telegram (60 секунд).');
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
      this.activeAbortController = null;
    }
  }

  private resolveCounterOutputHandle(node: CounterNode): string {
    const configuredPasses = Number.isInteger(node.data.passes) && node.data.passes > 0 ? node.data.passes : 1;
    const currentRemaining = this.remainingCounterPassesByNodeId.get(node.id) ?? configuredPasses;

    if (currentRemaining <= 1) {
      this.remainingCounterPassesByNodeId.set(node.id, 0);
      return HANDLE_IDS.counterOutputFinal;
    }

    this.remainingCounterPassesByNodeId.set(node.id, currentRemaining - 1);
    return HANDLE_IDS.counterOutputIntermediate;
  }

  private createRawPreview(rawResponse: unknown): string | null {
    try {
      const serialized = JSON.stringify(rawResponse);
      if (!serialized) {
        return null;
      }
      return truncateWithSuffix(serialized, LIMITS.maxRawResponsePreviewLength);
    } catch {
      return null;
    }
  }

  private async forwardOutput(
    node: ExecutableFlowNode,
    iteration: number,
    outputText: string,
    outputMetadata: FlowMessage['metadata'],
    parentEventId: string,
    selectedOutputHandle: string | null
  ): Promise<void> {
    if (this.stopRequested || this.status !== 'running') {
      return;
    }

    const outgoingEdges = this.snapshot.outgoingEdgesByNode[node.id] ?? [];
    const eligibleEdges =
      selectedOutputHandle === null
        ? outgoingEdges
        : outgoingEdges.filter((edge) => edge.sourceHandle === selectedOutputHandle);

    if (eligibleEdges.length === 0) {
      return;
    }

    const readyContexts: ReadyNodeContext[] = [];

    for (const edge of eligibleEdges) {
      if (this.stopRequested || this.status !== 'running') {
        break;
      }

      const targetNode = this.snapshot.nodeById[edge.target];
      if (!targetNode || targetNode.type === NodeType.NOTE) {
        continue;
      }

      this.callbacks.onEdgeState(edge.id, 'running');

      const nextIteration = this.resolveNextIteration(iteration, edge);

      if (this.config.maxIterations !== null && nextIteration > this.config.maxIterations) {
        this.callbacks.onEdgeState(edge.id, 'skipped');
        this.emitIterationLimitSkippedEvent(targetNode, nextIteration, parentEventId, outputText);
        continue;
      }

      if (this.stopRequested || this.status !== 'running') {
        this.callbacks.onEdgeState(edge.id, 'aborted');
        break;
      }

      const message: FlowMessage = {
        messageId: createId(),
        text: outputText,
        sourceNodeId: node.id,
        sourceNodeTitle: node.data.title,
        iteration: nextIteration,
        createdAt: Date.now(),
        metadata: {
          telegram: outputMetadata.telegram
        }
      };

      this.writeInboxMessage(edge.target, nextIteration, edge.id, message);
      this.callbacks.onEdgeState(edge.id, 'completed');
      readyContexts.push({
        nodeId: edge.target,
        iteration: nextIteration,
        parentEventId
      });
    }

    const dedupedContexts = new Map<string, ReadyNodeContext>();
    for (const context of readyContexts) {
      const key = `${context.nodeId}::${context.iteration}`;
      if (!dedupedContexts.has(key)) {
        dedupedContexts.set(key, context);
      }
    }

    this.enqueueReadyNodes([...dedupedContexts.values()]);
  }

  private resolveNextIteration(iteration: number, edge: FlowEdge): number {
    const analysis = this.snapshot.cycleAnalysis;
    const targetComponent = analysis.componentByNodeId[edge.target];

    if (!targetComponent || !analysis.cycleComponentIds.has(targetComponent)) {
      return iteration;
    }

    let nextIteration = iteration;

    if (analysis.cycleRelatedEdgeIds.has(edge.id) && this.visitedCycleComponents.has(targetComponent)) {
      nextIteration += 1;
    }

    this.visitedCycleComponents.add(targetComponent);
    return nextIteration;
  }

  private emitIterationLimitSkippedEvent(
    targetNode: FlowNode,
    attemptedIteration: number,
    parentEventId: string,
    inputText: string
  ): void {
    const now = Date.now();
    const event: ExecutionLogEvent = {
      runId: this.snapshot.runId,
      eventId: createId(),
      parentEventId,
      nodeId: targetNode.id,
      nodeTitle: targetNode.data.title,
      nodeType: targetNode.type,
      status: 'skipped',
      iteration: attemptedIteration,
      inputText,
      outputText: '',
      errorMessage: `Достигнут лимит итераций на значении ${attemptedIteration}.`,
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      attemptCount: 0,
      attempts: [],
      modelMeta: null
    };

    this.pushEvent(event);
    this.callbacks.onNodeState(targetNode.id, 'skipped');
  }

  private pushEvent(event: ExecutionLogEvent): void {
    this.eventsById.set(event.eventId, event);
    this.callbacks.onEvent(event);
  }

  private patchEvent(eventId: string, patch: Partial<ExecutionLogEvent>): void {
    const current = this.eventsById.get(eventId);
    if (!current) {
      return;
    }

    const nextEvent: ExecutionLogEvent = {
      ...current,
      ...patch
    };

    this.eventsById.set(eventId, nextEvent);
    this.callbacks.onEvent(nextEvent);
  }
}






import { create } from 'zustand';

import { LIMITS } from '../domain/constants';
import type { ExecutionLogEvent } from '../domain/logs';
import { NodeType } from '../domain/node-types';
import type { EdgeExecutionVisualState, NodeExecutionVisualState, RunStatus } from '../domain/run';
import type { TelegramChatContext } from '../domain/telegram';
import type { ValidationResult } from '../domain/validation';
import { ExecutionEngine, createRunSnapshot, validateGraphForRun } from '../engine';
import { createId } from '../lib/id';
import { sendTelegramMessage } from '../lib/telegram-api';
import { createProvider } from '../providers';

import { useEditorStore } from './editor-store';
import { useSettingsStore } from './settings-store';

export type LogViewMode = 'compact' | 'detailed';

export interface RunTrace {
  runId: string;
  status: RunStatus;
  startedAt: number;
  finishedAt: number | null;
  events: ExecutionLogEvent[];
}

export interface CounterRuntimeProgress {
  remaining: number;
  total: number;
}

export interface TelegramRunTrigger {
  nodeId: string;
  text: string;
  context: TelegramChatContext;
}

interface RunState {
  runStatus: RunStatus;
  currentRunId: string | null;
  runHistory: RunTrace[];
  validationResult: ValidationResult | null;
  nodeExecutionState: Record<string, NodeExecutionVisualState>;
  edgeExecutionState: Record<string, EdgeExecutionVisualState>;
  edgeAnimationTickById: Record<string, number>;
  nodeOutputByNodeId: Record<string, string>;
  counterProgressByNodeId: Record<string, CounterRuntimeProgress>;
  logViewMode: LogViewMode;
  activeEngine: ExecutionEngine | null;
  setLogViewMode: (mode: LogViewMode) => void;
  clearLog: () => void;
  startRun: () => Promise<boolean>;
  startTelegramTriggeredRun: (trigger: TelegramRunTrigger) => Promise<boolean>;
  stopRun: () => void;
  setValidationResult: (result: ValidationResult | null) => void;
}

const pruneHistory = (history: RunTrace[]): RunTrace[] => {
  const cloned = history.map((trace) => ({ ...trace, events: [...trace.events] }));

  const countEvents = (): number => cloned.reduce((sum, trace) => sum + trace.events.length, 0);

  while (countEvents() > LIMITS.maxLogEventsInMemory) {
    const oldestTrace = cloned[cloned.length - 1];
    if (!oldestTrace) {
      break;
    }

    if (oldestTrace.events.length > 0) {
      oldestTrace.events.shift();
    }

    if (oldestTrace.events.length === 0 && oldestTrace.finishedAt !== null) {
      cloned.pop();
    } else if (oldestTrace.events.length === 0) {
      break;
    }
  }

  return cloned;
};

const upsertEvent = (history: RunTrace[], runId: string, event: ExecutionLogEvent): RunTrace[] => {
  const nextHistory = history.map((trace) => {
    if (trace.runId !== runId) {
      return trace;
    }

    const existingIndex = trace.events.findIndex((item) => item.eventId === event.eventId);
    if (existingIndex === -1) {
      return {
        ...trace,
        events: [...trace.events, event]
      };
    }

    const events = [...trace.events];
    events[existingIndex] = event;

    return {
      ...trace,
      events
    };
  });

  return pruneHistory(nextHistory);
};

const updateRunStatus = (history: RunTrace[], runId: string, status: RunStatus): RunTrace[] => {
  return history.map((trace) => {
    if (trace.runId !== runId) {
      return trace;
    }

    const shouldFinish = status === 'idle' || status === 'stopped' || status === 'error';
    return {
      ...trace,
      status,
      finishedAt: shouldFinish ? Date.now() : trace.finishedAt
    };
  });
};

const EDGE_FLOW_ANIMATION_MS = 2000;
const EDGE_COMPLETED_TAIL_MS = 900;
const EDGE_TERMINAL_TAIL_MS = 1200;

const edgeStateTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

const clearEdgeTimersById = (edgeId: string): void => {
  const timers = edgeStateTimers.get(edgeId);
  if (!timers) {
    return;
  }

  for (const timerId of timers) {
    globalThis.clearTimeout(timerId);
  }

  edgeStateTimers.delete(edgeId);
};

const clearAllEdgeTimers = (): void => {
  for (const edgeId of edgeStateTimers.keys()) {
    clearEdgeTimersById(edgeId);
  }
};

export const useRunStore = create<RunState>((set, get) => {
  const runInternal = async (trigger: TelegramRunTrigger | null): Promise<boolean> => {
    const runState = get();
    if (runState.runStatus === 'running') {
      return false;
    }

    const editor = useEditorStore.getState();
    const settings = useSettingsStore.getState();

    const telegramBotIds = new Set(settings.telegramBots.map((bot) => bot.id));

    const validation = validateGraphForRun(editor.nodes, editor.edges, {
      hasApiKey: settings.apiKey.trim().length > 0,
      maxIterations: editor.metadata.maxIterations,
      telegramBotIds
    });

    set({ validationResult: validation });

    if (!validation.isValid) {
      return false;
    }

    clearAllEdgeTimers();

    const runId = createId();
    const snapshot = createRunSnapshot(runId, editor.nodes, editor.edges);
    const initialCounterProgressByNodeId = Object.fromEntries(
      editor.nodes
        .filter((node) => node.type === NodeType.COUNTER)
        .map((node) => {
          const total = Number.isInteger(node.data.passes) && node.data.passes > 0 ? node.data.passes : 0;
          return [
            node.id,
            {
              remaining: total,
              total
            }
          ];
        })
    ) as Record<string, CounterRuntimeProgress>;
    const countedCounterCompletedEventIds = new Set<string>();

    const providerCache = new Map<string, ReturnType<typeof createProvider>>();
    const resolveProvider = (provider: 'openai') => {
      const cacheKey = `${provider}:${settings.apiKey}`;
      if (!providerCache.has(cacheKey)) {
        providerCache.set(cacheKey, createProvider(provider, settings.apiKey));
      }
      const instance = providerCache.get(cacheKey);
      if (!instance) {
        throw new Error('Не удалось инициализировать провайдер.');
      }
      return instance;
    };

    const telegramBotsById = Object.fromEntries(settings.telegramBots.map((bot) => [bot.id, bot])) as Record<
      string,
      (typeof settings.telegramBots)[number]
    >;

    const runTrace: RunTrace = {
      runId,
      status: 'running',
      startedAt: Date.now(),
      finishedAt: null,
      events: []
    };

    useEditorStore.getState().setLocked(true);

    const triggerInputByNodeId = trigger
      ? {
          [trigger.nodeId]: {
            text: trigger.text,
            telegramContext: trigger.context
          }
        }
      : undefined;

    const engine = new ExecutionEngine({
      snapshot,
      config: {
        maxIterations: editor.metadata.maxIterations,
        startNodeIdsOverride: trigger ? [trigger.nodeId] : undefined,
        triggerInputByNodeId
      },
      resolveProvider,
      callbacks: {
        onEvent: (event) => {
          set((current) => {
            const nextOutputByNodeId =
              event.nodeType === NodeType.OUTPUT && event.status === 'completed'
                ? {
                    ...current.nodeOutputByNodeId,
                    [event.nodeId]: event.outputText
                  }
                : current.nodeOutputByNodeId;

            let nextCounterProgressByNodeId = current.counterProgressByNodeId;
            if (
              event.nodeType === NodeType.COUNTER &&
              event.status === 'completed' &&
              !countedCounterCompletedEventIds.has(event.eventId)
            ) {
              countedCounterCompletedEventIds.add(event.eventId);
              const currentProgress = current.counterProgressByNodeId[event.nodeId] ?? { remaining: 0, total: 0 };
              nextCounterProgressByNodeId = {
                ...current.counterProgressByNodeId,
                [event.nodeId]: {
                  ...currentProgress,
                  remaining: Math.max(0, currentProgress.remaining - 1)
                }
              };
            }

            return {
              runHistory: upsertEvent(current.runHistory, runId, event),
              nodeOutputByNodeId: nextOutputByNodeId,
              counterProgressByNodeId: nextCounterProgressByNodeId
            };
          });
        },
        onNodeState: (nodeId, state) => {
          set((current) => ({
            nodeExecutionState: {
              ...current.nodeExecutionState,
              [nodeId]: state
            }
          }));
        },
        onEdgeState: (edgeId, state) => {
          clearEdgeTimersById(edgeId);

          if (state === 'running') {
            set((current) => ({
              edgeExecutionState: {
                ...current.edgeExecutionState,
                [edgeId]: 'running'
              },
              edgeAnimationTickById: {
                ...current.edgeAnimationTickById,
                [edgeId]: (current.edgeAnimationTickById[edgeId] ?? 0) + 1
              }
            }));
            return;
          }

          if (state === 'completed') {
            const isCurrentlyRunning = get().edgeExecutionState[edgeId] === 'running';
            const completeDelay = isCurrentlyRunning ? EDGE_FLOW_ANIMATION_MS : 0;

            const completeTimer = globalThis.setTimeout(() => {
              set((current) => ({
                edgeExecutionState: {
                  ...current.edgeExecutionState,
                  [edgeId]: 'completed'
                }
              }));
            }, completeDelay);

            const idleTimer = globalThis.setTimeout(() => {
              set((current) => ({
                edgeExecutionState: {
                  ...current.edgeExecutionState,
                  [edgeId]: 'idle'
                }
              }));
              clearEdgeTimersById(edgeId);
            }, completeDelay + EDGE_COMPLETED_TAIL_MS);

            edgeStateTimers.set(edgeId, [completeTimer, idleTimer]);
            return;
          }

          set((current) => ({
            edgeExecutionState: {
              ...current.edgeExecutionState,
              [edgeId]: state
            }
          }));

          const idleTimer = globalThis.setTimeout(() => {
            set((current) => ({
              edgeExecutionState: {
                ...current.edgeExecutionState,
                [edgeId]: 'idle'
              }
            }));
            clearEdgeTimersById(edgeId);
          }, EDGE_TERMINAL_TAIL_MS);

          edgeStateTimers.set(edgeId, [idleTimer]);
        },
        onRunStatus: (status) => {
          set((current) => ({
            runStatus: status,
            runHistory: updateRunStatus(current.runHistory, runId, status)
          }));

          if (status === 'idle' || status === 'stopped' || status === 'error') {
            useEditorStore.getState().setLocked(false);
          }
        },
        onTelegramOutput: async ({ botId, chatId, text, signal }) => {
          const bot = telegramBotsById[botId];
          if (!bot) {
            throw new Error('Выбранный Telegram-бот не найден в настройках API.');
          }

          await sendTelegramMessage(bot, chatId, text, signal);
        }
      }
    });

    set((current) => ({
      runStatus: 'running',
      currentRunId: runId,
      runHistory: [runTrace, ...current.runHistory],
      nodeExecutionState: {},
      edgeExecutionState: {},
      edgeAnimationTickById: {},
      nodeOutputByNodeId: {},
      counterProgressByNodeId: initialCounterProgressByNodeId,
      activeEngine: engine
    }));

    try {
      await engine.run();
      return true;
    } catch {
      return false;
    } finally {
      set({ activeEngine: null });
      if (get().runStatus === 'running') {
        set((current) => ({
          runStatus: 'idle',
          runHistory: updateRunStatus(current.runHistory, runId, 'idle')
        }));
        useEditorStore.getState().setLocked(false);
      }
    }
  };

  return {
    runStatus: 'idle',
    currentRunId: null,
    runHistory: [],
    validationResult: null,
    nodeExecutionState: {},
    edgeExecutionState: {},
    edgeAnimationTickById: {},
    nodeOutputByNodeId: {},
    counterProgressByNodeId: {},
    logViewMode: 'compact',
    activeEngine: null,
    setLogViewMode: (mode) => set({ logViewMode: mode }),
    clearLog: () => {
      clearAllEdgeTimers();
      set({
        runHistory: [],
        currentRunId: null,
        nodeExecutionState: {},
        edgeExecutionState: {},
        edgeAnimationTickById: {},
        nodeOutputByNodeId: {},
        counterProgressByNodeId: {},
        validationResult: null
      });
    },
    setValidationResult: (result) => set({ validationResult: result }),
    startRun: async () => runInternal(null),
    startTelegramTriggeredRun: async (trigger) => runInternal(trigger),
    stopRun: () => {
      const engine = get().activeEngine;
      if (!engine) {
        return;
      }

      clearAllEdgeTimers();
      engine.stop();
      set((current) => ({
        runStatus: 'stopped',
        runHistory: current.currentRunId
          ? updateRunStatus(current.runHistory, current.currentRunId, 'stopped')
          : current.runHistory,
        edgeExecutionState: Object.fromEntries(
          Object.entries(current.edgeExecutionState).map(([edgeId, state]) => [edgeId, state === 'running' ? 'aborted' : state])
        ),
        activeEngine: null
      }));
      useEditorStore.getState().setLocked(false);
    }
  };
});

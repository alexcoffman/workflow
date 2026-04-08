import { describe, expect, it } from 'vitest';

import type { FlowEdge } from '../domain/edges';
import type { ExecutionLogEvent } from '../domain/logs';
import type { FlowNode } from '../domain/nodes';
import type { RunStatus } from '../domain/run';
import { ExecutionEngine } from '../engine/execution-engine';
import { createRunSnapshot } from '../engine/snapshot';

import {
  makeCounterNode,
  ScriptedProvider,
  makeDecisionNode,
  makeEdge,
  makeMergeNode,
  makeModelNode,
  makeNoteNode,
  makeOutputNode,
  makeProviderResponse,
  makeStartNode,
  makeTextNode
} from './test-utils';

interface EngineRunResult {
  finalStatus: RunStatus;
  events: ExecutionLogEvent[];
  statuses: RunStatus[];
}

const runWithProvider = async (
  nodes: FlowNode[],
  edges: FlowEdge[],
  provider: ScriptedProvider,
  maxIterations: number | null
): Promise<EngineRunResult> => {
  const snapshot = createRunSnapshot('run-test', nodes, edges);
  const statuses: RunStatus[] = [];
  const eventsById = new Map<string, ExecutionLogEvent>();
  const eventOrder: string[] = [];

  const engine = new ExecutionEngine({
    snapshot,
    config: { maxIterations },
    resolveProvider: () => provider,
    callbacks: {
      onEvent: (event) => {
        if (!eventsById.has(event.eventId)) {
          eventOrder.push(event.eventId);
        }
        eventsById.set(event.eventId, event);
      },
      onNodeState: () => undefined,
      onEdgeState: () => undefined,
      onRunStatus: (status) => statuses.push(status)
    }
  });

  const finalStatus = await engine.run();

  return {
    finalStatus,
    statuses,
    events: eventOrder
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is ExecutionLogEvent => Boolean(event))
  };
};

describe('execution engine', () => {
  it('runs linear flow (TEXT -> MODEL -> MODEL)', async () => {
    const text = makeTextNode('text', 'hello world', 'Input');
    const modelA = makeModelNode('model-a', { requireAllInputs: true }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: true }, 'Model B');

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`response-${index + 1}`));

    const { finalStatus, events } = await runWithProvider(
      [text, modelA, modelB],
      [makeEdge('e1', text.id, modelA.id, 0), makeEdge('e2', modelA.id, modelB.id, 1)],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(2);

    const completed = events.filter((event) => event.status === 'completed');
    expect(completed.map((event) => event.nodeId)).toEqual(['text', 'model-a', 'model-b']);
  });

  it('runs flow from START block', async () => {
    const start = makeStartNode('start', 'seed text', 'Start');
    const model = makeModelNode('model', { requireAllInputs: true }, 'Model');
    const provider = new ScriptedProvider(async () => makeProviderResponse('ok'));

    const { finalStatus, events } = await runWithProvider([start, model], [makeEdge('e1', start.id, model.id, 0)], provider, null);

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(1);

    const completed = events.filter((event) => event.status === 'completed').map((event) => event.nodeId);
    expect(completed).toEqual(['start', 'model']);
  });

  it('runs START -> TEXT -> MODEL and uses text node output as model input', async () => {
    const start = makeStartNode('start', 'start signal', 'Start');
    const text = makeTextNode('text', 'This is selected start text', 'Text');
    const model = makeModelNode('model', { requireAllInputs: true }, 'Model');
    const provider = new ScriptedProvider(async () => makeProviderResponse('ok'));

    const { finalStatus, events } = await runWithProvider(
      [start, text, model],
      [makeEdge('e1', start.id, text.id, 0), makeEdge('e2', text.id, model.id, 1)],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.input.includes('This is selected start text')).toBe(true);
    expect(provider.calls[0]?.input.includes('start signal')).toBe(false);

    const completed = events.filter((event) => event.status === 'completed').map((event) => event.nodeId);
    expect(completed).toEqual(['start', 'text', 'model']);
  });

  it('runs branching + merge flow', async () => {
    const text = makeTextNode('text', 'seed', 'Seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: true }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: true }, 'Model B');
    const merge = makeMergeNode('merge', { mode: 'join_with_labels' }, 'Merge');
    const modelC = makeModelNode('model-c', { requireAllInputs: true }, 'Model C');

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`m-${index + 1}`));

    const { events } = await runWithProvider(
      [text, modelA, modelB, merge, modelC],
      [
        makeEdge('e1', text.id, modelA.id, 0),
        makeEdge('e2', text.id, modelB.id, 1),
        makeEdge('e3', modelA.id, merge.id, 2, 'output', 'merge-input-1'),
        makeEdge('e4', modelB.id, merge.id, 3, 'output', 'merge-input-2'),
        makeEdge('e5', merge.id, modelC.id, 4)
      ],
      provider,
      null
    );

    const mergeEvent = events.find((event) => event.nodeId === 'merge' && event.status === 'completed');
    expect(mergeEvent).toBeDefined();

    const modelCEvent = events.find((event) => event.nodeId === 'model-c' && event.status === 'completed');
    expect(modelCEvent).toBeDefined();
  });

  it('waits all merge inputs when requireAllInputs is enabled', async () => {
    const textA = makeTextNode('a-text', 'A', 'Text A');
    const textB = makeTextNode('b-text', 'B', 'Text B');
    const merge = makeMergeNode('merge', { mode: 'join_with_labels', requireAllInputs: true }, 'Merge');

    const provider = new ScriptedProvider(async () => makeProviderResponse('unused'));

    const { events, finalStatus } = await runWithProvider(
      [textA, textB, merge],
      [
        makeEdge('e1', textA.id, merge.id, 0, 'output', 'merge-input-1'),
        makeEdge('e2', textB.id, merge.id, 1, 'output', 'merge-input-2')
      ],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    const completedMergeEvents = events.filter((event) => event.nodeId === merge.id && event.status === 'completed');
    expect(completedMergeEvents).toHaveLength(1);
    expect(completedMergeEvents[0]?.outputText).toContain('[Text A]');
    expect(completedMergeEvents[0]?.outputText).toContain('[Text B]');
    expect(events.some((event) => event.nodeId === merge.id && event.status === 'failed')).toBe(false);
  });

  it('can emit partial merge output when requireAllInputs is disabled', async () => {
    const textA = makeTextNode('a-text', 'A', 'Text A');
    const textB = makeTextNode('b-text', 'B', 'Text B');
    const merge = makeMergeNode('merge', { mode: 'join_with_labels', requireAllInputs: false }, 'Merge');

    const provider = new ScriptedProvider(async () => makeProviderResponse('unused'));

    const { events, finalStatus } = await runWithProvider(
      [textA, textB, merge],
      [
        makeEdge('e1', textA.id, merge.id, 0, 'output', 'merge-input-1'),
        makeEdge('e2', textB.id, merge.id, 1, 'output', 'merge-input-2')
      ],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    const completedMergeEvents = events.filter((event) => event.nodeId === merge.id && event.status === 'completed');
    expect(completedMergeEvents).toHaveLength(2);
    expect(completedMergeEvents[0]?.outputText).toContain('[Text A]');
    expect(completedMergeEvents[0]?.outputText).not.toContain('[Text B]');
    expect(completedMergeEvents[1]?.outputText).toContain('[Text A]');
    expect(completedMergeEvents[1]?.outputText).toContain('[Text B]');
  });

  it('resolves merge custom template placeholders {{input-name-X}} and {{input-value-X}}', async () => {
    const text = makeTextNode('text', 'seed', 'Seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: true }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: true }, 'Model B');
    const merge = makeMergeNode(
      'merge',
      {
        mode: 'custom_template',
        template:
          '[{{input-name-1}}]: {{input-value-1}} | [{{input-name-2}}]: {{input-value-2}} | count={{count}}'
      },
      'Merge'
    );

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`m-${index + 1}`));

    const { events } = await runWithProvider(
      [text, modelA, modelB, merge],
      [
        makeEdge('e1', text.id, modelA.id, 0),
        makeEdge('e2', text.id, modelB.id, 1),
        makeEdge('e3', modelA.id, merge.id, 2, 'output', 'merge-input-1'),
        makeEdge('e4', modelB.id, merge.id, 3, 'output', 'merge-input-2')
      ],
      provider,
      null
    );

    const mergeEvent = events.find((event) => event.nodeId === 'merge' && event.status === 'completed');
    expect(mergeEvent).toBeDefined();
    expect(mergeEvent?.outputText).toContain('[Model A]: m-1');
    expect(mergeEvent?.outputText).toContain('[Model B]: m-2');
    expect(mergeEvent?.outputText).toContain('count=2');
  });

  it('routes DECISION node by model output (yes / no / other)', async () => {
    const start = makeStartNode('start', 'Проверь условие', 'Start');
    const decision = makeDecisionNode('decision', { requireAllInputs: true }, 'Решение');
    const yesOut = makeOutputNode('out-yes', 'Да');
    const noOut = makeOutputNode('out-no', 'Нет');
    const otherOut = makeOutputNode('out-other', 'Другое');

    const nodes = [start, decision, yesOut, noOut, otherOut];
    const edges = [
      makeEdge('e1', start.id, decision.id, 0),
      makeEdge('e2', decision.id, yesOut.id, 1, 'decision-yes', 'input'),
      makeEdge('e3', decision.id, noOut.id, 2, 'decision-no', 'input'),
      makeEdge('e4', decision.id, otherOut.id, 3, 'decision-other', 'input')
    ];

    const providerYes = new ScriptedProvider(async () => makeProviderResponse('Да'));
    const runYes = await runWithProvider(nodes, edges, providerYes, null);
    expect(runYes.events.some((event) => event.nodeId === yesOut.id && event.status === 'completed')).toBe(true);
    expect(runYes.events.some((event) => event.nodeId === noOut.id && event.status === 'completed')).toBe(false);
    expect(runYes.events.some((event) => event.nodeId === otherOut.id && event.status === 'completed')).toBe(false);

    const providerNo = new ScriptedProvider(async () => makeProviderResponse('нет'));
    const runNo = await runWithProvider(nodes, edges, providerNo, null);
    expect(runNo.events.some((event) => event.nodeId === yesOut.id && event.status === 'completed')).toBe(false);
    expect(runNo.events.some((event) => event.nodeId === noOut.id && event.status === 'completed')).toBe(true);
    expect(runNo.events.some((event) => event.nodeId === otherOut.id && event.status === 'completed')).toBe(false);

    const providerOther = new ScriptedProvider(async () => makeProviderResponse('возможно'));
    const runOther = await runWithProvider(nodes, edges, providerOther, null);
    expect(runOther.events.some((event) => event.nodeId === yesOut.id && event.status === 'completed')).toBe(false);
    expect(runOther.events.some((event) => event.nodeId === noOut.id && event.status === 'completed')).toBe(false);
    expect(runOther.events.some((event) => event.nodeId === otherOut.id && event.status === 'completed')).toBe(true);
  });

  it('enforces deterministic queue order by nodeId for simultaneous start nodes', async () => {
    const textB = makeTextNode('b-node', 'B');
    const textA = makeTextNode('a-node', 'A');

    const provider = new ScriptedProvider(async () => makeProviderResponse('unused'));

    const { events } = await runWithProvider([textB, textA], [], provider, null);

    const completedNodeIds = events.filter((event) => event.status === 'completed').map((event) => event.nodeId);
    expect(completedNodeIds).toEqual(['a-node', 'b-node']);
  });

  it('supports retry in one event with attempts history', async () => {
    const text = makeTextNode('text', 'retry me');
    const model = makeModelNode('model', { requireAllInputs: true });

    const provider = new ScriptedProvider(async (_, index) => {
      if (index === 0) {
        throw new Error('network temporary failure');
      }
      return makeProviderResponse('recovered');
    });

    const { events } = await runWithProvider([text, model], [makeEdge('e1', text.id, model.id, 0)], provider, null);

    const modelEvent = events.find((event) => event.nodeId === model.id && event.status === 'completed');
    expect(modelEvent).toBeDefined();
    expect(modelEvent?.attemptCount).toBe(2);
    expect(modelEvent?.attempts.map((attempt) => attempt.status)).toEqual(['failed', 'completed']);
  });

  it('omits temperature for models that do not support this parameter', async () => {
    const start = makeStartNode('start', 'seed');
    const model = makeModelNode('model', { model: 'gpt-5.2', temperature: 0.9 });
    const provider = new ScriptedProvider(async () => makeProviderResponse('ok'));

    const { finalStatus } = await runWithProvider([start, model], [makeEdge('e1', start.id, model.id, 0)], provider, null);

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.temperature).toBeUndefined();
  });

  it('supports requireAllInputs based on incoming edges count from snapshot', async () => {
    const textA = makeTextNode('text-a', 'A');
    const textB = makeTextNode('text-b', 'B');

    const modelStrict = makeModelNode('model-strict', { requireAllInputs: true });
    const providerStrict = new ScriptedProvider(async () => makeProviderResponse('strict'));

    await runWithProvider(
      [textA, textB, modelStrict],
      [makeEdge('e1', textA.id, modelStrict.id, 0), makeEdge('e2', textB.id, modelStrict.id, 1)],
      providerStrict,
      null
    );

    expect(providerStrict.calls).toHaveLength(1);

    const modelPartial = makeModelNode('model-partial', { requireAllInputs: false });
    const providerPartial = new ScriptedProvider(async () => makeProviderResponse('partial'));

    await runWithProvider(
      [textA, textB, modelPartial],
      [makeEdge('e3', textA.id, modelPartial.id, 0), makeEdge('e4', textB.id, modelPartial.id, 1)],
      providerPartial,
      null
    );

    expect(providerPartial.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('does not execute model with empty input when graph is invalid', async () => {
    const model = makeModelNode('model-alone');
    const provider = new ScriptedProvider(async () => makeProviderResponse('never'));

    const { events, finalStatus } = await runWithProvider([model], [], provider, null);
    expect(finalStatus).toBe('idle');
    expect(events.length).toBe(0);
    expect(provider.calls.length).toBe(0);
  });

  it('copies incoming message in OUTPUT node', async () => {
    const text = makeTextNode('text', 'final answer');
    const output = makeOutputNode('output', 'Result');
    const provider = new ScriptedProvider(async () => makeProviderResponse('unused'));

    const { events, finalStatus } = await runWithProvider([text, output], [makeEdge('e1', text.id, output.id, 0)], provider, null);

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(0);

    const outputEvent = events.find((event) => event.nodeId === output.id && event.status === 'completed');
    expect(outputEvent).toBeDefined();
    expect(outputEvent?.outputText).toBe('final answer');
  });

  it('forwards OUTPUT node message to downstream MODEL node', async () => {
    const start = makeStartNode('start', 'start payload', 'Start');
    const output = makeOutputNode('output', 'Output');
    const model = makeModelNode('model', { requireAllInputs: true }, 'Model');

    const provider = new ScriptedProvider(async () => makeProviderResponse('ok'));

    const { events, finalStatus } = await runWithProvider(
      [start, output, model],
      [makeEdge('e1', start.id, output.id, 0), makeEdge('e2', output.id, model.id, 1)],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.input.includes('start payload')).toBe(true);

    const completed = events.filter((event) => event.status === 'completed').map((event) => event.nodeId);
    expect(completed).toEqual(['start', 'output', 'model']);
  });

  it('routes COUNTER through intermediate output until passes end, then uses final output', async () => {
    const start = makeStartNode('start', 'counter input');
    const counter = makeCounterNode('counter', { passes: 2 }, 'Counter');
    const model = makeModelNode('model', { requireAllInputs: true }, 'Model');
    const finalOutput = makeOutputNode('final-output', 'Final');

    const provider = new ScriptedProvider(async () => makeProviderResponse('loop back'));

    const { events, finalStatus } = await runWithProvider(
      [start, counter, model, finalOutput],
      [
        makeEdge('e1', start.id, counter.id, 0),
        makeEdge('e2', counter.id, model.id, 1, 'counter-intermediate', 'input'),
        makeEdge('e3', model.id, counter.id, 2),
        makeEdge('e4', counter.id, finalOutput.id, 3, 'counter-final', 'input')
      ],
      provider,
      4
    );

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(1);
    expect(events.some((event) => event.nodeId === finalOutput.id && event.status === 'completed')).toBe(true);
  });

  it('routes COUNTER directly to final output when passes = 1', async () => {
    const start = makeStartNode('start', 'only once');
    const counter = makeCounterNode('counter', { passes: 1 }, 'Counter');
    const model = makeModelNode('model', { requireAllInputs: true }, 'Model');
    const finalOutput = makeOutputNode('final-output', 'Final');

    const provider = new ScriptedProvider(async () => makeProviderResponse('should not run'));

    const { events, finalStatus } = await runWithProvider(
      [start, counter, model, finalOutput],
      [
        makeEdge('e1', start.id, counter.id, 0),
        makeEdge('e2', counter.id, model.id, 1, 'counter-intermediate', 'input'),
        makeEdge('e3', counter.id, finalOutput.id, 2, 'counter-final', 'input')
      ],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(0);
    expect(events.some((event) => event.nodeId === finalOutput.id && event.status === 'completed')).toBe(true);
  });

  it('stops run and aborts active request', async () => {
    const text = makeTextNode('text', 'abort seed');
    const model = makeModelNode('model');

    const provider = new ScriptedProvider(
      async (request) =>
        new Promise((resolve, reject) => {
          const onAbort = () => {
            reject(new Error('aborted by user'));
          };
          request.signal.addEventListener('abort', onAbort, { once: true });
          setTimeout(() => {
            request.signal.removeEventListener('abort', onAbort);
            resolve(makeProviderResponse('late response'));
          }, 10_000);
        })
    );

    const snapshot = createRunSnapshot('run-stop', [text, model], [makeEdge('e1', text.id, model.id, 0)]);
    const eventsById = new Map<string, ExecutionLogEvent>();
    const order: string[] = [];

    const engine = new ExecutionEngine({
      snapshot,
      config: { maxIterations: null },
      resolveProvider: () => provider,
      callbacks: {
        onEvent: (event) => {
          if (!eventsById.has(event.eventId)) {
            order.push(event.eventId);
          }
          eventsById.set(event.eventId, event);
        },
        onNodeState: () => undefined,
        onEdgeState: () => undefined,
        onRunStatus: () => undefined
      }
    });

    const runPromise = engine.run();
    setTimeout(() => {
      engine.stop();
    }, 25);

    const finalStatus = await runPromise;
    const events = order
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is ExecutionLogEvent => Boolean(event));

    expect(finalStatus).toBe('stopped');
    expect(events.some((event) => event.status === 'aborted')).toBe(true);
  });

  it('enforces cycle limit and logs skipped events', async () => {
    const seed = makeTextNode('seed', 'start', 'Seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: false }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: false }, 'Model B');

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`loop-${index}`));

    const { events } = await runWithProvider(
      [seed, modelA, modelB],
      [makeEdge('e1', seed.id, modelA.id, 0), makeEdge('e2', modelA.id, modelB.id, 1), makeEdge('e3', modelB.id, modelA.id, 2)],
      provider,
      1
    );

    expect(events.some((event) => event.status === 'skipped')).toBe(true);
    expect(events.filter((event) => event.status === 'completed').every((event) => event.iteration <= 1)).toBe(true);
  });

  it('bootstraps cycle when MODEL has requireAllInputs and one seed input', async () => {
    const seed = makeTextNode('seed', 'старт цикла', 'Seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: true }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: true }, 'Model B');

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`cycle-${index + 1}`));

    const { events } = await runWithProvider(
      [seed, modelA, modelB],
      [makeEdge('e1', seed.id, modelA.id, 0), makeEdge('e2', modelA.id, modelB.id, 1), makeEdge('e3', modelB.id, modelA.id, 2)],
      provider,
      3
    );

    const completedModelA = events.filter((event) => event.nodeId === 'model-a' && event.status === 'completed');
    const completedModelB = events.filter((event) => event.nodeId === 'model-b' && event.status === 'completed');

    expect(completedModelA.length).toBeGreaterThan(0);
    expect(completedModelB.length).toBeGreaterThan(0);
  });

  it('executes TEXT only at run start and ignores it in recursive iterations', async () => {
    const seed = makeTextNode('seed', 'начальный текст', 'Seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: true }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: true }, 'Model B');

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`recursive-${index + 1}`));

    const { events } = await runWithProvider(
      [seed, modelA, modelB],
      [makeEdge('e1', seed.id, modelA.id, 0), makeEdge('e2', modelA.id, modelB.id, 1), makeEdge('e3', modelB.id, modelA.id, 2)],
      provider,
      3
    );

    const completedTextEvents = events.filter((event) => event.nodeId === seed.id && event.status === 'completed');
    expect(completedTextEvents).toHaveLength(1);
    expect(completedTextEvents[0]?.iteration).toBe(1);

    const recursiveModelAEvents = events.filter(
      (event) => event.nodeId === modelA.id && event.status === 'completed' && event.iteration > 1
    );
    expect(recursiveModelAEvents.length).toBeGreaterThan(0);
    for (const event of recursiveModelAEvents) {
      expect(event.inputText.includes('[Source: Seed')).toBe(false);
    }
  });

  it('keeps iteration isolation (no old/new message mixing)', async () => {
    const seed = makeTextNode('seed', 'seed text', 'Seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: false }, 'Model A');
    const modelB = makeModelNode('model-b', { requireAllInputs: false }, 'Model B');

    const provider = new ScriptedProvider(async (_, index) => makeProviderResponse(`reply-${index}`));

    const { events } = await runWithProvider(
      [seed, modelA, modelB],
      [makeEdge('e1', seed.id, modelA.id, 0), makeEdge('e2', modelA.id, modelB.id, 1), makeEdge('e3', modelB.id, modelA.id, 2)],
      provider,
      2
    );

    const secondIterationEvents = events.filter(
      (event) => event.status === 'completed' && event.iteration === 2 && (event.nodeId === 'model-a' || event.nodeId === 'model-b')
    );

    expect(secondIterationEvents.length).toBeGreaterThan(0);
    for (const event of secondIterationEvents) {
      expect(event.inputText.includes('[Source: Seed')).toBe(false);
    }
  });

  it('uses immutable snapshot even if source nodes mutate after snapshot creation', async () => {
    const text = makeTextNode('text', 'original message', 'Text');
    const model = makeModelNode('model');
    const nodes = [text, model];
    const edges = [makeEdge('e1', text.id, model.id, 0)];

    const provider = new ScriptedProvider(async (request) => makeProviderResponse(request.input));

    const snapshot = createRunSnapshot('run-snapshot', nodes, edges);
    text.data.text = 'mutated message';

    const engine = new ExecutionEngine({
      snapshot,
      config: { maxIterations: null },
      resolveProvider: () => provider,
      callbacks: {
        onEvent: () => undefined,
        onNodeState: () => undefined,
        onEdgeState: () => undefined,
        onRunStatus: () => undefined
      }
    });

    await engine.run();

    expect(provider.calls[0]?.input.includes('original message')).toBe(true);
    expect(provider.calls[0]?.input.includes('mutated message')).toBe(false);
  });

  it('ignores NOTE nodes in execution', async () => {
    const text = makeTextNode('text', 'hello');
    const note = makeNoteNode('note', 'memo');
    const model = makeModelNode('model');

    const provider = new ScriptedProvider(async () => makeProviderResponse('ok'));

    const { events } = await runWithProvider(
      [text, note, model],
      [makeEdge('e1', text.id, model.id, 0)],
      provider,
      null
    );

    expect(events.some((event) => event.nodeType === 'NOTE')).toBe(false);
  });

  it('skips deactivated node and stops branch propagation on it', async () => {
    const start = makeStartNode('start', 'seed');
    const model = makeModelNode('model', { isActive: false }, 'Model');
    const output = makeOutputNode('output', 'Output');
    const provider = new ScriptedProvider(async () => makeProviderResponse('should not run'));

    const { events, finalStatus } = await runWithProvider(
      [start, model, output],
      [makeEdge('e1', start.id, model.id, 0), makeEdge('e2', model.id, output.id, 1)],
      provider,
      null
    );

    expect(finalStatus).toBe('idle');
    expect(provider.calls).toHaveLength(0);
    expect(events.some((event) => event.nodeId === model.id && event.status === 'skipped')).toBe(true);
    expect(events.some((event) => event.nodeId === output.id && event.status === 'completed')).toBe(false);
  });

  it('deduplicates repeated enqueue of same fingerprint', async () => {
    const text = makeTextNode('text-a', 'hello');
    const provider = new ScriptedProvider(async () => makeProviderResponse('unused'));

    const snapshot = createRunSnapshot('run-dedup', [text], []);
    const eventsById = new Map<string, ExecutionLogEvent>();
    const order: string[] = [];

    const engine = new ExecutionEngine({
      snapshot,
      config: { maxIterations: null },
      resolveProvider: () => provider,
      callbacks: {
        onEvent: (event) => {
          if (!eventsById.has(event.eventId)) {
            order.push(event.eventId);
          }
          eventsById.set(event.eventId, event);
        },
        onNodeState: () => undefined,
        onEdgeState: () => undefined,
        onRunStatus: () => undefined
      }
    });

    const hack = engine as unknown as {
      enqueueReadyNodes: (items: Array<{ nodeId: string; iteration: number; parentEventId: string | null }>) => void;
    };

    hack.enqueueReadyNodes([
      { nodeId: text.id, iteration: 1, parentEventId: null },
      { nodeId: text.id, iteration: 1, parentEventId: null }
    ]);

    await engine.run();

    const events = order
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is ExecutionLogEvent => Boolean(event));

    expect(events.filter((event) => event.nodeId === text.id && event.status === 'completed')).toHaveLength(1);
  });

  it('does not execute TEXT as a downstream node after run start', async () => {
    const sourceText = makeTextNode('text-source', 'seed');
    const model = makeModelNode('model');
    const downstreamText = makeTextNode('text-downstream', 'should-not-run');

    const provider = new ScriptedProvider(async () => makeProviderResponse('ok'));

    const { events } = await runWithProvider(
      [sourceText, model, downstreamText],
      [makeEdge('e1', sourceText.id, model.id, 0), makeEdge('e2', model.id, downstreamText.id, 1)],
      provider,
      null
    );

    expect(events.some((event) => event.nodeId === downstreamText.id && event.status === 'completed')).toBe(false);
  });
});



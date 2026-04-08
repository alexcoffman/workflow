import { describe, expect, it } from 'vitest';

import { HANDLE_IDS } from '../domain/constants';
import { validateGraphForRun } from '../engine/validation';

import {
  makeCounterNode,
  makeEdge,
  makeMergeNode,
  makeModelNode,
  makeOutputNode,
  makeStartNode,
  makeTextNode
} from './test-utils';

describe('graph validation', () => {
  it('returns GRAPH_EMPTY for empty graph', () => {
    const result = validateGraphForRun([], [], { hasApiKey: true, maxIterations: null });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.code === 'GRAPH_EMPTY')).toBe(true);
  });

  it('returns NO_START_NODE when graph has no start block', () => {
    const text = makeTextNode('text-a', 'hello');

    const result = validateGraphForRun([text], [], { hasApiKey: true, maxIterations: null });
    expect(result.errors.some((error) => error.code === 'NO_START_NODE')).toBe(true);
  });

  it('returns MISSING_API_KEY when active model nodes exist', () => {
    const start = makeStartNode('start-a', 'seed');
    const model = makeModelNode('model-a');

    const result = validateGraphForRun([start, model], [makeEdge('edge-a', start.id, model.id, 0)], {
      hasApiKey: false,
      maxIterations: null
    });

    expect(result.errors.some((error) => error.code === 'MISSING_API_KEY')).toBe(true);
  });

  it('does not return MISSING_API_KEY when model node is disconnected from active chain', () => {
    const start = makeStartNode('start-a', 'seed');
    const output = makeOutputNode('output-a');
    const disconnectedModel = makeModelNode('model-a');

    const result = validateGraphForRun(
      [start, output, disconnectedModel],
      [makeEdge('edge-a', start.id, output.id, 0)],
      { hasApiKey: false, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'MISSING_API_KEY')).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('does not require API key for deactivated model in active branch', () => {
    const start = makeStartNode('start-a', 'seed');
    const deactivatedModel = makeModelNode('model-a', { isActive: false });

    const result = validateGraphForRun([start, deactivatedModel], [makeEdge('edge-a', start.id, deactivatedModel.id, 0)], {
      hasApiKey: false,
      maxIterations: null
    });

    expect(result.errors.some((error) => error.code === 'MISSING_API_KEY')).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('ignores disconnected nodes and validates only active chain from START', () => {
    const start = makeStartNode('start-a', 'seed');
    const output = makeOutputNode('output-a');

    const orphanText = makeTextNode('text-orphan', '   ');
    const orphanMerge = makeMergeNode('merge-orphan');
    const orphanCounter = makeCounterNode('counter-orphan');
    const orphanOutput = makeOutputNode('output-orphan');
    const orphanModel = makeModelNode('model-orphan', { model: '' });

    const result = validateGraphForRun(
      [start, output, orphanText, orphanMerge, orphanCounter, orphanOutput, orphanModel],
      [makeEdge('edge-active', start.id, output.id, 0)],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('returns EMPTY_START_NODE when active start text is blank', () => {
    const start = makeStartNode('start-a', '   ');
    const output = makeOutputNode('output-a');

    const result = validateGraphForRun([start, output], [makeEdge('edge-a', start.id, output.id, 0)], {
      hasApiKey: true,
      maxIterations: null
    });

    expect(result.errors.some((error) => error.code === 'EMPTY_START_NODE')).toBe(true);
  });

  it('returns EMPTY_TEXT_NODE for active text node', () => {
    const start = makeStartNode('start-a', 'seed');
    const text = makeTextNode('text-a', '   ');
    const output = makeOutputNode('output-a');

    const result = validateGraphForRun(
      [start, text, output],
      [makeEdge('edge-1', start.id, text.id, 0), makeEdge('edge-2', text.id, output.id, 1)],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'EMPTY_TEXT_NODE')).toBe(true);
  });

  it('returns COUNTER_NODE_INVALID_PASSES when active counter has invalid passes', () => {
    const start = makeStartNode('start-a', 'seed');
    const counter = makeCounterNode('counter-a', { passes: 0 });
    const output = makeOutputNode('output-a');

    const result = validateGraphForRun(
      [start, counter, output],
      [
        makeEdge('edge-1', start.id, counter.id, 0),
        makeEdge('edge-2', counter.id, output.id, 1, HANDLE_IDS.counterOutputFinal, HANDLE_IDS.defaultInput)
      ],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'COUNTER_NODE_INVALID_PASSES')).toBe(true);
  });

  it('returns INVALID_EDGE for active invalid connection into TEXT', () => {
    const start = makeStartNode('start-a', 'seed');
    const model = makeModelNode('model-a');
    const text = makeTextNode('text-a', 'hello');

    const result = validateGraphForRun(
      [start, model, text],
      [makeEdge('edge-1', start.id, model.id, 0), makeEdge('edge-2', model.id, text.id, 1)],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'INVALID_EDGE')).toBe(true);
  });

  it('returns CYCLE_WITHOUT_MAX_ITERATIONS only for active cycles', () => {
    const start = makeStartNode('start-a', 'seed');
    const modelA = makeModelNode('model-a', { requireAllInputs: false });
    const modelB = makeModelNode('model-b', { requireAllInputs: false });

    const result = validateGraphForRun(
      [start, modelA, modelB],
      [
        makeEdge('edge-1', start.id, modelA.id, 0),
        makeEdge('edge-2', modelA.id, modelB.id, 1),
        makeEdge('edge-3', modelB.id, modelA.id, 2)
      ],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'CYCLE_WITHOUT_MAX_ITERATIONS')).toBe(true);
  });

  it('ignores cycle in disconnected component', () => {
    const start = makeStartNode('start-a', 'seed');
    const output = makeOutputNode('output-a');
    const modelA = makeModelNode('model-a', { requireAllInputs: false });
    const modelB = makeModelNode('model-b', { requireAllInputs: false });

    const result = validateGraphForRun(
      [start, output, modelA, modelB],
      [
        makeEdge('edge-active', start.id, output.id, 0),
        makeEdge('edge-1', modelA.id, modelB.id, 1),
        makeEdge('edge-2', modelB.id, modelA.id, 2)
      ],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'CYCLE_WITHOUT_MAX_ITERATIONS')).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('returns EMPTY_CUSTOM_TEMPLATE for active merge custom_template without template', () => {
    const start = makeStartNode('start-a', 'seed');
    const text = makeTextNode('text-a', 'payload');
    const merge = makeMergeNode('merge-a', { mode: 'custom_template', template: '' });

    const result = validateGraphForRun(
      [start, text, merge],
      [makeEdge('edge-1', start.id, text.id, 0), makeEdge('edge-2', text.id, merge.id, 1, 'output', 'merge-input-1')],
      {
        hasApiKey: true,
        maxIterations: null
      }
    );

    expect(result.errors.some((error) => error.code === 'EMPTY_CUSTOM_TEMPLATE')).toBe(true);
  });

  it('returns INVALID_EDGE when two edges use the same merge input handle', () => {
    const start = makeStartNode('start-a', 'seed');
    const textA = makeTextNode('text-a', 'A');
    const textB = makeTextNode('text-b', 'B');
    const merge = makeMergeNode('merge-a');

    const result = validateGraphForRun(
      [start, textA, textB, merge],
      [
        makeEdge('edge-1', start.id, textA.id, 0),
        makeEdge('edge-2', start.id, textB.id, 1),
        makeEdge('edge-3', textA.id, merge.id, 2, 'output', 'merge-input-1'),
        makeEdge('edge-4', textB.id, merge.id, 3, 'output', 'merge-input-1')
      ],
      { hasApiKey: true, maxIterations: null }
    );

    expect(result.errors.some((error) => error.code === 'INVALID_EDGE')).toBe(true);
  });
});

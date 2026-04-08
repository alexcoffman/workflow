import { describe, expect, it } from 'vitest';

import { NodeType } from '../domain/node-types';
import { parseAndNormalizeSchema, serializeSchema } from '../lib/schema';

import { makeDecisionNode, makeEdge, makeMergeNode, makeModelNode, makeSchema, makeTextNode } from './test-utils';

describe('schema serialization', () => {
  it('serializes and parses schema payload', () => {
    const text = makeTextNode('text-a', 'hello');
    const model = makeModelNode('model-a');
    const decision = makeDecisionNode('decision-a');
    const schema = makeSchema(
      [text, model, decision],
      [makeEdge('edge-1', text.id, model.id, 0), makeEdge('edge-2', model.id, decision.id, 1)]
    );

    const json = serializeSchema(schema);
    const parsed = parseAndNormalizeSchema(json);

    expect(parsed.schema).not.toBeNull();
    expect(parsed.issues).toHaveLength(0);
    expect(parsed.schema?.schemaVersion).toBe('1.0.0');
    expect(parsed.schema?.nodes).toHaveLength(3);
    expect(parsed.schema?.edges[0].sortOrder).toBe(0);
  });

  it('fails on invalid schema version', () => {
    const payload = JSON.stringify({
      schemaVersion: '2.0.0',
      nodes: [],
      edges: [],
      metadata: {}
    });

    const parsed = parseAndNormalizeSchema(payload);

    expect(parsed.schema).toBeNull();
    expect(parsed.issues.some((issue) => issue.code === 'INVALID_SCHEMA_VERSION')).toBe(true);
  });

  it('does not include API key in exported schema', () => {
    const text = makeTextNode('text-a', 'hello');
    const schema = makeSchema([text], []);

    const json = serializeSchema(schema);
    expect(json.includes('app.openai.apiKey')).toBe(false);
    expect(json.toLowerCase().includes('apiKey'.toLowerCase())).toBe(false);
  });

  it('normalizes legacy merge handles to numbered merge-input-X', () => {
    const textA = makeTextNode('text-a', 'A');
    const textB = makeTextNode('text-b', 'B');
    const merge = makeMergeNode('merge-a');

    const legacySchema = makeSchema(
      [textA, textB, merge],
      [
        makeEdge('edge-1', textA.id, merge.id, 0, 'output', 'merge-input'),
        makeEdge('edge-2', textB.id, merge.id, 1, 'output', 'merge-input')
      ]
    );

    const parsed = parseAndNormalizeSchema(JSON.stringify(legacySchema));
    expect(parsed.schema).not.toBeNull();

    const targetHandles = (parsed.schema?.edges ?? []).map((edge) => edge.targetHandle);
    expect(targetHandles).toEqual(['merge-input-1', 'merge-input-2']);
  });

  it('defaults merge requireAllInputs to true when field is missing in legacy schema', () => {
    const merge = makeMergeNode('merge-a');
    const legacySchema = makeSchema([merge], []);

    const payload = JSON.parse(JSON.stringify(legacySchema)) as {
      nodes: Array<{
        type: string;
        data: Record<string, unknown>;
      }>;
    };

    const mergeNode = payload.nodes.find((node) => node.type === NodeType.MERGE);
    if (mergeNode) {
      delete mergeNode.data.requireAllInputs;
    }

    const parsed = parseAndNormalizeSchema(JSON.stringify(payload));
    expect(parsed.schema).not.toBeNull();

    const normalizedMergeNode = parsed.schema?.nodes.find((node) => node.type === NodeType.MERGE);
    expect(normalizedMergeNode).toBeDefined();
    expect(normalizedMergeNode?.type).toBe(NodeType.MERGE);
    if (normalizedMergeNode?.type === NodeType.MERGE) {
      expect(normalizedMergeNode.data.requireAllInputs).toBe(true);
    }
  });
});

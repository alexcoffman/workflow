import { describe, expect, it } from 'vitest';

import { mergeMessages, type MergeInputItem } from '../engine/merge';

import { makeMergeNode } from './test-utils';

const inputs: MergeInputItem[] = [
  {
    index: 1,
    sourceNodeId: 'a',
    sourceNodeTitle: 'Source A',
    value: 'Alpha'
  },
  {
    index: 2,
    sourceNodeId: 'b',
    sourceNodeTitle: 'Source B',
    value: 'Beta'
  }
];

describe('merge behavior', () => {
  it('plain_join uses separator between raw texts', () => {
    const node = makeMergeNode('merge-1', { mode: 'plain_join', separator: ' | ' });
    expect(mergeMessages(node, inputs)).toBe('Alpha | Beta');
  });

  it('join_with_labels includes source labels', () => {
    const node = makeMergeNode('merge-2', { mode: 'join_with_labels' });
    const output = mergeMessages(node, inputs);

    expect(output).toContain('[Source A]:');
    expect(output).toContain('[Source B]:');
    expect(output).toContain('Alpha');
    expect(output).toContain('Beta');
  });

  it('custom_template resolves numbered placeholders and count', () => {
    const node = makeMergeNode('merge-3', {
      mode: 'custom_template',
      template: 'Inputs: {{count}}\n1={{input-name-1}}/{{input-value-1}}\n2={{input-name-2}}/{{input-value-2}}'
    });

    const output = mergeMessages(node, inputs);
    expect(output).toContain('Inputs: 2');
    expect(output).toContain('1=Source A/Alpha');
    expect(output).toContain('2=Source B/Beta');
  });
});

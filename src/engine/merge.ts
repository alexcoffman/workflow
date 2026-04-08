import type { FlowMessage } from '../domain/messages';
import type { MergeNode } from '../domain/nodes';

export interface MergeInputItem {
  index: number;
  sourceNodeId: string;
  sourceNodeTitle: string;
  value: string;
}

export const formatLabeledInputs = (messages: FlowMessage[]): string => {
  return messages
    .map((message) => `[Source: ${message.sourceNodeTitle} | NodeId: ${message.sourceNodeId}]\n${message.text}`)
    .join('\n\n');
};

const renderJoinWithLabels = (inputs: MergeInputItem[]): string => {
  return inputs.map((input) => `[${input.sourceNodeTitle}]:\n${input.value}`).join('\n\n');
};

export const mergeMessages = (node: MergeNode, inputs: MergeInputItem[]): string => {
  const { mode, separator, template } = node.data;

  if (mode === 'plain_join') {
    return inputs.map((input) => input.value).join(separator);
  }

  const labeled = renderJoinWithLabels(inputs);

  if (mode === 'join_with_labels') {
    return labeled;
  }

  let output = template;

  output = output.split('{{count}}').join(String(inputs.length));

  for (const input of inputs) {
    output = output
      .split(`{{input-name-${input.index}}}`)
      .join(input.sourceNodeTitle)
      .split(`{{input-value-${input.index}}}`)
      .join(input.value);
  }

  output = output
    .replace(/\{\{input-name-\d+\}\}/g, '')
    .replace(/\{\{input-value-\d+\}\}/g, '')
    .split('{{inputs}}')
    .join(labeled);

  return output;
};

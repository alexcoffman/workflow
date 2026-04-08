import { NodeType } from '../../domain/node-types';

export const NODE_DND_MIME = 'application/x-workflow-node-type';

const validNodeTypes = new Set<string>(Object.values(NodeType));

export const parseDraggedNodeType = (value: string): NodeType | null => {
  if (!validNodeTypes.has(value)) {
    return null;
  }

  return value as NodeType;
};

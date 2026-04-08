import type { FlowEdge } from './edges';
import type { FlowNode } from './nodes';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export interface FlowSchemaMetadata {
  name: string;
  maxIterations: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface FlowSchema {
  schemaVersion: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: FlowSchemaMetadata;
}

export type ValidationSeverity = 'error' | 'warning';

export type ValidationCode =
  | 'GRAPH_EMPTY'
  | 'MISSING_API_KEY'
  | 'EMPTY_TEXT_NODE'
  | 'EMPTY_START_NODE'
  | 'MODEL_NODE_NO_MODEL'
  | 'MODEL_NODE_NO_INPUT'
  | 'COUNTER_NODE_NO_INPUT'
  | 'COUNTER_NODE_INVALID_PASSES'
  | 'MERGE_NODE_NO_INPUT'
  | 'OUTPUT_NODE_NO_INPUT'
  | 'OUTPUT_NODE_MULTIPLE_INPUTS'
  | 'TELEGRAM_INPUT_NODE_NO_BOT'
  | 'TELEGRAM_OUTPUT_NODE_NO_BOT'
  | 'TELEGRAM_BOT_NOT_FOUND'
  | 'TELEGRAM_OUTPUT_NODE_NO_INPUT'
  | 'TELEGRAM_OUTPUT_NODE_MULTIPLE_INPUTS'
  | 'NO_START_NODE'
  | 'INVALID_EDGE'
  | 'CYCLE_WITHOUT_MAX_ITERATIONS'
  | 'NO_EXECUTABLE_START_NODE'
  | 'ORPHAN_TEXT_NODE'
  | 'INVALID_SCHEMA_VERSION'
  | 'EMPTY_CUSTOM_TEMPLATE'
  | 'MAX_NODES_EXCEEDED'
  | 'MAX_EDGES_EXCEEDED';

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
  nodeId: string | null;
  edgeId: string | null;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

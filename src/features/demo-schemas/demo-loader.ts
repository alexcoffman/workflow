import type { FlowSchema } from '../../domain/schema';
import type { ValidationIssue } from '../../domain/validation';
import { normalizeSchema, validateSchemaVersion } from '../../lib/schema';

import { DEMO_SCHEMAS } from './demos';

export const listDemoSchemas = () => DEMO_SCHEMAS;

export const loadDemoSchema = (
  demoId: string
): { schema: FlowSchema | null; issues: ValidationIssue[] } => {
  const demo = DEMO_SCHEMAS.find((item) => item.id === demoId);
  if (!demo) {
    return {
      schema: null,
      issues: [
        {
          code: 'INVALID_SCHEMA_VERSION',
          message: `Неизвестный идентификатор демо-схемы: ${demoId}`,
          nodeId: null,
          edgeId: null,
          severity: 'error'
        }
      ]
    };
  }

  const versionIssues = validateSchemaVersion(demo.schema.schemaVersion);
  if (versionIssues.length > 0) {
    return {
      schema: null,
      issues: versionIssues
    };
  }

  return {
    schema: normalizeSchema(demo.schema),
    issues: []
  };
};

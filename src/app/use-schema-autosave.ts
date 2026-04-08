import { CURRENT_SCHEMA_VERSION } from '../domain/schema';
import { useDebouncedEffect } from '../lib/debounce';
import { writeSchemaDraft } from '../lib/storage';
import { useEditorStore } from '../stores/editor-store';

export const useSchemaAutosave = (): void => {
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const metadata = useEditorStore((state) => state.metadata);

  useDebouncedEffect(
    () => {
      writeSchemaDraft({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        nodes,
        edges,
        metadata
      });
    },
    500,
    [nodes, edges, metadata]
  );
};

import { useCallback } from 'react';

import { isNodeDataActive, type ActivatableNodeData } from '../../../domain/nodes';
import { cn } from '../../../lib/cn';
import { useEditorStore } from '../../../stores/editor-store';

interface NodeActivationToggleProps {
  nodeId: string;
  data: ActivatableNodeData;
}

export const NodeActivationToggle = ({ nodeId, data }: NodeActivationToggleProps): JSX.Element => {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const locked = useEditorStore((state) => state.locked);
  const isActive = isNodeDataActive(data);

  const onToggle = useCallback(() => {
    if (locked) {
      return;
    }

    updateNodeData(nodeId, (currentData) => ({
      ...currentData,
      isActive: !isNodeDataActive(currentData)
    }));
  }, [locked, nodeId, updateNodeData]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? 'Отключить блок' : 'Включить блок'}
      className={cn(
        'nodrag nopan relative inline-flex h-4 w-8 items-center rounded-full border transition-colors',
        isActive
          ? 'border-emerald-300/70 bg-emerald-500/80 hover:bg-emerald-500'
          : 'border-slate-500/80 bg-slate-600/70 hover:bg-slate-500/80',
        locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      )}
      onClick={onToggle}
      disabled={locked}
      title={isActive ? 'Блок активен' : 'Блок деактивирован'}
    >
      <span
        className={cn(
          'pointer-events-none ml-[1px] h-3 w-3 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200 ease-out',
          isActive ? 'translate-x-[15px]' : 'translate-x-0'
        )}
      />
    </button>
  );
};

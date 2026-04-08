import { HANDLE_IDS } from '../../domain/constants';
import { isMergeInputHandle } from '../../domain/merge-input-handles';
import { NodeType } from '../../domain/node-types';
import type { FlowNode } from '../../domain/nodes';

interface ConnectionValidationResult {
  isValid: boolean;
  reason: string | null;
}

const ok = (): ConnectionValidationResult => ({ isValid: true, reason: null });

const fail = (reason: string): ConnectionValidationResult => ({ isValid: false, reason });

const isDecisionOutputHandle = (handle: string | null): boolean => {
  return (
    handle === HANDLE_IDS.decisionOutputYes ||
    handle === HANDLE_IDS.decisionOutputNo ||
    handle === HANDLE_IDS.decisionOutputOther
  );
};

const isCounterOutputHandle = (handle: string | null): boolean => {
  return handle === HANDLE_IDS.counterOutputIntermediate || handle === HANDLE_IDS.counterOutputFinal;
};

export const validateConnection = (
  sourceNode: FlowNode | undefined,
  targetNode: FlowNode | undefined,
  sourceHandle: string | null,
  targetHandle: string | null
): ConnectionValidationResult => {
  if (!sourceNode || !targetNode) {
    return fail('Соединение должно содержать исходный и целевой блок.');
  }

  if (sourceNode.type === NodeType.NOTE || targetNode.type === NodeType.NOTE) {
    return fail('Блоки NOTE не входят в исполняемый граф.');
  }

  if (targetNode.type === NodeType.START || targetNode.type === NodeType.TELEGRAM_INPUT) {
    return fail('Блок СТАРТ и блок ВХОД ИЗ TELEGRAM не принимают входящие связи.');
  }

  if (targetNode.type === NodeType.TEXT) {
    if (sourceNode.type !== NodeType.START) {
      return fail('Во вход TEXT можно подключать только блок СТАРТ.');
    }

    if (targetHandle && targetHandle !== HANDLE_IDS.defaultInput) {
      return fail('Блок TEXT принимает только input handle.');
    }
  }

  if (sourceNode.type === NodeType.TELEGRAM_OUTPUT) {
    return fail('Блок ВЫХОД В TELEGRAM не имеет исходящих связей.');
  }

  if (sourceNode.type === NodeType.DECISION) {
    if (!isDecisionOutputHandle(sourceHandle)) {
      return fail('Блок РЕШЕНИЕ должен соединяться через выход ДА, НЕТ или ДРУГОЕ.');
    }
  } else if (sourceNode.type === NodeType.COUNTER) {
    if (!isCounterOutputHandle(sourceHandle)) {
      return fail('Блок СЧЁТЧИК должен соединяться через выход ПРОМЕЖУТОЧНЫЙ или ФИНАЛ.');
    }
  } else if (sourceNode.type === NodeType.TELEGRAM_INPUT) {
    if (sourceHandle && sourceHandle !== HANDLE_IDS.defaultOutput) {
      return fail('Блок ВХОД ИЗ TELEGRAM использует только выход output.');
    }
  } else if (sourceHandle && sourceHandle !== HANDLE_IDS.defaultOutput) {
    return fail('Некорректный исходный handle. Используйте output.');
  }

  if (
    (targetNode.type === NodeType.MODEL ||
      targetNode.type === NodeType.DECISION ||
      targetNode.type === NodeType.COUNTER ||
      targetNode.type === NodeType.TELEGRAM_OUTPUT) &&
    targetHandle &&
    targetHandle !== HANDLE_IDS.defaultInput
  ) {
    return fail('Целевой блок принимает только input handle.');
  }

  if (targetNode.type === NodeType.MERGE) {
    if (!targetHandle) {
      return fail('Для блока ОБЬЕДИНИТЬ выберите конкретный вход merge-input-X.');
    }

    if (!isMergeInputHandle(targetHandle)) {
      return fail('Блок ОБЬЕДИНИТЬ принимает только входы вида merge-input-1, merge-input-2 и т.д.');
    }
  }

  if (targetNode.type === NodeType.OUTPUT && targetHandle && targetHandle !== HANDLE_IDS.defaultInput) {
    return fail('Блок ВЫВОД принимает только input handle.');
  }

  if (targetNode.type === NodeType.TELEGRAM_OUTPUT && targetHandle && targetHandle !== HANDLE_IDS.defaultInput) {
    return fail('Блок ВЫХОД В TELEGRAM принимает только input handle.');
  }

  return ok();
};


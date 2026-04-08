import { DEFAULT_OPENAI_MODEL } from '../../domain/constants';
import { NodeType } from '../../domain/node-types';
import { CURRENT_SCHEMA_VERSION, type FlowSchema } from '../../domain/schema';

const now = Date.now();

const baseMetadata = (name: string, maxIterations: number | null) => ({
  name,
  maxIterations,
  createdAt: now,
  updatedAt: now
});

export const linearDemoSchema: FlowSchema = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  metadata: baseMetadata('Линейная демо-схема', null),
  nodes: [
    {
      id: 'linear-text',
      type: NodeType.START,
      position: { x: 120, y: 140 },
      data: {
        title: 'Вход пользователя',
        text: 'Сформируй короткий статус-апдейт о выпуске нового редактора workflow.'
      }
    },
    {
      id: 'linear-model-a',
      type: NodeType.MODEL,
      position: { x: 460, y: 110 },
      data: {
        title: 'Модель-аналитик',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Перепиши вход в ясный отчет со списком ключевых пунктов.',
        temperature: 0.5,
        maxTokens: 350,
        showIntermediateMeta: false,
        requireAllInputs: true
      }
    },
    {
      id: 'linear-model-b',
      type: NodeType.MODEL,
      position: { x: 820, y: 110 },
      data: {
        title: 'Модель-ревьюер',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Сделай стиль более executive и убери лишнее.',
        temperature: 0.4,
        maxTokens: 350,
        showIntermediateMeta: false,
        requireAllInputs: true
      }
    }
  ],
  edges: [
    {
      id: 'linear-edge-1',
      source: 'linear-text',
      target: 'linear-model-a',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 0
    },
    {
      id: 'linear-edge-2',
      source: 'linear-model-a',
      target: 'linear-model-b',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 1
    }
  ]
};

export const branchingDemoSchema: FlowSchema = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  metadata: baseMetadata('Ветвление демо-схема', null),
  nodes: [
    {
      id: 'branch-text',
      type: NodeType.START,
      position: { x: 120, y: 220 },
      data: {
        title: 'Бриф',
        text: 'Сравни риски запуска продукта с инженерной и бизнес-точек зрения.'
      }
    },
    {
      id: 'branch-model-a',
      type: NodeType.MODEL,
      position: { x: 430, y: 80 },
      data: {
        title: 'Инженерный взгляд',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Сфокусируйся на технических и операционных рисках.',
        temperature: 0.6,
        maxTokens: 350,
        showIntermediateMeta: false,
        requireAllInputs: true
      }
    },
    {
      id: 'branch-model-b',
      type: NodeType.MODEL,
      position: { x: 430, y: 320 },
      data: {
        title: 'Бизнес-взгляд',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Сфокусируйся на рыночных и финансовых рисках.',
        temperature: 0.6,
        maxTokens: 350,
        showIntermediateMeta: false,
        requireAllInputs: true
      }
    },
    {
      id: 'branch-merge',
      type: NodeType.MERGE,
      position: { x: 760, y: 210 },
      data: {
        title: 'Обьединить перспективы',
        mode: 'join_with_labels',
        separator: '\n\n',
        template: '[{{input-name-1}}]:\n{{input-value-1}}\n\n[{{input-name-2}}]:\n{{input-value-2}}\n\nВсего входов: {{count}}',
        requireAllInputs: true
      }
    },
    {
      id: 'branch-model-c',
      type: NodeType.MODEL,
      position: { x: 1070, y: 210 },
      data: {
        title: 'Финальный советник',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Сформируй единый приоритизированный план снижения рисков.',
        temperature: 0.5,
        maxTokens: 420,
        showIntermediateMeta: false,
        requireAllInputs: true
      }
    }
  ],
  edges: [
    {
      id: 'branch-edge-1',
      source: 'branch-text',
      target: 'branch-model-a',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 0
    },
    {
      id: 'branch-edge-2',
      source: 'branch-text',
      target: 'branch-model-b',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 1
    },
    {
      id: 'branch-edge-3',
      source: 'branch-model-a',
      target: 'branch-merge',
      sourceHandle: 'output',
      targetHandle: 'merge-input-1',
      sortOrder: 2
    },
    {
      id: 'branch-edge-4',
      source: 'branch-model-b',
      target: 'branch-merge',
      sourceHandle: 'output',
      targetHandle: 'merge-input-2',
      sortOrder: 3
    },
    {
      id: 'branch-edge-5',
      source: 'branch-merge',
      target: 'branch-model-c',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 4
    }
  ]
};

export const cycleDemoSchema: FlowSchema = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  metadata: baseMetadata('Цикл демо-схема', 4),
  nodes: [
    {
      id: 'cycle-text',
      type: NodeType.START,
      position: { x: 120, y: 210 },
      data: {
        title: 'Стартовый промпт',
        text: 'Запусти короткую дискуссию, где каждый ответ улучшает предыдущий аргумент.'
      }
    },
    {
      id: 'cycle-model-a',
      type: NodeType.MODEL,
      position: { x: 430, y: 110 },
      data: {
        title: 'Модель A',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Дай короткий контраргумент и передай дальше.',
        temperature: 0.7,
        maxTokens: 220,
        showIntermediateMeta: false,
        requireAllInputs: false
      }
    },
    {
      id: 'cycle-model-b',
      type: NodeType.MODEL,
      position: { x: 760, y: 270 },
      data: {
        title: 'Модель B',
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        systemPrompt: 'Улучши аргумент и отправь ответ обратно в модель A.',
        temperature: 0.7,
        maxTokens: 220,
        showIntermediateMeta: false,
        requireAllInputs: false
      }
    }
  ],
  edges: [
    {
      id: 'cycle-edge-1',
      source: 'cycle-text',
      target: 'cycle-model-a',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 0
    },
    {
      id: 'cycle-edge-2',
      source: 'cycle-model-a',
      target: 'cycle-model-b',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 1
    },
    {
      id: 'cycle-edge-3',
      source: 'cycle-model-b',
      target: 'cycle-model-a',
      sourceHandle: 'output',
      targetHandle: 'input',
      sortOrder: 2
    }
  ]
};

export interface DemoSchemaItem {
  id: string;
  title: string;
  description: string;
  schema: FlowSchema;
}

export const DEMO_SCHEMAS: DemoSchemaItem[] = [
  {
    id: 'linear',
    title: 'Линейная',
    description: 'Старт -> Модель -> Модель',
    schema: linearDemoSchema
  },
  {
    id: 'branching',
    title: 'Ветвление',
    description: 'Старт расходится в две модели, затем объединение и финальная модель',
    schema: branchingDemoSchema
  },
  {
    id: 'cycle',
    title: 'Цикл',
    description: 'Старт -> Модель A -> Модель B -> Модель A с ограничением итераций',
    schema: cycleDemoSchema
  }
];


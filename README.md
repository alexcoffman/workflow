# Workflow Builder (React + OpenAI Responses API)

Визуальный workflow-builder для конструирования цепочек общения LLM-моделей через OpenAI API.

Приложение позволяет собирать граф из блоков `TEXT`, `MODEL`, `MERGE`, `NOTE`, запускать его через детерминированный event-driven engine, видеть поузловой trace-лог, работать с demo-схемами, импортом/экспортом и автосохранением.

## Основные возможности

- Canvas-редактор на React Flow (drag, connect, zoom/pan, delete)
- Блоки:
  - `TEXT` — источник текста
  - `MODEL` — вызов OpenAI `responses.create`
  - `MERGE` — объединение нескольких входов
  - `NOTE` — аннотация, игнорируется engine
- Inspector-панель для редактирования свойств выбранного блока
- Детерминированный execution engine:
  - immutable run snapshot
  - FIFO event queue
  - cycle analysis + iteration semantics
  - dedup fingerprints
  - retry (1) на временные сетевые ошибки
  - AbortController stop
- Structured run trace (chat-like) с группировкой по run/iteration
- Validation с кодами ошибок до старта run
- Save/Load/Autosave в localStorage
- Import JSON / Export JSON через modal
- Demo-схемы: linear / branching / cycle

## Технологии

- React
- TypeScript
- Vite
- React Flow
- Zustand
- shadcn/ui style components + Radix UI
- Tailwind CSS
- `openai` (official npm package)
- Vitest

## Установка и запуск

```bash
npm install
```

```bash
npm run dev
```

## Сборка

```bash
npm run build
```

## Тесты

```bash
npm run test:run
```

## OpenAI API и хранение ключа

MVP-режим работает **без backend/proxy**:

- запросы идут **напрямую из браузера** через OpenAI SDK
- используется `new OpenAI({ apiKey, dangerouslyAllowBrowser: true })`
- вызов модели: `client.responses.create(...)`
- итоговый текст берется из `response.output_text`

### Важно про безопасность

API key хранится в `localStorage` под ключом:

- `app.openai.apiKey`

Это **небезопасно** для production и подходит только для локального/личного использования MVP.

Если ключ отсутствует, редактор продолжает работать, но run с `MODEL` блоками блокируется валидацией.

## Demo-схемы

Встроены три demo-схемы:

1. `Linear` — `TEXT -> MODEL -> MODEL`
2. `Branching` — `TEXT -> MODEL A`, `TEXT -> MODEL B`, затем `MERGE -> MODEL C`
3. `Cycle` — `TEXT -> MODEL A -> MODEL B -> MODEL A` (с `maxIterations`)

Во всех demo `MODEL` по умолчанию используют `gpt-4.1-mini`.

## Save / Load / Import / Export

- `Save` — форсированно сохраняет текущую схему в active localStorage slot
- `Load` — загружает последнюю сохраненную/автосохраненную схему из localStorage
- `Autosave` — debounce 500ms, сохраняет текущую активную схему
- `Export JSON` — открывает modal с сериализованной схемой и кнопкой copy
- `Import JSON` — открывает modal с textarea, затем validate + normalize + load

Пример import-файла: [examples/sample-import.json](./examples/sample-import.json)

## Команды

- Dev server: `npm run dev`
- Build: `npm run build`
- Tests: `npm run test:run`
- Preview build: `npm run preview`

## Ограничения MVP

- max nodes: 100
- max edges: 300
- request timeout: 60s
- retry: 1 (временные сетевые ошибки)
- max log events in memory: 1000
- max text length per TEXT block: 20000 chars

## Статус

Проект ориентирован на локальный MVP и дальнейшее расширение provider-слоя (proxy / openai-compatible endpoint / другие LLM-провайдеры).

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const HOST = process.env.SETTINGS_HOST ?? '127.0.0.1';
const PORT = Number(process.env.SETTINGS_PORT ?? 8787);
const DATA_FILE = resolve(process.cwd(), process.env.SETTINGS_DATA_PATH ?? 'server-data/user-settings.json');

const ensureStorage = () => {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  try {
    readFileSync(DATA_FILE, 'utf-8');
  } catch {
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, users: {} }, null, 2), 'utf-8');
  }
};

const readDb = () => {
  ensureStorage();
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object' || !parsed.users) {
      return { version: 1, users: {} };
    }
    return parsed;
  } catch {
    return { version: 1, users: {} };
  }
};

const writeDb = (db) => {
  ensureStorage();
  const temp = `${DATA_FILE}.tmp`;
  writeFileSync(temp, JSON.stringify(db, null, 2), 'utf-8');
  renameSync(temp, DATA_FILE);
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const sanitizeUserId = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeModels = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = [];
  for (const model of value) {
    if (typeof model !== 'string') {
      continue;
    }

    const trimmed = model.trim();
    if (!trimmed) {
      continue;
    }

    if (normalized.includes(trimmed)) {
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
};

const readBody = (req) =>
  new Promise((resolveBody, rejectBody) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf-8');
      if (raw.length > 256_000) {
        rejectBody(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolveBody(raw));
    req.on('error', rejectBody);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname !== '/api/user-settings') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (req.method === 'GET') {
    const userId = sanitizeUserId(url.searchParams.get('userId'));
    if (!userId) {
      sendJson(res, 400, { error: 'Некорректный userId.' });
      return;
    }

    const db = readDb();
    const user = db.users[userId] ?? null;
    sendJson(res, 200, {
      apiKey: typeof user?.apiKey === 'string' ? user.apiKey : '',
      models: normalizeModels(user?.models),
      updatedAt: typeof user?.updatedAt === 'number' ? user.updatedAt : null
    });
    return;
  }

  if (req.method === 'PUT') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};

      const userId = sanitizeUserId(parsed?.userId);
      if (!userId) {
        sendJson(res, 400, { error: 'Некорректный userId.' });
        return;
      }

      const apiKey = typeof parsed?.apiKey === 'string' ? parsed.apiKey.trim() : '';
      const models = normalizeModels(parsed?.models);
      if (models.length === 0) {
        sendJson(res, 400, { error: 'Список моделей не может быть пустым.' });
        return;
      }

      const db = readDb();
      db.users[userId] = {
        apiKey,
        models,
        updatedAt: Date.now()
      };
      writeDb(db);

      sendJson(res, 200, {
        ok: true,
        apiKey,
        models
      });
      return;
    } catch (error) {
      sendJson(res, 400, {
        error: error instanceof Error ? error.message : 'Некорректный payload.'
      });
      return;
    }
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[settings-server] http://${HOST}:${PORT} -> ${DATA_FILE}`);
});

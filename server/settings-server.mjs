import { randomUUID } from 'node:crypto';
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
    writeFileSync(DATA_FILE, JSON.stringify({ version: 2, users: {}, sessions: {} }, null, 2), 'utf-8');
  }
};

const readDb = () => {
  ensureStorage();
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { version: 2, users: {}, sessions: {} };
    }

    return {
      version: 2,
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {}
    };
  } catch {
    return { version: 2, users: {}, sessions: {} };
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

const normalizeLogin = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 64) {
    return null;
  }

  return {
    login: trimmed,
    normalized: trimmed.toLowerCase()
  };
};

const normalizePasswordHash = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 512) {
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
    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
};

const normalizeTelegramBots = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const bots = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item;
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.trim().length === 0 ||
      typeof candidate.name !== 'string' ||
      candidate.name.trim().length === 0 ||
      typeof candidate.token !== 'string' ||
      candidate.token.trim().length === 0
    ) {
      continue;
    }

    if (bots.some((bot) => bot.id === candidate.id.trim())) {
      continue;
    }

    bots.push({
      id: candidate.id.trim(),
      name: candidate.name.trim(),
      token: candidate.token.trim()
    });
  }

  return bots;
};

const readBody = (req) =>
  new Promise((resolveBody, rejectBody) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf-8');
      if (raw.length > 512_000) {
        rejectBody(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolveBody(raw));
    req.on('error', rejectBody);
  });

const createSession = (db, user) => {
  const token = randomUUID().replace(/-/g, '');
  const session = {
    token,
    userId: user.id,
    login: user.login,
    signedInAt: Date.now(),
    updatedAt: Date.now()
  };
  db.sessions[token] = session;
  return session;
};

const readTokenFromRequest = (req, url) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token.length > 0) {
      return token;
    }
  }

  const queryToken = url.searchParams.get('token');
  if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
    return queryToken.trim();
  }

  return null;
};

const findUserByLogin = (db, normalizedLogin) => {
  for (const user of Object.values(db.users)) {
    if (user && typeof user === 'object' && user.loginNormalized === normalizedLogin) {
      return user;
    }
  }
  return null;
};

const resolveUserFromToken = (db, token) => {
  if (!token) {
    return null;
  }

  const session = db.sessions[token];
  if (!session) {
    return null;
  }

  const user = db.users[session.userId] ?? null;
  if (!user) {
    delete db.sessions[token];
    return null;
  }

  session.updatedAt = Date.now();
  return { session, user };
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const loginInfo = normalizeLogin(parsed?.login);
      const passwordHash = normalizePasswordHash(parsed?.passwordHash);

      if (!loginInfo || !passwordHash) {
        sendJson(res, 400, { error: 'Некорректные логин или пароль.' });
        return;
      }

      const db = readDb();
      const existing = findUserByLogin(db, loginInfo.normalized);
      if (existing) {
        sendJson(res, 409, { error: 'Пользователь с таким логином уже существует.' });
        return;
      }

      const userId = randomUUID().replace(/-/g, '');
      const now = Date.now();
      const user = {
        id: userId,
        login: loginInfo.login,
        loginNormalized: loginInfo.normalized,
        passwordHash,
        createdAt: now,
        updatedAt: now,
        settings: {
          apiKey: '',
          models: [],
          telegramBots: [],
          updatedAt: now
        }
      };

      db.users[userId] = user;
      const session = createSession(db, user);
      writeDb(db);

      sendJson(res, 200, {
        ok: true,
        session: {
          token: session.token,
          userId: user.id,
          login: user.login,
          signedInAt: session.signedInAt
        }
      });
      return;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Некорректный payload.' });
      return;
    }
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const loginInfo = normalizeLogin(parsed?.login);
      const passwordHash = normalizePasswordHash(parsed?.passwordHash);

      if (!loginInfo || !passwordHash) {
        sendJson(res, 400, { error: 'Некорректные логин или пароль.' });
        return;
      }

      const db = readDb();
      const user = findUserByLogin(db, loginInfo.normalized);
      if (!user || user.passwordHash !== passwordHash) {
        sendJson(res, 401, { error: 'Неверный логин или пароль.' });
        return;
      }

      const session = createSession(db, user);
      writeDb(db);

      sendJson(res, 200, {
        ok: true,
        session: {
          token: session.token,
          userId: user.id,
          login: user.login,
          signedInAt: session.signedInAt
        }
      });
      return;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Некорректный payload.' });
      return;
    }
  }

  if (url.pathname === '/api/auth/session' && req.method === 'GET') {
    const token = readTokenFromRequest(req, url);
    const db = readDb();
    const resolved = resolveUserFromToken(db, token);
    if (!resolved) {
      sendJson(res, 401, { error: 'Сессия недействительна.' });
      return;
    }

    writeDb(db);
    sendJson(res, 200, {
      ok: true,
      session: {
        token: resolved.session.token,
        userId: resolved.user.id,
        login: resolved.user.login,
        signedInAt: resolved.session.signedInAt
      }
    });
    return;
  }

  if (url.pathname === '/api/auth/change-password' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};

      const token = typeof parsed?.token === 'string' ? parsed.token.trim() : '';
      const currentPasswordHash = normalizePasswordHash(parsed?.currentPasswordHash);
      const nextPasswordHash = normalizePasswordHash(parsed?.nextPasswordHash);

      if (!token || !currentPasswordHash || !nextPasswordHash) {
        sendJson(res, 400, { error: 'Некорректные данные смены пароля.' });
        return;
      }

      const db = readDb();
      const resolved = resolveUserFromToken(db, token);
      if (!resolved) {
        sendJson(res, 401, { error: 'Сессия недействительна.' });
        return;
      }

      if (resolved.user.passwordHash !== currentPasswordHash) {
        sendJson(res, 401, { error: 'Текущий пароль указан неверно.' });
        return;
      }

      resolved.user.passwordHash = nextPasswordHash;
      resolved.user.updatedAt = Date.now();
      writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Некорректный payload.' });
      return;
    }
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const token = typeof parsed?.token === 'string' ? parsed.token.trim() : '';
      if (!token) {
        sendJson(res, 200, { ok: true });
        return;
      }

      const db = readDb();
      delete db.sessions[token];
      writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  if (url.pathname === '/api/user-settings') {
    const db = readDb();
    const token = readTokenFromRequest(req, url);
    const resolved = resolveUserFromToken(db, token);

    if (!resolved) {
      sendJson(res, 401, { error: 'Сессия недействительна.' });
      return;
    }

    if (req.method === 'GET') {
      const settings = resolved.user.settings ?? { apiKey: '', models: [], telegramBots: [], updatedAt: null };
      writeDb(db);
      sendJson(res, 200, {
        apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
        models: normalizeModels(settings.models),
        telegramBots: normalizeTelegramBots(settings.telegramBots),
        updatedAt: typeof settings.updatedAt === 'number' ? settings.updatedAt : null
      });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const rawBody = await readBody(req);
        const parsed = rawBody ? JSON.parse(rawBody) : {};

        const apiKey = typeof parsed?.apiKey === 'string' ? parsed.apiKey.trim() : '';
        const models = normalizeModels(parsed?.models);
        const telegramBots = normalizeTelegramBots(parsed?.telegramBots);

        if (models.length === 0) {
          sendJson(res, 400, { error: 'Список моделей не может быть пустым.' });
          return;
        }

        resolved.user.settings = {
          apiKey,
          models,
          telegramBots,
          updatedAt: Date.now()
        };

        writeDb(db);
        sendJson(res, 200, {
          ok: true,
          apiKey,
          models,
          telegramBots
        });
        return;
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'Некорректный payload.' });
        return;
      }
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[settings-server] http://${HOST}:${PORT} -> ${DATA_FILE}`);
});

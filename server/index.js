// Сервер: аккаунты (почта + пароль) и результаты тестов в SQLite (файл server/data.db).
import "./env.js";
import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import quizzes from "../src/data/quizzes.js";
import { computeResult, validAnswers } from "../src/lib/scoring.js";
import { sendMail } from "./mail.js";
import { askQualm, qualmStatus } from "./qualm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const SITE_URL = (process.env.SITE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";
const SESSION_DAYS = 30;
const scrypt = promisify(crypto.scrypt);

// ---------- база данных ----------
const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,   -- анонимный идентификатор браузера
    quiz_slug  TEXT    NOT NULL,
    answers    TEXT    NOT NULL,   -- JSON-массив ответов
    score      INTEGER NOT NULL,
    max_score  INTEGER NOT NULL,
    level      TEXT    NOT NULL,
    created_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_results_user ON results (user_id, created_at);

  CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT    NOT NULL UNIQUE,   -- в нижнем регистре
    name           TEXT    NOT NULL DEFAULT '',
    password_hash  TEXT    NOT NULL,          -- scrypt, пароль не хранится
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,              -- хранится хеш, а не сам токен
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    purpose    TEXT    NOT NULL,              -- verify | reset
    expires_at TEXT    NOT NULL
  );
`);

// Миграции для баз, созданных раньше
const resultCols = db.prepare("PRAGMA table_info(results)").all().map((c) => c.name);
if (!resultCols.includes("details")) db.exec("ALTER TABLE results ADD COLUMN details TEXT");
if (!resultCols.includes("account_id")) {
  db.exec("ALTER TABLE results ADD COLUMN account_id INTEGER");
  db.exec("CREATE INDEX IF NOT EXISTS idx_results_account ON results (account_id, created_at)");
}

const q = {
  insertResult: db.prepare(
    `INSERT INTO results (user_id, account_id, quiz_slug, answers, score, max_score, level, created_at, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  listByAccount: db.prepare(
    `SELECT id, quiz_slug AS slug, answers, score, max_score AS maxScore, level, created_at AS createdAt, details
     FROM results WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT 500`
  ),
  listByAnon: db.prepare(
    `SELECT id, quiz_slug AS slug, answers, score, max_score AS maxScore, level, created_at AS createdAt, details
     FROM results WHERE user_id = ? AND account_id IS NULL ORDER BY created_at DESC, id DESC LIMIT 200`
  ),
  deleteOneAccount: db.prepare(`DELETE FROM results WHERE id = ? AND account_id = ?`),
  deleteOneAnon: db.prepare(`DELETE FROM results WHERE id = ? AND user_id = ? AND account_id IS NULL`),
  deleteAllAccount: db.prepare(`DELETE FROM results WHERE account_id = ?`),
  deleteAllAnon: db.prepare(`DELETE FROM results WHERE user_id = ? AND account_id IS NULL`),
  claim: db.prepare(`UPDATE results SET account_id = ? WHERE user_id = ? AND account_id IS NULL`),

  accountByEmail: db.prepare(`SELECT * FROM accounts WHERE email = ?`),
  accountById: db.prepare(`SELECT * FROM accounts WHERE id = ?`),
  insertAccount: db.prepare(`INSERT INTO accounts (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)`),
  setName: db.prepare(`UPDATE accounts SET name = ? WHERE id = ?`),
  setPassword: db.prepare(`UPDATE accounts SET password_hash = ? WHERE id = ?`),
  setVerified: db.prepare(`UPDATE accounts SET email_verified = 1 WHERE id = ?`),
  deleteAccount: db.prepare(`DELETE FROM accounts WHERE id = ?`),

  insertSession: db.prepare(`INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)`),
  sessionAccount: db.prepare(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?`
  ),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token_hash = ?`),
  deleteSessionsOf: db.prepare(`DELETE FROM sessions WHERE account_id = ?`),
  deleteOtherSessions: db.prepare(`DELETE FROM sessions WHERE account_id = ? AND token_hash != ?`),
  purgeSessions: db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`),

  insertToken: db.prepare(`INSERT INTO email_tokens (token_hash, account_id, purpose, expires_at) VALUES (?, ?, ?, ?)`),
  takeToken: db.prepare(
    `SELECT account_id FROM email_tokens WHERE token_hash = ? AND purpose = ? AND expires_at > ?`
  ),
  deleteToken: db.prepare(`DELETE FROM email_tokens WHERE token_hash = ?`),
  deleteTokensOf: db.prepare(`DELETE FROM email_tokens WHERE account_id = ? AND purpose = ?`),
};

// ---------- вспомогательное ----------
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");
const nowIso = () => new Date().toISOString();
const inFuture = (ms) => new Date(Date.now() + ms).toISOString();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function checkPassword(password, stored) {
  const [, saltB64, keyB64] = stored.split("$");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), 64);
  const expected = Buffer.from(keyB64, "base64");
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}
const DUMMY_HASH = await hashPassword("dummy-password-for-timing");

// Ограничение частоты запросов (хранится в памяти сервера)
const hits = new Map();
function recent(key, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  hits.set(key, arr);
  return arr;
}
const isLimited = (key, max, windowMs) => recent(key, windowMs).length >= max;
const registerHit = (key, windowMs) => recent(key, windowMs).push(Date.now());

const publicUser = (a) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  emailVerified: !!a.email_verified,
  createdAt: a.created_at,
});

function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function startSession(res, accountId) {
  const token = newToken();
  q.insertSession.run(sha(token), accountId, inFuture(SESSION_DAYS * 864e5));
  res.cookie("calm_session", token, {
    httpOnly: true,
    // Для Android-приложения / ngrok нужен "none"+secure (cross-site).
    // Для чистой веб-разработки на 127.0.0.1 — "lax".
    sameSite: COOKIE_SECURE ? "none" : "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_DAYS * 864e5,
  });
}

function claimAnonymousResults(req, accountId) {
  const anon = req.get("x-user-id");
  if (anon && UUID.test(anon)) q.claim.run(accountId, anon);
}

async function sendLink(account, purpose) {
  const token = newToken();
  q.deleteTokensOf.run(account.id, purpose);
  q.insertToken.run(sha(token), account.id, purpose, inFuture(purpose === "reset" ? 36e5 : 864e5 * 3));
  if (purpose === "verify") {
    const link = `${SITE_URL}/verify?token=${token}`;
    await sendMail({
      to: account.email,
      subject: "Подтвердите почту на сайте Calm",
      text: `Здравствуйте!\n\nЧтобы подтвердить почту, перейдите по ссылке:\n${link}\n\nЕсли вы не регистрировались на сайте Calm, просто проигнорируйте это письмо.`,
      link,
    });
  } else {
    const link = `${SITE_URL}/reset?token=${token}`;
    await sendMail({
      to: account.email,
      subject: "Сброс пароля на сайте Calm",
      text: `Здравствуйте!\n\nЧтобы задать новый пароль, перейдите по ссылке (она действует час):\n${link}\n\nЕсли вы не просили сброс пароля, просто проигнорируйте это письмо: пароль останется прежним.`,
      link,
    });
  }
}

// ---------- приложение ----------
const app = express();
app.use(express.json({ limit: "50kb" }));

// CORS для Android-приложения / ngrok-туннеля.
// В .env перечислите разрешённые источники через запятую, например:
//   CORS_ORIGINS=https://localhost,capacitor://localhost,http://localhost
// "https://localhost" — origin Capacitor-приложения с androidScheme: https.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (origin && (CORS_ORIGINS.includes("*") || CORS_ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-User-Id, X-Requested-With, ngrok-skip-browser-warning");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Защита от чужих сайтов: изменяющие запросы должны нести наш заголовок
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("x-requested-with") !== "calm") {
    return res.status(403).json({ error: "Запрос отклонён" });
  }
  next();
});

// Определяем, кто делает запрос: вошедший пользователь или аноним
function identify(req, res, next) {
  const token = readCookie(req, "calm_session");
  req.account = token ? q.sessionAccount.get(sha(token), nowIso()) || null : null;
  const anon = req.get("x-user-id");
  req.userId = anon && UUID.test(anon) ? anon : null;
  req.sessionHash = token ? sha(token) : null;
  next();
}
app.use("/api", identify);

function requireAccount(req, res, next) {
  if (!req.account) return res.status(401).json({ error: "Нужно войти в профиль" });
  next();
}

// ---------- аккаунты ----------
app.post("/api/auth/register", async (req, res) => {
  const ip = req.ip;
  if (isLimited(`reg|${ip}`, 10, 36e5)) return res.status(429).json({ error: "Слишком много попыток, попробуйте позже" });
  registerHit(`reg|${ip}`, 36e5);

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Проверьте адрес почты" });
  if (password.length < 8 || password.length > 100) return res.status(400).json({ error: "Пароль должен быть от 8 до 100 символов" });
  if (q.accountByEmail.get(email)) return res.status(409).json({ error: "Эта почта уже зарегистрирована. Попробуйте войти" });

  const info = q.insertAccount.run(email, name, await hashPassword(password), nowIso());
  const account = q.accountById.get(info.lastInsertRowid);
  startSession(res, account.id);
  claimAnonymousResults(req, account.id);
  sendLink(account, "verify").catch((e) => console.error("mail error:", e.message));
  res.status(201).json({ user: publicUser(account) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const key = `login|${req.ip}|${email}`;
  if (isLimited(key, 8, 15 * 6e4)) return res.status(429).json({ error: "Слишком много неудачных попыток. Попробуйте через 15 минут" });

  const account = q.accountByEmail.get(email);
  // Проверяем пароль даже для несуществующей почты, чтобы по времени нельзя было узнать, есть ли она
  const ok = await checkPassword(password, account ? account.password_hash : DUMMY_HASH);
  if (!account || !ok) {
    registerHit(key, 15 * 6e4);
    return res.status(401).json({ error: "Неверная почта или пароль" });
  }
  hits.delete(key);
  q.purgeSessions.run(nowIso());
  startSession(res, account.id);
  claimAnonymousResults(req, account.id);
  res.json({ user: publicUser(account) });
});

app.post("/api/auth/logout", (req, res) => {
  if (req.sessionHash) q.deleteSession.run(req.sessionHash);
  res.clearCookie("calm_session", { path: "/" });
  res.status(204).end();
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.account ? publicUser(req.account) : null });
});

app.post("/api/auth/verify", (req, res) => {
  const tokenHash = sha(String(req.body?.token || ""));
  const row = q.takeToken.get(tokenHash, "verify", nowIso());
  if (!row) return res.status(400).json({ error: "Ссылка недействительна или устарела" });
  q.setVerified.run(row.account_id);
  q.deleteToken.run(tokenHash);
  res.json({ ok: true });
});

app.post("/api/auth/resend", requireAccount, async (req, res) => {
  if (req.account.email_verified) return res.json({ ok: true });
  if (isLimited(`resend|${req.account.id}`, 3, 36e5)) return res.status(429).json({ error: "Письмо уже отправляли недавно. Попробуйте позже" });
  registerHit(`resend|${req.account.id}`, 36e5);
  await sendLink(req.account, "verify");
  res.json({ ok: true });
});

app.post("/api/auth/forgot", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (isLimited(`forgot|${req.ip}`, 10, 36e5)) return res.status(429).json({ error: "Слишком много попыток, попробуйте позже" });
  registerHit(`forgot|${req.ip}`, 36e5);
  const account = q.accountByEmail.get(email);
  if (account) sendLink(account, "reset").catch((e) => console.error("mail error:", e.message));
  // Ответ одинаковый, есть такая почта или нет
  res.json({ ok: true });
});

app.post("/api/auth/reset", async (req, res) => {
  const tokenHash = sha(String(req.body?.token || ""));
  const password = String(req.body?.password || "");
  if (password.length < 8 || password.length > 100) return res.status(400).json({ error: "Пароль должен быть от 8 до 100 символов" });
  const row = q.takeToken.get(tokenHash, "reset", nowIso());
  if (!row) return res.status(400).json({ error: "Ссылка недействительна или устарела" });
  q.setPassword.run(await hashPassword(password), row.account_id);
  q.setVerified.run(row.account_id); // письмо дошло до владельца почты
  q.deleteToken.run(tokenHash);
  q.deleteSessionsOf.run(row.account_id); // выходим со всех устройств
  res.json({ ok: true });
});

app.patch("/api/auth/profile", requireAccount, (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 60);
  q.setName.run(name, req.account.id);
  res.json({ user: publicUser(q.accountById.get(req.account.id)) });
});

app.post("/api/auth/password", requireAccount, async (req, res) => {
  const current = String(req.body?.current || "");
  const next = String(req.body?.next || "");
  if (next.length < 8 || next.length > 100) return res.status(400).json({ error: "Новый пароль должен быть от 8 до 100 символов" });
  if (!(await checkPassword(current, req.account.password_hash))) return res.status(401).json({ error: "Текущий пароль неверный" });
  q.setPassword.run(await hashPassword(next), req.account.id);
  q.deleteOtherSessions.run(req.account.id, req.sessionHash); // на других устройствах нужно войти заново
  res.json({ ok: true });
});

app.delete("/api/auth/account", requireAccount, async (req, res) => {
  const password = String(req.body?.password || "");
  if (!(await checkPassword(password, req.account.password_hash))) return res.status(401).json({ error: "Пароль неверный" });
  const id = req.account.id;
  db.transaction(() => {
    q.deleteAllAccount.run(id);
    q.deleteSessionsOf.run(id);
    q.deleteTokensOf.run(id, "verify");
    q.deleteTokensOf.run(id, "reset");
    q.deleteAccount.run(id);
  })();
  res.clearCookie("calm_session", { path: "/" });
  res.status(204).end();
});

// ---------- результаты тестов ----------
function requireIdentity(req, res, next) {
  if (!req.account && !req.userId) return res.status(400).json({ error: "bad user id" });
  next();
}

app.post("/api/results", requireIdentity, (req, res) => {
  const { slug, answers } = req.body || {};
  const quiz = quizzes.find((x) => x.slug === slug);
  if (!quiz || !validAnswers(quiz, answers)) return res.status(400).json({ error: "bad data" });

  // Баллы считаем на сервере сами, а не берём из запроса
  const { score, maxScore, level, scales } = computeResult(quiz, answers);
  const createdAt = nowIso();
  const details = scales ? JSON.stringify(scales.map(({ id, title, percent }) => ({ id, title, percent }))) : null;
  const info = q.insertResult.run(
    req.userId || "account", req.account ? req.account.id : null,
    slug, JSON.stringify(answers), score, maxScore, level.title, createdAt, details
  );
  res.status(201).json({ id: info.lastInsertRowid, slug, score, maxScore, level: level.title, createdAt });
});

app.get("/api/results", requireIdentity, (req, res) => {
  const rows = req.account ? q.listByAccount.all(req.account.id) : q.listByAnon.all(req.userId);
  res.json(
    rows.map((r) => ({ ...r, answers: JSON.parse(r.answers), details: r.details ? JSON.parse(r.details) : null }))
  );
});

app.delete("/api/results/:id", requireIdentity, (req, res) => {
  const id = Number(req.params.id);
  if (req.account) q.deleteOneAccount.run(id, req.account.id);
  else q.deleteOneAnon.run(id, req.userId);
  res.status(204).end();
});

app.delete("/api/results", requireIdentity, (req, res) => {
  if (req.account) q.deleteAllAccount.run(req.account.id);
  else q.deleteAllAnon.run(req.userId);
  res.status(204).end();
});

// ---------- ИИ-помощник Квалм ----------
app.get("/api/chat/status", (_req, res) => {
  res.json(qualmStatus());
});
app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "пустое сообщение" });
  if (message.length > 2000) return res.status(400).json({ error: "сообщение слишком длинное" });
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  // Если пользователь вошёл — подгружаем его последние результаты, чтобы Квалм
  // мог их обсуждать по имени. Для анонима — пусто.
  let results = [];
  if (req.account) {
    try {
      const rows = q.listByAccount.all(req.account.id).slice(0, 10);
      results = rows.map((r) => ({
        slug: r.slug,
        score: r.score,
        maxScore: r.maxScore,
        level: r.level,
        createdAt: r.createdAt,
      }));
    } catch { /* ignore */ }
  }

  try {
    const result = await askQualm({ message, history, results });
    res.json(result);
  } catch (err) {
    console.error("[chat]", err);
    res.status(500).json({ error: "Квалм пока не может ответить, попробуй ещё раз" });
  }
});

// ---------- прочее ----------
app.use("/api", (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status === 400 ? "Некорректный запрос" : "Ошибка сервера" });
});

// Если сайт собран (npm run build), отдаём его же с этого сервера
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`API: http://127.0.0.1:${PORT}`);
});

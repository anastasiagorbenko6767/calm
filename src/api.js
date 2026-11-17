// Обращения к серверу.
// Аноним определяется случайным номером браузера (создаётся один раз и хранится в браузере).
// Вошедший пользователь определяется защищённым cookie, которое ставит сервер.

const KEY = "calm_user_id";
let memoryId = null;

// База для API. В вебе — пусто (Vite-прокси на /api).
// В Android-сборке Capacitor пропишите VITE_API_BASE=https://your-server.example
// в .env.production перед `npm run build`.
const API_BASE = (import.meta.env?.VITE_API_BASE || "").replace(/\/$/, "");
const url = (path) => `${API_BASE}${path}`;

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getUserId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = makeId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // хранилище браузера недоступно: номер живёт только до закрытия вкладки
    if (!memoryId) memoryId = makeId();
    return memoryId;
  }
}

async function request(method, path, body) {
  const res = await fetch(url(path), {
    method,
    credentials: API_BASE ? "include" : "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": getUserId(),
      "X-Requested-With": "calm",
      // отключает интерстициальную страницу бесплатного ngrok
      "ngrok-skip-browser-warning": "true",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      /* ответ не JSON */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// результаты тестов
export const saveResult = (slug, answers) => request("POST", "/api/results", { slug, answers });
export const fetchResults = () => request("GET", "/api/results");
export const deleteResult = (id) => request("DELETE", `/api/results/${id}`);
export const deleteAllResults = () => request("DELETE", "/api/results");

// аккаунт
export const fetchMe = () => request("GET", "/api/auth/me");
export const register = (email, password, name) => request("POST", "/api/auth/register", { email, password, name });
export const login = (email, password) => request("POST", "/api/auth/login", { email, password });
export const logout = () => request("POST", "/api/auth/logout");
export const forgotPassword = (email) => request("POST", "/api/auth/forgot", { email });
export const resetPassword = (token, password) => request("POST", "/api/auth/reset", { token, password });
export const verifyEmail = (token) => request("POST", "/api/auth/verify", { token });
export const resendVerification = () => request("POST", "/api/auth/resend");
export const updateProfile = (name) => request("PATCH", "/api/auth/profile", { name });
export const changePassword = (current, next) => request("POST", "/api/auth/password", { current, next });
export const deleteAccount = (password) => request("DELETE", "/api/auth/account", { password });

// Квалм — ИИ-помощник
export const chatAsk = (message, history) => request("POST", "/api/chat", { message, history });
export const chatStatus = () => request("GET", "/api/chat/status");

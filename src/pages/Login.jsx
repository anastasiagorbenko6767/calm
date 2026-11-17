import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { useAuth } from "../auth";
import { login, register } from "../api";

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/profile" replace />;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = mode === "login" ? await login(email, password) : await register(email, password, name);
      setUser(res.user);
      navigate("/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={mode === "login" ? "вход" : "регистрация"} heading="Профиль">
      <div className="quiz">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "tab tab_on" : "tab"}
            onClick={() => setMode("login")}
          >
            Войти
          </button>
          <button
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "tab tab_on" : "tab"}
            onClick={() => setMode("register")}
          >
            Создать профиль
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          {mode === "register" && (
            <>
              <label htmlFor="name">Имя (необязательно)</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" />
            </>
          )}
          <label htmlFor="email">Почта</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />

          <label htmlFor="password">Пароль{mode === "register" && " (не короче 8 символов)"}</label>
          <div className="pw-wrap">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              required
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
              aria-pressed={showPw}
              title={showPw ? "Скрыть" : "Показать"}
            >
              {showPw ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58a2 2 0 002.83 2.83" />
                  <path d="M16.68 16.68A9.5 9.5 0 0112 18c-5 0-9-4-10-6 .6-1.2 1.9-3 3.88-4.46" />
                  <path d="M8.5 5.5A9.5 9.5 0 0112 5c5 0 9 4 10 6-.5 1-1.5 2.4-3 3.68" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className="form_msg" role="alert">
              {error}
            </p>
          )}

          <div className="quiz_actions">
            <button className="quiz_btn" type="submit" disabled={busy}>
              {mode === "login" ? "Войти" : "Создать профиль"}
            </button>
          </div>
          {mode === "login" && (
            <p className="form_links">
              <Link to="/forgot">Забыли пароль?</Link>
            </p>
          )}
          {mode === "register" && (
            <p className="form_hint">
              Результаты тестов, которые вы прошли в этом браузере до регистрации, добавятся в профиль.
            </p>
          )}
        </form>
      </div>
    </Shell>
  );
}

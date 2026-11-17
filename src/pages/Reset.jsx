import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import { resetPassword } from "../api";

export default function Reset() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password !== repeat) return setError("Пароли не совпадают");
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell title="новый пароль" heading="Новый пароль">
      <div className="quiz">
        {done ? (
          <>
            <p>Пароль изменён. Теперь можно войти с новым паролем.</p>
            <div className="quiz_actions">
              <Link className="quiz_btn" to="/login">
                Войти
              </Link>
            </div>
          </>
        ) : !token ? (
          <p>Ссылка неполная. Запросите сброс пароля ещё раз.</p>
        ) : (
          <form className="form" onSubmit={submit}>
            <label htmlFor="p1">Новый пароль (не короче 8 символов)</label>
            <input id="p1" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <label htmlFor="p2">Повторите пароль</label>
            <input id="p2" type="password" required minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
            {error && (
              <p className="form_msg" role="alert">
                {error}
              </p>
            )}
            <div className="quiz_actions">
              <button className="quiz_btn" type="submit">
                Сохранить пароль
              </button>
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}

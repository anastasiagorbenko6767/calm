import { useState } from "react";
import { Link } from "react-router-dom";
import Shell from "../components/Shell";
import { forgotPassword } from "../api";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell title="сброс пароля" heading="Сброс пароля">
      <div className="quiz">
        {sent ? (
          <>
            <p>Если такая почта зарегистрирована, мы отправили на неё письмо со ссылкой для нового пароля. Ссылка действует час.</p>
            <div className="quiz_actions">
              <Link className="quiz_btn" to="/login">
                Вернуться ко входу
              </Link>
            </div>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="form_hint">Укажите почту, с которой вы регистрировались.</p>
            <label htmlFor="email">Почта</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            {error && (
              <p className="form_msg" role="alert">
                {error}
              </p>
            )}
            <div className="quiz_actions">
              <button className="quiz_btn" type="submit">
                Отправить ссылку
              </button>
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import History from "../components/History";
import { useAuth } from "../auth";
import { changePassword, deleteAccount, logout, resendVerification, updateProfile } from "../api";

const formatDate = (iso) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [nameMsg, setNameMsg] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", error: false });

  const [delPassword, setDelPassword] = useState("");
  const [delError, setDelError] = useState("");

  if (user === undefined) {
    return (
      <Shell title="профиль">
        <p>Загружаю…</p>
      </Shell>
    );
  }

  // Гость: приглашение войти и результаты этого браузера
  if (user === null) {
    return (
      <Shell title="профиль">
        <div className="quiz">
          <p className="quiz_text">
            Войдите или создайте профиль, чтобы результаты тестов были привязаны к вашей почте и доступны с любого устройства.
          </p>
          <div className="quiz_actions">
            <Link className="quiz_btn" to="/login">
              Войти или создать профиль
            </Link>
          </div>
        </div>
        <h2>Результаты в этом браузере</h2>
        <History />
      </Shell>
    );
  }

  async function saveName(e) {
    e.preventDefault();
    try {
      const res = await updateProfile(name);
      setUser(res.user);
      setNameMsg("Сохранено");
    } catch (err) {
      setNameMsg(err.message);
    }
  }

  async function resend() {
    try {
      await resendVerification();
      setVerifyMsg("Письмо отправлено. Проверьте почту.");
    } catch (err) {
      setVerifyMsg(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setPwMsg({ text: "Пароль изменён. На других устройствах потребуется войти заново.", error: false });
    } catch (err) {
      setPwMsg({ text: err.message, error: true });
    }
  }

  async function signOut() {
    await logout().catch(() => {});
    setUser(null);
    navigate("/");
  }

  async function removeAccount(e) {
    e.preventDefault();
    if (!window.confirm("Удалить профиль и все результаты навсегда? Это нельзя отменить.")) return;
    try {
      await deleteAccount(delPassword);
      setUser(null);
      navigate("/");
    } catch (err) {
      setDelError(err.message);
    }
  }

  return (
    <Shell title="профиль" heading="Мой профиль">
      <div className="quiz profile_card">
        <img className="profile_avatar" src="/static/images/frog.gif" alt="аватар" />
        <p className="profile_name">{user.name || "Без имени"}</p>
        <p className="profile_meta">{user.email}</p>
        <p className="profile_meta">С нами с {formatDate(user.createdAt)}</p>
        {user.emailVerified ? (
          <p className="profile_meta">Почта подтверждена</p>
        ) : (
          <>
            <p className="profile_meta">Почта не подтверждена. Мы отправили письмо со ссылкой при регистрации.</p>
            <button className="quiz_back" onClick={resend}>
              Отправить письмо ещё раз
            </button>
            {verifyMsg && <p className="profile_meta">{verifyMsg}</p>}
          </>
        )}
        <div className="quiz_actions">
          <button className="quiz_btn" onClick={signOut}>
            Выйти
          </button>
        </div>
      </div>

      <h2>Мои результаты</h2>
      <History />

      <h2>Настройки</h2>
      <div className="quiz">
        <form className="form" onSubmit={saveName}>
          <label htmlFor="pname">Имя</label>
          <input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <div className="quiz_actions">
            <button className="quiz_btn" type="submit">
              Сохранить имя
            </button>
          </div>
          {nameMsg && <p className="form_hint">{nameMsg}</p>}
        </form>
      </div>

      <div className="quiz">
        <form className="form" onSubmit={savePassword}>
          <label htmlFor="cur">Текущий пароль</label>
          <input id="cur" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <label htmlFor="new">Новый пароль (не короче 8 символов)</label>
          <input id="new" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <div className="quiz_actions">
            <button className="quiz_btn" type="submit">
              Сменить пароль
            </button>
          </div>
          {pwMsg.text && (
            <p className={pwMsg.error ? "form_msg" : "form_hint"} role={pwMsg.error ? "alert" : undefined}>
              {pwMsg.text}
            </p>
          )}
        </form>
      </div>

      <div className="quiz">
        <form className="form" onSubmit={removeAccount}>
          <p className="form_hint">Профиль и все ваши результаты будут удалены навсегда.</p>
          <label htmlFor="del">Пароль для подтверждения</label>
          <input id="del" type="password" required value={delPassword} onChange={(e) => setDelPassword(e.target.value)} autoComplete="current-password" />
          {delError && (
            <p className="form_msg" role="alert">
              {delError}
            </p>
          )}
          <div className="quiz_actions">
            <button className="quiz_btn" type="submit">
              Удалить профиль
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

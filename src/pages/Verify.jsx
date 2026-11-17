import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import { useAuth } from "../auth";
import { fetchMe, verifyEmail } from "../api";

export default function Verify() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { setUser } = useAuth();
  const [state, setState] = useState("loading"); // loading | ok | error
  const [message, setMessage] = useState("");
  const started = useRef(false); // чтобы в режиме разработки ссылка не проверялась дважды

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => {
        setState("ok");
        return fetchMe().then((r) => setUser(r.user));
      })
      .catch((err) => {
        setMessage(err.message);
        setState("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell title="подтверждение почты" heading="Подтверждение почты">
      <div className="quiz">
        {state === "loading" && <p>Проверяю ссылку…</p>}
        {state === "ok" && <p>Почта подтверждена. Спасибо!</p>}
        {state === "error" && <p role="alert">{message}</p>}
        <div className="quiz_actions">
          <Link className="quiz_btn" to="/profile">
            В профиль
          </Link>
        </div>
      </div>
    </Shell>
  );
}
